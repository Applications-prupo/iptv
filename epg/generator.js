const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

async function scanIDs() {
    // Usamos la fuente específica de Ecuador que es más pequeña
    const url = "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz";
    
    console.log("🔍 Escaneando IDs reales en EPGShare01 (Ecuador)...");

    try {
        const response = await axios({ method: 'get', url: url, responseType: 'stream' });
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

        console.log("--- LISTA DE CANALES ENCONTRADOS ---");
        for await (const line of rl) {
            if (line.includes("<channel id=")) {
                // Extraer lo que está entre comillas en id="..."
                const idMatch = line.match(/id="([^"]+)"/);
                const nameMatch = line.match(/<display-name>([^<]+)<\/display-name>/);
                
                if (idMatch) {
                    console.log(`🆔 ID: "${idMatch[1]}"  | 📺 Nombre: ${nameMatch ? nameMatch[1] : 'Desconocido'}`);
                }
            }
        }
        console.log("------------------------------------");
        console.log("✅ Escaneo finalizado.");
    } catch (err) {
        console.error("❌ Error al escanear:", err.message);
    }
}

scanIDs();
