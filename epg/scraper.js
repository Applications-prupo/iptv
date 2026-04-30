const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")

// 🔥 CANALES
const CHANNELS = [
  {
    id: "Ecuavisa.ec",
    name: "Ecuavisa",
    url: "https://www.gatotv.com/canal/ecuavisa_ecuador"
  },
  {
    id: "Teleamazonas.ec",
    name: "Teleamazonas",
    url: "https://www.gatotv.com/canal/teleamazonas"
  },
  {
    id: "RTS.ec",
    name: "RTS",
    url: "https://www.gatotv.com/canal/rts"
  },
  {
    id: "TCTelevision.ec",
    name: "TC Televisión",
    url: "https://www.gatotv.com/canal/tc_television"
  }
]

// 👉 formato XMLTV
function formatDate(timeStr) {
  const [hours, minutes] = timeStr.split(":")
  const d = new Date()

  d.setHours(parseInt(hours))
  d.setMinutes(parseInt(minutes))
  d.setSeconds(0)

  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + " +0000"
}

// 👉 scrape de canal (MEJORADO)
async function scrapeChannel(channel) {
  try {
    const { data } = await axios.get(channel.url)
    const $ = cheerio.load(data)

    let programs = []

    // 🔥 método flexible (por si cambia HTML)
    $("li").each((i, el) => {
      const text = $(el).text().trim()

      const match = text.match(/^(\d{2}:\d{2})\s+(.*)$/)

      if (match) {
        programs.push({
          time: match[1],
          title: match[2]
        })
      }
    })

    console.log(channel.name, programs.length, "programas encontrados")

    // ⚠️ FALLBACK (clave para evitar XML vacío)
    if (programs.length === 0) {
      console.log(`⚠️ ${channel.name} usando fallback`)

      programs = [
        { time: "06:00", title: "Programación General" },
        { time: "12:00", title: "Entretenimiento" },
        { time: "18:00", title: "Noticias" }
      ]
    }

    return programs.map((p, i) => {
      const next = programs[i + 1]

      return {
        start: formatDate(p.time),
        stop: next ? formatDate(next.time) : formatDate("23:59"),
        title: p.title
      }
    })

  } catch (err) {
    console.log(`❌ Error en ${channel.name}:`, err.message)

    // 🔥 fallback total si falla la web
    return [
      {
        start: formatDate("06:00"),
        stop: formatDate("23:59"),
        title: "Programación continua"
      }
    ]
  }
}

// 👉 construir XML FINAL
async function buildEPG() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`

  // canales
  for (const ch of CHANNELS) {
    xml += `
  <channel id="${ch.id}">
    <display-name>${ch.name}</display-name>
  </channel>`
  }

  // programación
  for (const ch of CHANNELS) {
    const programs = await scrapeChannel(ch)

    programs.forEach(p => {
      xml += `
  <programme start="${p.start}" stop="${p.stop}" channel="${ch.id}">
    <title>${p.title}</title>
  </programme>`
    })
  }

  xml += `\n</tv>`

  fs.writeFileSync("epg/epg.xml", xml)

  console.log("✅ EPG MULTI CANAL generado correctamente 🔥")
}

// 🚀 ejecutar
buildEPG()
