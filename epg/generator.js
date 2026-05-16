const fs = require("fs")
const path = require("path")

// 📡 CANALES NACIONALES E INTERNACIONALES CON SU ZONA HORARIA REAL
const CHANNELS = [
  // 🇪🇨 Nacionales (Ecuador -05:00)
  { id: "Ecuavisa.ec", name: "Ecuavisa", type: "tv", lang: "es", timezone: "-0500" },
  { id: "Teleamazonas.ec", name: "Teleamazonas", type: "tv", lang: "es", timezone: "-0500" },
  { id: "TCTelevision.ec", name: "TC Televisión", type: "tv", lang: "es", timezone: "-0500" },

  // 🇲🇽 México (CST -06:00 / -05:00 dependiendo de la región, usaremos -0600 para CDMX estándar antiguo/referencia)
  { id: "LasEstrellas.mx", name: "Las Estrellas", type: "tv", lang: "es", timezone: "-0600" },
  { id: "AztecaUno.mx", name: "Azteca Uno", type: "tv", lang: "es", timezone: "-0600" },

  // 🇺🇸 Estados Unidos / Latam Premium (Estándar de transmisión Este -0500)
  { id: "Discovery.us", name: "Discovery Channel", type: "tv", lang: "es", timezone: "-0500" },
  { id: "WarnerTV.us", name: "Warner TV", type: "movies", lang: "es", timezone: "-0500" },
  { id: "HBO.us", name: "HBO Latam", type: "movies", lang: "es", timezone: "-0500" },
  { id: "ESPN.us", name: "ESPN", type: "sports", lang: "es", timezone: "-0500" },

  // 🇦🇷 Argentina (ART -03:00)
  { id: "Telefe.ar", name: "Telefe", type: "tv", lang: "es", timezone: "-0300" },
  { id: "TyCSports.ar", name: "TyC Sports", type: "sports", lang: "es", timezone: "-0300" },

  // 🇪🇸 España (CET +01:00 / +02:00 Verano. Usaremos +0100 base)
  { id: "Antena3.es", name: "Antena 3 España", type: "tv", lang: "es", timezone: "+0100" }
]

// 🎯 CONTENIDO AMPLIADO POR TIPO
const CONTENT_POOL = {
  tv: {
    manana: { 
      title: "Noticiero Matutino Internacional", 
      desc: "El reporte de las primeras noticias del mundo y entrevistas de actualidad.", 
      categories: ["Noticias", "Actualidad"], 
      icon: "https://i.imgur.com/0rZ4G6Q.jpg",
      rating: "TP"
    },
    tarde: { 
      title: "Show de Entretenimiento Global", 
      desc: "Talk show con celebridades internacionales, música en vivo y juegos.", 
      categories: ["Magazine", "Entretenimiento"], 
      icon: "https://i.imgur.com/3ZQ3Z6p.jpg",
      rating: "TP"
    },
    noche: { 
      title: "Serie Dramática / Súper Serie", 
      desc: "Producción internacional de alta factura con intriga y suspenso.", 
      categories: ["Drama", "Serie"], 
      icon: "https://i.imgur.com/5KX6K9G.jpg",
      rating: "14+",
      actors: ["Pedro Pascal", "Wagner Moura"]
    }
  },
  sports: {
    manana: { 
      title: "Central de Noticias Deportivas", 
      desc: "Toda la información del fútbol internacional, baloncesto y automovilismo.", 
      categories: ["Deportes", "Resumen"], 
      icon: "https://i.imgur.com/jK2l8dE.jpg",
      rating: "TP"
    },
    tarde: { 
      title: "Fútbol Internacional en Vivo", 
      desc: "Transmisión del partido de la jornada en directo desde los mejores estadios.", 
      categories: ["Deportes", "Fútbol"], 
      icon: "https://i.imgur.com/jK2l8dE.jpg",
      rating: "TP"
    },
    noche: { 
      title: "Crónica y Debate Deportivo", 
      desc: "Análisis polémico de la jornada con los periodistas más influyentes de la televisión.", 
      categories: ["Deportes", "Debate"], 
      icon: "https://i.imgur.com/jK2l8dE.jpg",
      rating: "TP"
    }
  },
  movies: {
    manana: { 
      title: "Cine de Colección", 
      desc: "Grandes clásicos del séptimo arte que hicieron historia en las pantallas de cine.", 
      categories: ["Películas", "Clásico"], 
      icon: "https://i.imgur.com/9XK8Z1Y.jpg",
      rating: "12+",
      year: "1994",
      director: "Frank Darabont",
      actors: ["Tim Robbins", "Morgan Freeman"]
    },
    tarde: { 
      title: "Bloque de Acción y Adrenalina", 
      desc: "Películas taquilleras cargadas de efectos especiales, persecuciones y combates espectaculares.", 
      categories: ["Películas", "Acción"], 
      icon: "https://i.imgur.com/9O1Iy9od.jpg",
      rating: "14+",
      year: "2023",
      director: "Chad Stahelski",
      actors: ["Keanu Reeves", "Donnie Yen"]
    },
    noche: { 
      title: "Estreno de Hollywood", 
      desc: "La película más esperada de la semana llega a la pantalla chica para toda Latinoamérica.", 
      categories: ["Películas", "Estreno", "Ciencia Ficción"], 
      icon: "https://i.imgur.com/9XK8Z1Y.jpg",
      rating: "16+",
      year: "2024",
      director: "Denis Villeneuve",
      actors: ["Timothée Chalamet", "Zendaya"]
    }
  }
}

// 🧽 LIMPIEZA XML
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  })
}

// 🧠 CAMBIO CLAVE: FORMATO DE FECHA DINÁMICO QUE USA LA ZONA HORARIA DEL CANAL
function formatDate(date, timezone) {
  const pad = n => String(n).padStart(2, "0")
  
  // Construye la base YYYYMMDDHHMMSS
  const dateStr = 
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())

  // Añade el formato de zona horaria (ej: " -0500" o " +0100")
  return `${dateStr} ${timezone}`
}

function getContentByHour(type, hour) {
  const block = CONTENT_POOL[type]
  if (hour >= 6 && hour < 12) return block.manana
  if (hour >= 12 && hour < 19) return block.tarde
  return block.noche
}

// 🎬 GENERACIÓN CONSIDERANDO LA ZONA HORARIA
function generatePrograms(channel) {
  let programs = []
  
  let current = new Date()
  current.setDate(current.getDate() - 1) // 3 días: Ayer, hoy y mañana
  current.setHours(0, 0, 0, 0)

  for (let i = 0; i < 36; i++) {
    const start = new Date(current)
    const hour = start.getHours()
    
    const content = getContentByHour(channel.type, hour)

    current.setHours(current.getHours() + 2)
    const stop = new Date(current)

    programs.push({
      channel: channel.id,
      lang: channel.lang || "es",
      timezone: channel.timezone, // Guardamos la zona para formatear después
      start: formatDate(start, channel.timezone),
      stop: formatDate(stop, channel.timezone),
      ...content
    })
  }

  return programs
}

// 🧾 CONSTRUCCIÓN FINAL DEL XMLTV
function buildEPG() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="GeneradorEPG_Internacional v3.0">\n`

  // 1. Canales
  CHANNELS.forEach(ch => {
    xml += `  <channel id="${escapeXml(ch.id)}">\n    <display-name>${escapeXml(ch.name)}</display-name>\n  </channel>\n`
  })

  // 2. Programas
  CHANNELS.forEach(ch => {
    const programs = generatePrograms(ch)

    programs.forEach(p => {
      xml += `  <programme start="${p.start}" stop="${p.stop}" channel="${escapeXml(p.channel)}">\n`
      xml += `    <title lang="${p.lang}">${escapeXml(p.title)}</title>\n`
      xml += `    <desc lang="${p.lang}">${escapeXml(p.desc)}</desc>\n`
      
      if (p.director || (p.actors && p.actors.length > 0)) {
        xml += `    <credits>\n`
        if (p.director) xml += `      <director>${escapeXml(p.director)}</director>\n`
        if (p.actors) {
          p.actors.forEach(actor => {
            xml += `      <actor>${escapeXml(actor)}</actor>\n`
          })
        }
        xml += `    </credits>\n`
      }

      if (p.year) xml += `    <year>${p.year}</year>\n`

      if (p.categories) {
        p.categories.forEach(cat => {
          xml += `    <category lang="${p.lang}">${escapeXml(cat)}</category>\n`
        })
      }

      if (p.icon) xml += `    <icon src="${escapeXml(p.icon)}" />\n`

      if (p.rating) {
        xml += `    <rating system="advisory">\n      <value>${escapeXml(p.rating)}</value>\n    </rating>\n`
      }

      xml += `  </programme>\n`
    })
  })

  xml += `</tv>`

  const outputPath = path.join(__dirname, "epg.xml")
  fs.writeFileSync(outputPath, xml, "utf-8")

  console.log(`🔥 EPG Multi-país generado. ${CHANNELS.length} canales procesados correctamente.`);
}

buildEPG()
