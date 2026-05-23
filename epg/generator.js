const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs EXACTOS DE TU M3U
const TARGET_IDS = [
    "Ecuavisa.ec", 
    "Teleamazonas.ec", 
    "Canal.RTS.ec",
    "Canal.ESNE.TV.ec",
    "Canal.TC.TelevisiÃ³n.ec",
    "RTU.ec",
    "Canal.Ecuador.TV.ec",
    "Canal.Ecuavisa.(Ecuador).ec",
    "OromarTV.ec",
    "Canal.ESPN.2.(Ecuador).ec",
    "Canal.DW.(LatinoamÃ©rica).ec",
    "Canal.Discovery.Science.(LatinoamÃ©rica).ec",
    "Canal.Discovery.Turbo.(LatinoamÃ©rica).ec",
    "Canal.Animal.Planet.(Ecuador).ec",
    "Canal.TLC.(Ecuador).ec"
];

// 🔗 FUENTES DE DATOS
const SOURCE_LOGOS = "https://iptv-epg.org/files/epg-ec.xml.gz";
const SOURCE_PROG = "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz";

async function generateFinalEPG() {
    const outputPath = path.join(__dirname, "epg.xml");
    console.log("🚀 Iniciando Extractor Inteligente (Fusión Perfecta de Logos + Programación)...");

    try {
        let logoMap = new Map(); // Guardará ID -> URL del Logo
        let channelNames = new Map(); // Guardará ID -> Nombre del canal

        // 🛠️ PASO 1: EXTRAER LOGOS DE LA FUENTE "IPTV-EPG"
        console.log(`📥 1/2 Buscando logos en: ${SOURCE_LOGOS}`);
        try {
            const response = await axios({ method: 'get', url: SOURCE_LOGOS, responseType: 'stream', timeout: 30000 });
            const gunzip = zlib.createGunzip();
            const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

            let currentId = null;
            let currentName = "";

            for await (const line of rl) {
                const cleanLine = line.trim();
                
                if (cleanLine.includes("<channel")) {
                    const idMatch = cleanLine.match(/id="([^"]+)"/);
                    currentId = idMatch ? idMatch[1] : null;
                }
                
                if (currentId && TARGET_IDS.includes(currentId)) {
                    if (cleanLine.includes("<display-name")) {
                        const nameMatch = cleanLine.match(/>([^<]+)</);
                        if (nameMatch) currentName = nameMatch[1];
                    }
                    if (cleanLine.includes("<icon")) {
                        const logoMatch = cleanLine.match(/src="([^"]+)"/);
                        if (logoMatch) {
                            logoMap.set(currentId, logoMatch[1]);
                            if (currentName) channelNames.set(currentId, currentName);
                        }
                    }
                }

                if (cleanLine.includes("</channel>")) {
                    currentId = null;
                    currentName = "";
                }
            }
        } catch (e) {
            console.error("⚠️ Nota: Hubo un problema temporal leyendo los logos, se usarán datos básicos.", e.message);
        }

        // Asegurar nombres mínimos por si acaso
        TARGET_IDS.forEach(id => {
            if (!channelNames.has(id)) channelNames.set(id, id.replace(".ec", ""));
        });

        // 🛠️ PASO 2: EXTRAER PROGRAMACIÓN DE "EPGSHARE" Y ARMAR EL XML
        console.log(`📥 2/2 Extrayendo programación y aplicando -0500 de: ${SOURCE_PROG}`);
        
        let channelsPart = "";
        let programmesPart = "";

        const responseProg = await axios({ method: 'get', url: SOURCE_PROG, responseType: 'stream', timeout: 30000 });
        const gunzipProg = zlib.createGunzip();
        const rlProg = readline.createInterface({ input: responseProg.data.pipe(gunzipProg), terminal: false });

        let currentProgChannel = null;

        for await (const line of rlProg) {
            const cleanLine = line.trim();

            // Capturar bloques de programas
            if (cleanLine.includes("<programme")) {
                const channelMatch = cleanLine.match(/channel="([^"]+)"/);
                if (channelMatch && TARGET_IDS.includes(channelMatch[1])) {
                    currentProgChannel = channelMatch[1];
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

        // 🛠️ PASO 3: CONSTRUIR LA SECCIÓN DE CANALES CON LOS LOGOS INYECTADOS TRAS EL FILTRADO
        TARGET_IDS.forEach(id => {
            channelsPart += `  <channel id="${id}">\n`;
            channelsPart += `    <display-name>${channelNames.get(id)}</display-name>\n`;
            if (logoMap.has(id)) {
                channelsPart += `    <icon src="${logoMap.get(id)}" />\n`;
            }
            channelsPart += `  </channel>\n`;
        });

        // Generación final del archivo
        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
        finalXml += channelsPart;
        finalXml += programmesPart;
        finalXml += `</tv>`;

        fs.writeFileSync(outputPath, finalXml, 'utf8');

        console.log("---------------------------------------");
        console.log(`✅ ¡EPG MAESTRO GENERADO CORRECTAMENTE!`);
        console.log(`📺 Canales procesados con éxito: ${TARGET_IDS.length}`);
        console.log(`🖼️ Logos inyectados desde la otra fuente: ${logoMap.size}`);
        console.log(`📂 Guardado listo en: ${outputPath}`);
        console.log("---------------------------------------");

    } catch (err) {
        console.error("❌ Error Crítico General:", err.message);
    }
}

generateFinalEPG();
