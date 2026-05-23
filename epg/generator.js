const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 LISTA DE IDs EXACTOS PARA EL FILTRADO
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

const SOURCE_LOGOS = "https://iptv-epg.org/files/epg-ec.xml.gz";
const SOURCE_PROG = "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz";

async function generatePremiumIPTV() {
    const inputM3UPath = path.join(__dirname, "..", "ec.m3u"); // Busca 'ec.m3u' una carpeta hacia afuera
    const outputM3UPath = path.join(__dirname, "lista_perfecta.m3u"); // La lista automática con logos
    const outputXMLPath = path.join(__dirname, "epg.xml"); // Tu guía premium
    
    console.log("🚀 Iniciando Sistema Auto-Inyector M3U + EPG Premium...");

    if (!fs.existsSync(inputM3UPath)) {
        console.error(`❌ ERROR: No encontré el archivo 'lista_origen.m3u' en esta carpeta.`);
        console.error(`👉 Por favor, guarda tu lista actual con ese nombre exacto aquí.`);
        return;
    }

    try {
        let logoMap = new Map();
        let channelNames = new Map();

        // 🛠️ PASO 1: MAPEAR LOGOS DESDE IPTV-EPG
        console.log(`📥 1/3 Extrayendo base de datos de logos de: ${SOURCE_LOGOS}`);
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
            if (cleanLine.includes("</channel>")) { currentId = null; currentName = ""; }
        }

        // 🛠️ PASO 2: INYECTAR LOGOS AUTOMÁTICAMENTE EN TU LISTA M3U
        console.log(`✍️ 2/3 Procesando M3U e inyectando logos automáticos...`);
        const m3uContent = fs.readFileSync(inputM3UPath, "utf8");
        const m3uLines = m3uContent.split(/\r?\n/);
        let finalM3ULines = [];

        for (let i = 0; i < m3uLines.length; i++) {
            let line = m3uLines[i];

            if (line.startsWith("#EXTINF:")) {
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                if (idMatch) {
                    const tvgId = idMatch[1];
                    
                    // Si el canal tiene un logo premium asignado y NO es uno de tus Ecuavisa manuales
                    if (logoMap.has(tvgId) && !line.includes('tvg-logo="https://i.imgur.com/')) {
                        const logoUrl = logoMap.get(tvgId);
                        
                        // Si ya tenía la etiqueta tvg-logo vieja, la reemplazamos. Si no, la agregamos.
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

        // 🛠️ PASO 3: EXTRAER PROGRAMACIÓN (EPG)
        console.log(`📥 3/3 Sincronizando programación horaria real (-0500)...`);
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
                    let fixedLine = cleanLine.replace(/(\+|\-)\d{4}/g, "-0500");
                    programmesPart += `  ${fixedLine}\n`;
                } else { currentProgChannel = null; }
            } else if (currentProgChannel) {
                programmesPart += `  ${cleanLine}\n`;
                if (cleanLine.includes("</programme>")) { currentProgChannel = null; }
            }
        }

        // Estructurar Canales XML
        TARGET_IDS.forEach(id => {
            const name = channelNames.has(id) ? channelNames.get(id) : id.replace(".ec", "");
            channelsPart += `  <channel id="${id}">\n    <display-name>${name}</display-name>\n`;
            if (logoMap.has(id)) channelsPart += `    <icon src="${logoMap.get(id)}" />\n`;
            channelsPart += `  </channel>\n`;
        });

        let finalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${channelsPart}${programmesPart}</tv>`;
        fs.writeFileSync(outputXMLPath, finalXml, 'utf8');

        console.log("═══════════════════════════════════════════════");
        console.log("✅ ¡PROCESO DE LUJO COMPLETADO!");
        console.log(`📂 M3U Actualizado: 'lista_perfecta.m3u' (Súbelo a tu GitHub)`);
        console.log(`📂 EPG Actualizado: 'epg.xml' (Súbelo a tu GitHub)`);
        console.log("═══════════════════════════════════════════════");

    } catch (err) {
        console.error("❌ Error General en el Proceso:", err.message);
    }
}

generatePremiumIPTV();
