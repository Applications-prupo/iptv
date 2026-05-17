const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs EXACTOS (Sacados de tu escaneo)
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
    
    console.log("🚀 Extrayendo programación real para Ecuador...");

    try {
        const response = await axios({ method: 'get', url: url, responseType: 'stream' });
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        let programmes = "";
        let foundChannels = new Set();

        for await (const line of rl) {
            // 1. Detectar y guardar información del canal
            if (line.includes("<channel")) {
                const match = TARGET_IDS.find(id => line.includes(`id="${id}"`));
                if (match) {
                    finalXml += `  ${line}\n`;
                    foundChannels.add(match);
                }
            }

            // 2. Detectar y guardar los programas
            if (line.includes("<programme")) {
                const match = TARGET_IDS.find(id => line.includes(`channel="${id}"`));
                if (match) {
                    let fullProgramme = line + "\n";
                    // Capturamos el resto del bloque hasta </programme>
                    inProg = true; 
                    // Nota: En este modo streaming, los programas suelen venir completos por línea 
                    // o en bloques continuos. La mayoría de estas fuentes ponen el bloque en pocas líneas.
                    programmes += `  ${line}\n`;
                }
            }
            
            // Si la línea es parte de un programa que nos interesa (título, desc, etc.)
            // Este filtro es simple: si la línea contiene un ID de nuestra lista y es un dato de programa.
            if ((line.includes("<title") || line.includes("<desc") || line.includes("</programme")) && 
                TARGET_IDS.some(id => line.includes(id) || inProg)) {
                programmes += `  ${line}\n`;
                if (line.includes("</programme>")) inProg = false;
            }
        }

        finalXml += programmes + `</tv>`;
        fs.writeFileSync(outputPath, finalXml);
        
        console.log("---------------------------------------");
        console.log(`✅ ¡GUÍA LISTA! Canales procesados: ${foundChannels.size}`);
        console.log(`📂 Archivo: ${outputPath}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

let inProg = false; // Variable auxiliar para el bucle
generateFinalEPG();
