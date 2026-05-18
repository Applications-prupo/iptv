const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 CONFIGURACIÓN DE FILTROS POR FUENTE (Basado en tu captura)
const PREFERIDOS_NUEVOS = ["Ecuavisa.ec", "EcuadorTV.ec", "Gamavision.ec"]; 

const OTROS_EPGSHARE = [
    "Canal.TC.TelevisiÃ³n.ec",
    "Canal.RTS.ec",
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

// 🔗 FUENTES DE DATOS CON ETIQUETAS DE TIPO
const SOURCES = [
    { url: "https://iptv-epg.org/files/epg-ec.xml.gz", type: "NUEVA" },
    { url: "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz", type: "GENERAL" }
];

async function generateFinalEPG() {
    const outputPath = path.join(__dirname, "epg.xml");
    
    console.log("🚀 Iniciando extracción Multi-Fuente con prioridades y ajuste horario...");

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

                for await (const line of rl) {
                    const cleanLine = line.trim();

                    // 1. Manejo de Canales (Filtro por tipo de fuente)
                    if (cleanLine.includes("<channel")) {
                        const idMatch = cleanLine.match(/id="([^"]+)"/);
                        if (idMatch) {
                            const id = idMatch[1];
                            const esValido = (source.type === "NUEVA" && PREFERIDOS_NUEVOS.includes(id)) ||
                                           (source.type === "GENERAL" && OTROS_EPGSHARE.includes(id));

                            if (esValido && !foundChannels.has(id)) {
                                if (cleanLine.includes("/>") || cleanLine.includes("</channel>")) {
                                    channelsPart += `  ${cleanLine}\n`;
                                } else {
                                    channelsPart += `  ${cleanLine}</channel>\n`;
                                }
                                foundChannels.add(id);
                            }
                        }
                    }

                    // 2. Manejo de Programas (Memoria de canal + Ajuste de Hora Selectivo)
                    if (cleanLine.includes("<programme")) {
                        const channelMatch = cleanLine.match(/channel="([^"]+)"/);
                        if (channelMatch) {
                            const chanId = channelMatch[1];
                            const esValidoProg = (source.type === "NUEVA" && PREFERIDOS_NUEVOS.includes(chanId)) ||
                                               (source.type === "GENERAL" && OTROS_EPGSHARE.includes(chanId));

                            if (esValidoProg) {
                                currentProgChannel = chanId;
                                
                                let fixedLine = cleanLine;
                                // 🕒 SOLO ajustamos la hora si la fuente es GENERAL (EPGShare)
                                // La fuente NUEVA ya viene correcta para Ecuador.
                                if (source.type === "GENERAL") {
                                    fixedLine = cleanLine.replace(/(\+|\-)\d{4}/g, "-0500");
                                }

                                programmesPart += `  ${fixedLine}\n`;
                            } else {
                                currentProgChannel = null;
                            }
                        }
                    } else if (currentProgChannel) {
                        programmesPart += `  ${cleanLine}\n`;
                        if (cleanLine.includes("</programme>")) {
                            currentProgChannel = null;
                        }
                    }
                }
            } catch (sourceError) {
                console.error(`⚠️ Error en fuente ${source.url}: ${sourceError.message}`);
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
