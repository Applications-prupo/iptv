
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

// 📡 LISTA DE CANALES A RASTREAR
const CHANNELS_TO_SCRAPE = [
    { id: "Ecuavisa.ec", name: "Ecuavisa", url: "https://www.gatotv.com/canal/ecuavisa_ecuador" },
    { id: "Teleamazonas.ec", name: "Teleamazonas", url: "https://www.gatotv.com/canal/teleamazonas_ecuador" },
    { id: "TCTelevision.ec", name: "TC Televisión", url: "https://www.gatotv.com/canal/tc_television_ecuador" },
    { id: "RTS.ec", name: "RTS", url: "https://www.gatotv.com/canal/rts_ecuador" },
    // Aquí puedes añadir internacionales siguiendo el mismo formato de URL de GatoTV:
    // { id: "Antena3.es", name: "Antena 3", url: "https://www.gatotv.com/canal/antena_3_espana" },
];

function escapeXml(unsafe) {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'; case '>': return '&gt;';
            case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
        }
    });
}

function formatEPGDate(timeStr) {
    const now = new Date();
    let [hours, minutes] = timeStr.split(':');
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    const pad = n => String(n).padStart(2, "0");
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
           pad(date.getHours()) + pad(date.getMinutes()) + "00 -0500";
}

// Función para esperar entre peticiones (Evita bloqueos)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startMultiScraper() {
    let fullXmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="GatoTV-Robot-Ecuador">\n`;
    let channelTags = "";
    let programmeTags = "";

    console.log("🚀 Iniciando Robot Multicanal...");

    for (const ch of CHANNELS_TO_SCRAPE) {
        try {
            console.log(`\n📡 Extrayendo: ${ch.name}...`);
            
            const { data } = await axios.get(ch.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
            });

            const $ = cheerio.load(data);
            
            // Crear etiqueta de canal
            channelTags += `  <channel id="${ch.id}">\n    <display-name>${ch.name}</display-name>\n  </channel>\n`;

            // Extraer programas
            let channelPrograms = [];
            $('.tabla_programa tr').each((i, el) => {
                const time = $(el).find('.hora').text().trim();
                const title = $(el).find('.nombre').text().trim();
                const desc = $(el).find('.sinopsis').text().trim() || "Sin descripción";

                if (time && title) {
                    channelPrograms.push({ start: formatEPGDate(time), title, desc });
                }
            });

            // Generar etiquetas de programas para este canal
            channelPrograms.forEach((p, index) => {
                const stop = channelPrograms[index + 1] ? channelPrograms[index + 1].start : p.start;
                programmeTags += `  <programme start="${p.start}" stop="${stop}" channel="${ch.id}">\n`;
                programmeTags += `    <title lang="es">${escapeXml(p.title)}</title>\n`;
                programmeTags += `    <desc lang="es">${escapeXml(p.desc)}</desc>\n`;
                programmeTags += `    <category lang="es">Programación Real</category>\n`;
                programmeTags += `  </programme>\n`;
            });

            console.log(`✅ ${ch.name} listo (${channelPrograms.length} programas).`);
            
            // Esperar 2 segundos antes del siguiente canal para no ser baneados
            await sleep(2000);

        } catch (error) {
            console.error(`❌ Error en ${ch.name}: ${error.message}`);
        }
    }

    fullXmlContent += channelTags + programmeTags + `</tv>`;

    const outputPath = path.join(__dirname, "epg.xml");
    fs.writeFileSync(outputPath, fullXmlContent);
    console.log("\n🔥 ARCHIVO FINAL GENERADO: epg.xml con canales reales.");
}

startMultiScraper();
