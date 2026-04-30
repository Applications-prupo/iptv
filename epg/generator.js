const fs = require("fs")

// 🔥 tus canales (igual que en tu M3U)
const CHANNELS = [
  { id: "Ecuavisa.ec", name: "Ecuavisa" },
  { id: "Teleamazonas.ec", name: "Teleamazonas" },
  { id: "RTS.ec", name: "RTS" },
  { id: "TCTelevision.ec", name: "TC Televisión" }
]

// 🧠 programación base (editable)
const SCHEDULE = [
  { time: "06:00", title: "Noticias" },
  { time: "09:00", title: "Magazine" },
  { time: "12:00", title: "Series" },
  { time: "15:00", title: "Películas" },
  { time: "18:00", title: "Noticias Estelar" },
  { time: "21:00", title: "Prime Time" },
  { time: "23:59", title: "Cierre de transmisión" }
]

// 👉 formatear fecha XMLTV
function formatDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + " +0000"
}

// 👉 generar días (EPG futuro)
function generateDays(days = 3) {
  let result = []

  for (let d = 0; d < days; d++) {
    const base = new Date()
    base.setDate(base.getDate() + d)

    SCHEDULE.forEach((item, i) => {
      const [h, m] = item.time.split(":")

      const start = new Date(base)
      start.setHours(parseInt(h), parseInt(m), 0)

      let stop = new Date(base)
      if (SCHEDULE[i + 1]) {
        const [nh, nm] = SCHEDULE[i + 1].time.split(":")
        stop.setHours(parseInt(nh), parseInt(nm), 0)
      } else {
        stop.setHours(23, 59, 0)
      }

      result.push({
        start: formatDate(start),
        stop: formatDate(stop),
        title: item.title
      })
    })
  }

  return result
}

// 👉 construir XML
function buildEPG() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`

  // canales
  CHANNELS.forEach(ch => {
    xml += `
  <channel id="${ch.id}">
    <display-name>${ch.name}</display-name>
  </channel>`
  })

  // programas
  CHANNELS.forEach(ch => {
    const programs = generateDays(5) // 🔥 5 días

    programs.forEach(p => {
      xml += `
  <programme start="${p.start}" stop="${p.stop}" channel="${ch.id}">
    <title>${p.title}</title>
  </programme>`
    })
  })

  xml += `\n</tv>`

  fs.writeFileSync("epg/epg.xml", xml)

  console.log("🔥 EPG inteligente generado")
}

buildEPG()
