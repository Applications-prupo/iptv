const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs PARA LA FUENTE NUEVA (iptv-epg.org)
// He incluido los IDs que vimos en tu captura y los comunes de esa fuente
const TARGET_IDS = [
    "Ecuavisa.ec", 
    "EcuadorTV.ec", 
    "Gamavision.ec",
    "Teleamazonas.ec",
    "RTS.ec",
    "TCTelevision.ec",
    "TC.ec",
    "CanalUno.ec",
    "OromarTV.ec",
    "RTU.ec",
    "TVC.ec"
];

// 🔗 ÚNICA FUENTE (La que está actualizada y correcta)
const SOURCE_URL = "https://iptv-epg.org/files/epg-ec.xml.gz";

async function generateFinalEPG() {
    const outputPath = path.join(__dirname, "epg.xml");
    
    console.log("🚀 Extrayendo guía completa desde la fuente principal...");

    try {
        let channelsPart = "";
        let programmesPart = "";
        let foundChannels = new Set();

        const response = await axios({ method: 'get', url: SOURCE_URL, responseType: 'stream', timeout: 30000 });
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

        let currentProgChannel = null;
        let currentChannelData = "";
        let capturingChannel = false;

        for await (const line of rl) {
            const cleanLine = line.trim();

            // --- 1. MANEJO DE CANALES ---
            if (cleanLine.includes("<channel")) {
                const idMatch = cleanLine.match(/id="([^"]+)"/);
                if (idMatch) {
                    const id = idMatch[1];
                    // Filtramos para que solo pasen los canales que nos interesan
                    if (TARGET_IDS.includes(id)) {
                        capturingChannel = true;
                        currentChannelData = `  ${cleanLine}\n`;
                        
                        // Si la etiqueta se cierra en la misma línea
                        if (cleanLine.includes("</channel>") || cleanLine.includes("/>")) {
                            channelsPart += currentChannelData;
                            foundChannels.add(id);
                            capturingChannel = false;
                        }
                    }
                }
            } else if (capturingChannel) {
                currentChannelData += `    ${cleanLine}\n`;
                if (cleanLine.includes("</channel>")) {
                    channelsPart += currentChannelData;
                    const idMatch = currentChannelData.match(/id="([^"]+)"/);
                    if (idMatch) foundChannels.add(idMatch[1]);
                    capturingChannel = false;
                }
            }

            // --- 2. MANEJO DE PROGRAMAS ---
            if (cleanLine.includes("<programme")) {
                const channelMatch = cleanLine.match(/channel="([^"]+)"/);
                if (channelMatch && TARGET_IDS.includes(channelMatch[1])) {
                    currentProgChannel = channelMatch[1];
                    // IMPORTANTE: Ya NO aplicamos el replace de hora porque esta fuente ya está bien
                    programmesPart += `  ${cleanLine}\n`;
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

        // --- CONSTRUCCIÓN DEL XML ---
        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        finalXml += channelsPart;
        finalXml += programmesPart;
        finalXml += `</tv>`; 

        fs.writeFileSync(outputPath, finalXml, 'utf8');
        
        console.log("---------------------------------------");
        console.log(`✅ ¡GUÍA GENERADA CON ÉXITO!`);
        console.log(`📺 Canales procesados: ${foundChannels.size}`);
        console.log(`📂 Fuente: ${SOURCE_URL}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error General:", err.message);
    }
}

generateFinalEPG();
