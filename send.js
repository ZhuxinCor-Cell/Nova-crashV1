const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");

// Session disimpan di memory (tidak permanen, akan hilang jika function cold start)
let sock = null;
let credsState = null;

async function getSocket() {
    if (sock) return sock;
    
    const { state, saveCreds } = await useMultiFileAuthState("/tmp/session");
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["NOVA", "Chrome", "1.0.0"]
    });
    
    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("WhatsApp Connected");
        }
        if (connection === "close") {
            sock = null; // reset koneksi
        }
    });
    
    return sock;
}

module.exports = async (req, res) => {
    // Tambah CORS biar dashboard bisa panggil
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    
    try {
        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ 
                status: false, 
                error: "Nomor dan pesan wajib diisi" 
            });
        }
        
        const waSocket = await getSocket();
        
        // Kirim pesan
        await waSocket.sendMessage(number + "@s.whatsapp.net", {
            text: message
        });
        
        res.json({ status: true, message: "Pesan terkirim" });
        
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ 
            status: false, 
            error: error.message 
        });
    }
};