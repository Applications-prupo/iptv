const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA COMPLETA DE IDs QUE SE USARÁN PARA FILTRAR
const TARGET_IDS = [
    "Ecuavisa.ec", 
    "EcuadorTV.ec", 
    "Gamavision.ec", 
    "Teleamazonas.ec", 
    "RTS.ec", 
    "TCTelevision.ec", 
    "OromarTV.ec", 
    "RTU.ec",
    "Canal.TC.TelevisiÃ³n.ec",
    "Canal.RTS.ec",
    "Canal.Ecuador.TV.ec",
    "Canal.Ecuavisa.(Ecuador).ec",
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
    { url: "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz", type: "EPGSHARE" },
    { url: "https://iptv-epg.org/files/epg-ec.xml.gz", type: "NUEVA" }
];

async function generateFinalEPG() {
    const outputPath = path.join(__dirname, "epg.xml");
    
    console.log("🚀 Extrayendo EPG Premium (Horarios + Logos + Descripciones + Clasificación)...");

    try {
        let channelsPart = "";
        let programmesPart = "";
        let foundChannels = new Set();

        for (const source of SOURCES) {
            console.log(`📥 Procesando: ${source.url}`);
            try {
                const response = await axios({ method: 'get', url: source.url, responseType: 'stream', timeout: 30000 });
                const gunzip = zlib.createGunzip();
                const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

                let currentProgChannel = null;
                let currentChannelData = "";
                let capturingChannel = false;

                for await (const line of rl) {
                    const cleanLine = line.trim();

                    // --- 1. MANEJO DE CANALES Y LOGOS ---
                    if (cleanLine.includes("<channel")) {
                        const idMatch = cleanLine.match(/id="([^"]+)"/);
                        if (idMatch) {
                            const id = idMatch[1];

                            if (TARGET_IDS.includes(id)) {
                                capturingChannel = true;
                                currentChannelData = `  ${cleanLine}\n`;
                                
                                if (cleanLine.includes("</channel>") || cleanLine.includes("/>")) {
                                    if (!foundChannels.has(id)) {
                                        channelsPart += currentChannelData;
                                        foundChannels.add(id);
                                    }
                                    capturingChannel = false;
                                }
                            }
                        }
                    } else if (capturingChannel) {
                        currentChannelData += `    ${cleanLine}\n`;
                        if (cleanLine.includes("</channel>")) {
                            const idMatch = currentChannelData.match(/id="([^"]+)"/);
                            if (idMatch && !foundChannels.has(idMatch[1])) {
                                channelsPart += currentChannelData;
                                foundChannels.add(idMatch[1]);
                            }
                            capturingChannel = false;
                        }
                    }

                    // --- 2. MANEJO DE PROGRAMACIÓN PREMIUM (Hora, Sinopsis y Rating) ---
                    if (source.type === "EPGSHARE" && cleanLine.includes("<programme")) {
                        const channelMatch = cleanLine.match(/channel="([^"]+)"/);
                        if (channelMatch && TARGET_IDS.includes(channelMatch[1])) {
                            currentProgChannel = channelMatch[1];
                            
                            // 🕒 Corrección horaria estricta de -0500 para Ecuador
                            let fixedLine = cleanLine.replace(/(\+|\-)\d{4}/g, "-0500");
                            programmesPart += `  ${fixedLine}\n`;
                        } else {
                            currentProgChannel = null;
                        }
                    } else if (source.type === "EPGSHARE" && currentProgChannel) {
                        // Dejamos pasar todo lo que esté dentro de <programme> (título, descripción, rating, etc.)
                        programmesPart += `  ${cleanLine}\n`;
                        if (cleanLine.includes("</programme>")) {
                            currentProgChannel = null;
                        }
                    }
                }
            } catch (sourceError) {
                console.error(`⚠️ Nota: No se pudo leer por completo la fuente: ${source.url}`);
            }
        }

        // --- CONSTRUCCIÓN DEL XML MAESTRO ---
        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        finalXml += channelsPart;
        finalXml += programmesPart;
        finalXml += `</tv>`; 

        fs.writeFileSync(outputPath, finalXml, 'utf8');
        
        console.log("---------------------------------------");
        console.log(`✅ ¡GUÍA PREMIUM GENERADA CON ÉXITO!`);
        console.log(`📺 Canales listos: ${foundChannels.size}`);
        console.log(`✨ Incluye: Logos, Descripciones y Clasificación de edad`);
        console.log(`📂 Guardado en: ${outputPath}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error Crítico General:", err.message);
    }
}

generateFinalEPG();
