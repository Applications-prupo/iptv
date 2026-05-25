const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs EXACTOS PARA EL FILTRADO
const TARGET_IDS = [
    "Ecuavisa.ec", 
    "Teleamazonas.ec", 
    "RTS.ec",
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

// 🌐 UNIFICADO: Logos y Programación salen del mismo servidor seguro
const SOURCE_LOGOS = "https://iptv-epg.org/files/epg-ec.xml.gz";
const SOURCE_PROG = "https://iptv-epg.org/files/epg-ec.xml.gz"; 

async function generatePremiumIPTV() {
    const inputM3UPath = path.join(__dirname, "..", "ec.m3u"); // Busca 'ec.m3u' una carpeta hacia afuera
    const outputM3UPath = path.join(__dirname, "lista_perfecta.m3u"); // La lista automática con logos
    const outputXMLPath = path.join(__dirname, "epg.xml"); // Tu guía premium
    
    console.log("🚀 Iniciando Sistema Auto-Inyector M3U + EPG Premium (VERSIÓN HORA ORIGINAL)...");

    if (!fs.existsSync(inputM3UPath)) {
        console.error(`❌ ERROR: No encontré el archivo 'ec.m3u' afuera de esta carpeta.`);
        return;
    }

    try {
        let logoMap = new Map();
        let channelNames = new Map();

        // 🛠️ PASO 1: MAPEAR LOGOS Y NOMBRES DESDE IPTV-EPG
        console.log(`📥 1/2 Extrayendo base de datos y nombres desde: ${SOURCE_LOGOS}`);
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
                        logoMap.set(currentId, logoMap.get(currentId));
                        logoMap.set(currentId, logoMatch[1]);
                        if (currentName) channelNames.set(currentId, currentName);
                    }
                }
            }
            if (cleanLine.includes("</channel>")) { currentId = null; currentName = ""; }
        }

        // 🛠️ PASO 2: INYECTAR LOGOS AUTOMÁTICAMENTE EN TU LISTA M3U
        console.log(`✍️ Procesando M3U e inyectando logos automáticos...`);
        const m3uContent = fs.readFileSync(inputM3UPath, "utf8");
        const m3uLines = m3uContent.split(/\r?\n/);
        let finalM3ULines = [];

        for (let i = 0; i < m3uLines.length; i++) {
            let line = m3uLines[i];

            if (line.startsWith("#EXTINF:")) {
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                if (idMatch) {
                    const tvgId = idMatch[1];
                    if (logoMap.has(tvgId) && !line.includes('tvg-logo="https://i.imgur.com/')) {
                        const logoUrl = logoMap.get(tvgId);
                        if (line.includes("tvg-logo=")) {
                            line = line.replace(/tvg-logo="[^"]*"/, `tvg-logo="${logoUrl}"`);
                        } else {
                            line = line.replace(/tvg-id=/, `tvg-logo="${logoUrl}" tvg-id=`);
                        }
                    }
                }
            }
            finalM3ULines.push(line);
        }
        fs.writeFileSync(outputM3UPath, finalM3ULines.join("\n"), "utf8");

        // 🛠️ PASO 3: EXTRAER PROGRAMACIÓN (EPG) MANTENIENDO EL TIEMPO ORIGINAL
        console.log(`📥 2/2 Sincronizando programación horaria limpia (Sin alteraciones)...`);
        let channelsPart = "";
        let programmesPart = "";

        const responseProg = await axios({ method: 'get', url: SOURCE_PROG, responseType: 'stream', timeout: 30000 });
        const gunzipProg = zlib.createGunzip();
        const rlProg = readline.createInterface({ input: responseProg.data.pipe(gunzipProg), terminal: false });

        let currentProgChannel = null;

        for await (const line of rlProg) {
            const cleanLine = line.trim();
            if (cleanLine.includes("<programme")) {
                const channelMatch = cleanLine.match(/channel="([^"]+)"/);
                if (channelMatch && TARGET_IDS.includes(channelMatch[1])) {
                    currentProgChannel = channelMatch[1];
                    // 🌍 Pasa el horario limpio y original sin alterarlo
                    programmesPart += `  ${cleanLine}\n`;
                } else { currentProgChannel = null; }
            } else if (currentProgChannel) {
                programmesPart += `  ${cleanLine}\n`;
                if (cleanLine.includes("</programme>")) { currentProgChannel = null; }
            }
        }

        // Estructurar Canales XML con los nombres limpios de la URL
        TARGET_IDS.forEach(id => {
            const name = channelNames.has(id) ? channelNames.get(id) : id.replace(".ec", "").replace("Canal.", "");
            channelsPart += `  <channel id="${id}">\n    <display-name>${name}</display-name>\n`;
            if (logoMap.has(id)) channelsPart += `    <icon src="${logoMap.get(id)}" />\n`;
            channelsPart += `  </channel>\n`;
        });

        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${channelsPart}${programmesPart}</tv>`;
        fs.writeFileSync(outputXMLPath, finalXml, 'utf8');

        console.log("═══════════════════════════════════════════════");
        console.log("✅ ¡PROCESO COMPLETADO CON HORA ORIGINAL!");
        console.log(`📂 M3U Generado: 'lista_perfecta.m3u'`);
        console.log(`📂 EPG Generado: 'epg.xml'`);
        console.log("═══════════════════════════════════════════════");

    } catch (err) {
        console.error("❌ Error General en el Proceso:", err.message);
    }
}

generatePremiumIPTV();
