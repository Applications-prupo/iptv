const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib");
const readline = require("readline");

// 📡 IDs MÁS COMUNES (He añadido variaciones para asegurar)
const TARGET_IDS = [
    "Ecuavisa", "Ecuavisa.ec", "Ecuavisa_EC", "EcuavisaHD",
    "Teleamazonas", "Teleamazonas.ec", "Teleamazonas_HD",
    "TC", "TCTelevision", "TC_Television",
    "RTS", "RTS.ec",
    "HBO", "HBO.us",
    "ESPN", "ESPN.us"
];

async function runGenerator() {
    const outputPath = path.join(__dirname, "epg.xml");
    const tempFile = path.join(__dirname, "filtrado.tmp");
    const outputStream = fs.createWriteStream(tempFile);

    outputStream.write(`<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`);

    console.log("🚀 Iniciando búsqueda flexible...");

    const SOURCES = [
        "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz",
        "http://epg.one/epg2.xml.gz"
    ];

    for (const url of SOURCES) {
        try {
            console.log(`📥 Escaneando fuente: ${url}`);
            const response = await axios({ method: 'get', url: url, responseType: 'stream', timeout: 30000 });
            const gunzip = zlib.createGunzip();
            const rl = readline.createInterface({ input: response.data.pipe(gunzip), terminal: false });

            let inProg = false;
            let currentBlock = "";
            let foundInThisSource = 0;

            for await (const line of rl) {
                // Buscamos si la línea contiene alguno de nuestros IDs
                const match = TARGET_IDS.find(id => line.includes(`id="${id}"`) || line.includes(`channel="${id}"`));

                if (line.includes("<channel") && match) {
                    outputStream.write(line + "\n");
                }

                if (line.includes("<programme") && match) {
                    inProg = true;
                    currentBlock = line + "\n";
                } else if (inProg) {
                    currentBlock += line + "\n";
                    if (line.includes("</programme>")) {
                        outputStream.write(currentBlock);
                        inProg = false;
                        currentBlock = "";
                        foundInThisSource++;
                    }
                }
            }
            console.log(`✅ Se extrajeron ${foundInThisSource} programas de esta fuente.`);
        } catch (err) {
            console.error(`⚠️ Error en fuente: ${err.message}`);
        }
    }

    outputStream.write(`</tv>`);
    outputStream.end();
    outputStream.on('finish', () => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        fs.renameSync(tempFile, outputPath);
        console.log("\n🏁 Proceso terminado. ¡Revisa el epg.xml ahora!");
    });
}

runGenerator();
