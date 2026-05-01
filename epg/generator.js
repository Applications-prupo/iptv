const fs = require("fs")
const path = require("path")

// 📡 CANALES CON IDENTIDAD
const CHANNELS = [
  {
    id: "Ecuavisa.ec",
    name: "Ecuavisa",
    type: "tv"
  },
  {
    id: "Teleamazonas.ec",
    name: "Teleamazonas",
    type: "tv"
  },
  {
    id: "RTS.ec",
    name: "RTS",
    type: "tv"
  },
  {
    id: "TCTelevision.ec",
    name: "TC Televisión",
    type: "tv"
  },
  {
    id: "Sports.ec",
    name: "Canal Deportes",
    type: "sports"
  },
  {
    id: "Movies.ec",
    name: "Canal Películas",
    type: "movies"
  }
]

// 🎯 CONTENIDO POR TIPO
const CONTENT_BY_TYPE = {
  tv: [
    {
      title: "Noticias de la Mañana",
      desc: "Actualidad nacional e internacional.",
      category: "Noticias",
      icon: "https://i.imgur.com/0rZ4G6Q.jpg"
    },
    {
      title: "Revista en Vivo",
      desc: "Entretenimiento y entrevistas.",
      category: "Magazine",
      icon: "https://i.imgur.com/3ZQ3Z6p.jpg"
    },
    {
      title: "Telenovela",
      desc: "Historias dramáticas para toda la familia.",
      category: "Drama",
      icon: "https://i.imgur.com/5KX6K9G.jpg"
    }
  ],

  sports: [
    {
      title: "Fútbol en Vivo",
      desc: "Partido en directo.",
      category: "Deportes",
      icon: "https://i.imgur.com/jK2l8dE.jpg"
    },
    {
      title: "Resumen Deportivo",
      desc: "Lo mejor del deporte.",
      category: "Deportes",
      icon: "https://i.imgur.com/jK2l8dE.jpg"
    }
  ],

  movies: [
    {
      title: "Película del Día",
      desc: "Cine destacado.",
      category: "Películas",
      icon: "https://i.imgur.com/9XK8Z1Y.jpg"
    },
    {
      title: "Acción Total",
      desc: "Películas de acción.",
      category: "Acción",
      icon: "https://i.imgur.com/9O1Iy9od.jpg"
    }
  ]
}

// 🧠 FORMATO FECHA
function formatDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + " +0000"
}

// 🎬 GENERAR PROGRAMACIÓN POR CANAL
function generatePrograms(channel) {
  let programs = []
  let current = new Date()

  for (let i = 0; i < 12; i++) {
    const pool = CONTENT_BY_TYPE[channel.type]
    const content = pool[Math.floor(Math.random() * pool.length)]

    const start = new Date(current)
    current.setHours(current.getHours() + 2)
    const stop = new Date(current)

    programs.push({
      channel: channel.id,
      start: formatDate(start),
      stop: formatDate(stop),
      ...content
    })
  }

  return programs
}

// 🧾 BUILD XML
function buildEPG() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`

  // canales
  CHANNELS.forEach(ch => {
    xml += `
  <channel id="${ch.id}">
    <display-name>${ch.name}</display-name>
  </channel>`
  })

  // programación
  CHANNELS.forEach(ch => {
    const programs = generatePrograms(ch)

    programs.forEach(p => {
      xml += `
  <programme start="${p.start}" stop="${p.stop}" channel="${p.channel}">
    <title>${p.title}</title>
    <desc>${p.desc}</desc>
    <category>${p.category}</category>
    <icon src="${p.icon}" />
  </programme>`
    })
  })

  xml += `\n</tv>`

  const outputPath = path.join(__dirname, "epg.xml")
  fs.writeFileSync(outputPath, xml)

  console.log("🔥 EPG REAL POR CANAL generado")
}

buildEPG()
