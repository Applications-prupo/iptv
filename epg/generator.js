const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs COMBINADA (IDs de ambas fuentes para que coincidan con tu M3U)
const TARGET_IDS = [
    // IDs Fuente 1 (iptv-epg)
    "Ecuavisa.ec", "Teleamazonas.ec", "RTS.ec", "TCTelevision.ec", "EcuadorTV.ec", "Gamavision.ec",
    // IDs Fuente 2 (EPGShare01)
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

// 🔗 FUENTES DE DATOS
const SOURCES = [
    "https://iptv-epg.org/files/epg-ec.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz"
];

async function generateFinalEPG() {
    const outputPath = path.join(__dirname, "epg.xml");
    
    console.log("🚀 Iniciando extracción Multi-Fuente para Ecuador...");

    try {
        let channelsPart = "";
        let programmesPart = "";
        let foundChannels = new Set();

        for (const url of SOURCES) {
            console.log(`📥 Procesando: ${url}`);
            try {
                const response = await axios({ method: 'get', url: url, responseType: 'stream', timeout: 30000 });
                const gunzip = zlib.createGunzip();
                const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

                let currentProgChannel = null;

                for await (const line of rl) {
                    const cleanLine = line.trim();

                    // 1. Manejo de Canales (Evitamos duplicados entre fuentes)
                    if (cleanLine.includes("<channel")) {
                        const idMatch = cleanLine.match(/id="([^"]+)"/);
                        if (idMatch && TARGET_IDS.includes(idMatch[1]) && !foundChannels.has(idMatch[1])) {
                            if (cleanLine.includes("/>") || cleanLine.includes("</channel>")) {
                                channelsPart += `  ${cleanLine}\n`;
                            } else {
                                channelsPart += `  ${cleanLine}</channel>\n`;
                            }
                            foundChannels.add(idMatch[1]);
                        }
                    }

                    // 2. Manejo de Programas (Filtro por ID y Ajuste de Hora)
                    if (cleanLine.includes("<programme")) {
                        const channelMatch = cleanLine.match(/channel="([^"]+)"/);
                        if (channelMatch && TARGET_IDS.includes(channelMatch[1])) {
                            currentProgChannel = channelMatch[1];
                            // Ajuste de hora a Ecuador (-0500)
                            let fixedLine = cleanLine.replace(/(\+|\-)\d{4}/g, "-0500");
                            programmesPart += `  ${fixedLine}\n`;
                        } else {
                            currentProgChannel = null;
                        }
                    } else if (currentProgChannel) {
                        programmesPart += `  ${cleanLine}\n`;
                        if (cleanLine.includes("</programme>")) {
                            currentProgChannel = null;
                        }
                    }
                }
            } catch (sourceError) {
                console.error(`⚠️ Error en fuente ${url}: ${sourceError.message}`);
            }
        }

        // --- CONSTRUCCIÓN FINAL SEGURA ---
        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        finalXml += channelsPart;
        finalXml += programmesPart;
        finalXml += `</tv>`; 

        fs.writeFileSync(outputPath, finalXml, 'utf8');
        
        console.log("---------------------------------------");
        console.log(`✅ ¡GUÍA MAESTRA COMPLETADA!`);
        console.log(`📺 Canales únicos encontrados: ${foundChannels.size}`);
        console.log(`📂 Archivo generado: ${outputPath}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error General:", err.message);
    }
}

generateFinalEPG();
