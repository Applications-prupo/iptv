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
    "Canal.Nickelodeon.(Ecuador).ec",
    "Canal.Animal.Planet.(Ecuador).ec",
    "Canal.TLC.(Ecuador).ec",
    "Canal.Discovery.Science.(LatinoamÃ©rica).ec",
    "Canal.Discovery.Turbo.(LatinoamÃ©rica).ec"
];

async function generateFinalEPG() {
    const url = "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz";
    const outputPath = path.join(__dirname, "epg.xml");
    
    console.log("🚀 Extrayendo y reparando etiquetas XML para Ecuador...");

    try {
        const response = await axios({ method: 'get', url: url, responseType: 'stream' });
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

        let channelsPart = "";
        let programmesPart = "";
        let foundChannels = new Set();
        let currentProgChannel = null; // 🧠 Esta es la "memoria" para no mezclar guías

        for await (const line of rl) {
            const cleanLine = line.trim();

            // 1. Manejo de Canales
            if (cleanLine.includes("<channel")) {
                const match = TARGET_IDS.find(id => cleanLine.includes(`id="${id}"`));
                if (match) {
                    if (cleanLine.includes("/>") || cleanLine.includes("</channel>")) {
                        channelsPart += `  ${cleanLine}\n`;
                    } else {
                        channelsPart += `  ${cleanLine}</channel>\n`;
                    }
                    foundChannels.add(match);
                }
            }

            // 2. Manejo de Programas (Filtro Estricto por ID)
            if (cleanLine.includes("<programme")) {
                // Buscamos a quién le pertenece este programa exactamente
                const match = TARGET_IDS.find(id => cleanLine.includes(`channel="${id}"`));
                if (match) {
                    currentProgChannel = match; // Marcamos que estamos leyendo programas de ESTE canal
                    let fixedLine = cleanLine.replace(/(\+|\-)\d{4}/g, "-0500");
                    programmesPart += `  ${fixedLine}\n`;
                } else {
                    currentProgChannel = null; // Si no está en nuestra lista, lo ignoramos
                }
            } else if (currentProgChannel) {
                // 📝 Solo guardamos líneas si pertenecen al canal que capturamos arriba
                programmesPart += `  ${cleanLine}\n`;
                if (cleanLine.includes("</programme>")) {
                    currentProgChannel = null; // Limpiamos la memoria al terminar el programa
                }
            }
        }

        // --- CONSTRUCCIÓN FINAL SEGURA ---
        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        finalXml += channelsPart;
        finalXml += programmesPart;
        finalXml += `</tv>`; 

        fs.writeFileSync(outputPath, finalXml, 'utf8');
        
        console.log("---------------------------------------");
        console.log(`✅ ¡GUÍA REPARADA Y DIFERENCIADA!`);
        console.log(`📺 Canales encontrados: ${foundChannels.size}`);
        console.log(`📂 Archivo: ${outputPath}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

generateFinalEPG();
