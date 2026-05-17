const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs EXACTOS
const TARGET_IDS = [
    "Canal.Ecuavisa.(Ecuador).ec",
    "Canal.TC.TelevisiÃ³n.ec",
    "Canal.RTS.ec",
    "Canal.GamavisiÃ³n.ec",
    "Canal.Ecuador.TV.ec",
    "Canal.ESPN.(Ecuador).ec",
    "Canal.ESPN.2.(Ecuador).ec",
    "Canal.TNT.(Ecuador).ec",
    "Canal.Warner.TV.(Ecuador).ec",
    "Canal.Disney.Channel.(Ecuador).ec",
    "Canal.Discovery.Kids.(Ecuador).ec",
    "Canal.Nickelodeon.(Ecuador).ec"
];

async function generateFinalEPG() {
    const url = "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz";
    const outputPath = path.join(__dirname, "epg.xml");
    
    console.log("🚀 Extrayendo y reparando etiquetas XML para Ecuador...");

    try {
        const response = await axios({ method: 'get', url: url, responseType: 'stream' });
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

        // Empezamos con la cabecera limpia
        let channelsPart = "";
        let programmesPart = "";
        let foundChannels = new Set();
        let inProg = false;

        for await (const line of rl) {
            const cleanLine = line.trim();

            // 1. Manejo de Canales (Aseguramos cierre individual)
            if (cleanLine.includes("<channel")) {
                const match = TARGET_IDS.find(id => cleanLine.includes(`id="${id}"`));
                if (match) {
                    // Si la línea no incluye el cierre </channel>, lo forzamos o limpiamos
                    if (cleanLine.includes("/>") || cleanLine.includes("</channel>")) {
                        channelsPart += `  ${cleanLine}\n`;
                    } else {
                        channelsPart += `  ${cleanLine}</channel>\n`;
                    }
                    foundChannels.add(match);
                }
            }

            // 2. Manejo de Programas + Ajuste de Hora + Cierre Seguro
            if (cleanLine.includes("<programme")) {
                const match = TARGET_IDS.find(id => cleanLine.includes(`channel="${id}"`));
                if (match) {
                    inProg = true;
                    // Ajuste de hora a Ecuador (-0500)
                    let fixedLine = cleanLine.replace(/(\+|\-)\d{4}/g, "-0500");
                    programmesPart += `  ${fixedLine}\n`;
                }
            } else if (inProg) {
                programmesPart += `  ${cleanLine}\n`;
                if (cleanLine.includes("</programme>")) {
                    inProg = false;
                }
            }
        }

        // --- CONSTRUCCIÓN FINAL SEGURA ---
        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        finalXml += channelsPart;
        finalXml += programmesPart;
        finalXml += `</tv>`; // Cierre maestro garantizado

        fs.writeFileSync(outputPath, finalXml, 'utf8');
        
        console.log("---------------------------------------");
        console.log(`✅ ¡GUÍA REPARADA!`);
        console.log(`📺 Canales encontrados: ${foundChannels.size}`);
        console.log(`📂 Archivo: ${outputPath}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

generateFinalEPG();
