const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

// 📡 LISTA DE CANALES
const CHANNELS_TO_SCRAPE = [
    { id: "Ecuavisa.ec", name: "Ecuavisa", url: "https://www.gatotv.com/canal/ecuavisa_ecuador" },
    { id: "Teleamazonas.ec", name: "Teleamazonas", url: "https://www.gatotv.com/canal/teleamazonas_ecuador" },
    { id: "TCTelevision.ec", name: "TC Televisión", url: "https://www.gatotv.com/canal/tc_television_ecuador" },
    { id: "RTS.ec", name: "RTS", url: "https://www.gatotv.com/canal/rts_ecuador" }
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
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
    const pad = n => String(n).padStart(2, "0");
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
           pad(date.getHours()) + pad(date.getMinutes()) + "00 -0500";
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startMultiScraper() {
    let channelTags = "";
    let programmeTags = "";

    console.log("🚀 Iniciando Robot con Camuflaje Avanzado...");

    for (const ch of CHANNELS_TO_SCRAPE) {
        try {
            console.log(`\n--------------------------------------------`);
            console.log(`📡 Intentando conectar con: ${ch.name}...`);
            
            // 🛡️ CABECERAS DE NAVEGADOR REAL
            const response = await axios.get(ch.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Referer': 'https://www.google.com/',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 10000 // 10 segundos máximo
            });

            const $ = cheerio.load(response.data);
            
            // 📝 PRUEBA DE DIAGNÓSTICO: ¿Qué estamos viendo?
            const pageTitle = $('title').text();
            console.log(`📄 Título de la página recibida: "${pageTitle}"`);

            if (pageTitle.includes("403") || pageTitle.includes("Access Denied") || pageTitle.includes("Cloudflare")) {
                console.error(`❌ BLOQUEO DETECTADO: GatoTV ha bloqueado la IP de este servidor.`);
                continue;
            }

            channelTags += `  <channel id="${ch.id}">\n    <display-name>${ch.name}</display-name>\n  </channel>\n`;

            let channelPrograms = [];
            
            // GatoTV usa tablas para la programación
            $('.tabla_programa tr').each((i, el) => {
                const time = $(el).find('.hora').text().trim();
                const title = $(el).find('.nombre').text().trim();
                const desc = $(el).find('.sinopsis').text().trim() || "Sin descripción";

                if (time && title) {
                    channelPrograms.push({ start: formatEPGDate(time), title, desc });
                }
            });

            if (channelPrograms.length === 0) {
                console.warn(`⚠️ OJO: No se encontraron programas. La estructura de la web podría haber cambiado.`);
            } else {
                channelPrograms.forEach((p, index) => {
                    const stop = channelPrograms[index + 1] ? channelPrograms[index + 1].start : p.start;
                    programmeTags += `  <programme start="${p.start}" stop="${stop}" channel="${ch.id}">\n`;
                    programmeTags += `    <title lang="es">${escapeXml(p.title)}</title>\n`;
                    programmeTags += `    <desc lang="es">${escapeXml(p.desc)}</desc>\n`;
                    programmeTags += `    <category lang="es">TV Real</category>\n`;
                    programmeTags += `  </programme>\n`;
                });
                console.log(`✅ ${ch.name} listo: ${channelPrograms.length} programas obtenidos.`);
            }

            // Esperar 3 segundos para no levantar sospechas
            await sleep(3000);

        } catch (error) {
            console.error(`❌ ERROR CRÍTICO en ${ch.name}: ${error.message}`);
            if (error.response) console.log(`Código de error: ${error.response.status}`);
        }
    }

    const fullXmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="GatoTV-Scraper-V4">\n${channelTags}${programmeTags}</tv>`;
    
    const outputPath = path.join(__dirname, "epg.xml");
    fs.writeFileSync(outputPath, fullXmlContent);
    console.log(`\n🏁 PROCESO TERMINADO. Revisa el archivo epg.xml`);
}

startMultiScraper();
