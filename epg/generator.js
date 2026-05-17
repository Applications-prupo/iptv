const fs = require("fs");
const path = require("path");
const axios = require("axios");
const zlib = require("zlib"); // 👈 Esto ya funciona sin instalar nada
const readline = require("readline");

// 📡 LISTA DE IDs (Aquí puedes añadir todos los que quieras de las fuentes)
const TARGET_IDS = [
    "Ecuavisa.ec", "Ecuavisa", "Ecuavisa_HD",
    "Teleamazonas.ec", "Teleamazonas", "Teleamazonas_HD",
    "TCTelevision.ec", "TC_Television",
    "RTS.ec", "RTS",
    "HBO.us", "HBO",
    "ESPN.us", "ESPN",
    "TNT.ar", "TNT"
];

const SOURCES = [
    "https://epgshare01.online/epgshare01/epg_ripper_EC1.xml.gz", // Ecuador específico
    "http://epg.one/epg2.xml.gz" // Global
];

async function runGenerator() {
    const outputPath = path.join(__dirname, "epg.xml");
    const tempFile = path.join(__dirname, "filtrado.tmp");
    const outputStream = fs.createWriteStream(tempFile);

    outputStream.write(`<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`);

    console.log("🚀 Iniciando generador de alta velocidad...");

    for (const url of SOURCES) {
        try {
            console.log(`📥 Procesando fuente: ${url}`);
            
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                timeout: 30000,
                headers: { 'Accept-Encoding': 'gzip' } // Ayuda a que la descarga sea más fluida
            });

            const gunzip = zlib.createGunzip();
            const rl = readline.createInterface({
                input: response.data.pipe(gunzip),
                terminal: false
            });

            let inProg = false;
            let currentBlock = "";

            for await (const line of rl) {
                // Capturar canales
                if (line.includes("<channel")) {
                    if (TARGET_IDS.some(id => line.includes(`id="${id}"`))) {
                        outputStream.write(line + "\n");
                    }
                }

                // Capturar programas
                if (line.includes("<programme")) {
                    if (TARGET_IDS.some(id => line.includes(`channel="${id}"`))) {
                        inProg = true;
                        currentBlock = line + "\n";
                    }
                } else if (inProg) {
                    currentBlock += line + "\n";
                    if (line.includes("</programme>")) {
                        outputStream.write(currentBlock);
                        inProg = false;
                        currentBlock = "";
                    }
                }
            }
        } catch (err) {
            console.error(`⚠️ Omitiendo fuente por error: ${err.message}`);
        }
    }

    outputStream.write(`</tv>`);
    outputStream.end();

    outputStream.on('finish', () => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        fs.renameSync(tempFile, outputPath);
        console.log("-----------------------------------------");
        console.log("✅ ¡GUÍA GENERADA CON ÉXITO!");
        console.log("-----------------------------------------");
    });
}

runGenerator();
