const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

async function scanNewIDs() {
    const url = "https://iptv-epg.org/files/epg-ec.xml.gz";
    console.log("Searching IDs in iptv-epg.org...");

    try {
        const response = await axios({ method: 'get', url: url, responseType: 'stream' });
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

        for await (const line of rl) {
            if (line.includes("<channel id=")) {
                // Esto nos mostrará el ID exacto
                const match = line.match(/id="([^"]+)"/);
                if (match) console.log("✅ ID Encontrado:", match[1]);
            }
        }
    } catch (e) { console.error("Error:", e.message); }
}

scanNewIDs();
