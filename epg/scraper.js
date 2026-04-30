const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")

// 🔥 CANALES (puedes agregar más aquí)
const CHANNELS = [
  {
    id: "Ecuavisa.ec",
    name: "Ecuavisa",
    url: "https://www.gatotv.com/canal/ecuavisa_ecuador"
  },
  {
    id: "Teleamazonas.ec",
    name: "Teleamazonas",
    url: "https://www.gatotv.com/canal/teleamazonas_ecuador"
  },
  {
    id: "RTS.ec",
    name: "RTS",
    url: "https://www.gatotv.com/canal/rts_ecuador"
  },
  {
    id: "TCTelevision.ec",
    name: "TC Televisión",
    url: "https://www.gatotv.com/canal/tc_television_ecuador"
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

// 👉 scrape de UN canal
async function scrapeChannel(channel) {
  try {
    const { data } = await axios.get(channel.url)
    const $ = cheerio.load(data)

    let programs = []

    $(".prog_comp").each((i, el) => {
      const time = $(el).find(".prog_comp_hora").text().trim()
      const title = $(el).find(".prog_comp_titulo").text().trim()

      if (time && title) {
        programs.push({ time, title })
      }
    })

    return programs.map((p, i) => {
      const next = programs[i + 1]

      return {
        start: formatDate(p.time),
        stop: next ? formatDate(next.time) : formatDate("23:59"),
        title: p.title
      }
    })
  } catch (err) {
    console.log(`Error en ${channel.name}:`, err.message)
    return []
  }
}

// 👉 construir XML FINAL
async function buildEPG() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`

  for (const ch of CHANNELS) {
    xml += `
  <channel id="${ch.id}">
    <display-name>${ch.name}</display-name>
  </channel>
    `
  }

  for (const ch of CHANNELS) {
    const programs = await scrapeChannel(ch)

    programs.forEach(p => {
      xml += `
  <programme start="${p.start}" stop="${p.stop}" channel="${ch.id}">
    <title>${p.title}</title>
  </programme>
      `
    })
  }

  xml += `\n</tv>`

  fs.writeFileSync("epg/epg.xml", xml)

  console.log("EPG MULTI CANAL generado 🔥")
}

// 🚀 ejecutar
buildEPG()
