const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws'); // Richiesto per connettersi a Twitch EventSub
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// 1. Configurazione Socket.io per parlare con l'Overlay React in tempo reale
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Consente le connessioni dall'iframe di Twitch
        methods: ["GET", "POST"]
    }
});

// 2. Connessione sicura a Redis (Upstash)
const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: { tls: true, rejectUnauthorized: false }
});
redisClient.on('error', err => console.error('❌ Errore client Redis:', err));
redisClient.connect().then(() => console.log('✅ Connesso a Redis.'));

// Buffer RAM temporaneo (Svuotamento ogni 60 secondi per risparmiare chiamate Redis)
let ramChatBuffer = {};

// Endpoint per UptimeRobot
app.get('/ping', (req, res) => {
    console.log(`[PING] Controllo ricevuto alle ore: ${new Date().toISOString()}`);
    res.status(200).send('Sto bene, sono sveglio!');
});

// =========================================================================
// INTERCETTAZIONE MESSAGGI CHAT DA TWITCH EVENTSUB (WEBSOCKETS)
// =========================================================================
// Colleghiamo il backend al server WebSocket locale della Twitch CLI o a quello reale di Twitch
const TWITCH_WEBSOCKET_URL = process.env.TWITCH_CLI_TESTING === 'true' 
    ? 'ws://localhost:8080/eventsub' // URL di test se stai simulando con Twitch CLI
    : 'wss://eventsub.wss.twitch.tv/ws'; // URL ufficiale di produzione

function connettiAEventSub() {
    const wsTwitch = new WebSocket(TWITCH_WEBSOCKET_URL);

    wsTwitch.on('open', () => {
        console.log('🔌 Connesso al server EventSub di Twitch (In attesa di messaggi)...');
    });

    wsTwitch.on('message', (data) => {
        const payload = JSON.parse(data.toString());

        // Gestione dell'evento di arrivo messaggio in chat
        if (payload.metadata && payload.metadata.message_type === 'notification') {
            const eventData = payload.event;
            
            // Filtro di sicurezza: Ignora i messaggi dei bot definiti
            const BANNED_BOTS = ['nightbot', 'streamelements', 'moobot', 'wizebot'];
            if (BANNED_BOTS.includes(eventData.chatter_user_login.toLowerCase())) return;

            // Prepariamo l'oggetto messaggio pulito per l'Overlay React
            const messaggioPulito = {
                id: payload.metadata.message_id,
                displayName: eventData.chatter_user_name,
                username: eventData.chatter_user_login,
                text: eventData.message.text,
                badges: eventData.badges || {},
                roles: {
                    moderator: eventData.badges?.some(b => b.set_id === 'moderator') || false,
                    vip: eventData.badges?.some(b => b.set_id === 'vip') || false,
                    subscriber: eventData.badges?.some(b => b.set_id === 'subscriber') || false,
                    ordinary: !eventData.badges || eventData.badges.length === 0
                }
            };

            // Spediamo IMMEDIATAMENTE il messaggio a React via Socket.io per mostrarlo a schermo
            io.emit('nuovo_messaggio_chat', messaggioPulito);

            // Se il messaggio è un comando (es. inizia con !), accumuliamo il punteggio in RAM
            if (messaggioPulito.text.startsWith('!')) {
                accumulaPuntiInRam(eventData.broadcaster_user_id, messaggioPulito.username, 10);
            }
        }
    });

    wsTwitch.on('close', () => {
        console.log('⚠️ Connessione EventSub interrotta. Riconnessione tra 5 secondi...');
        setTimeout(connettiAEventSub, 5000);
    });
}

// Avvia la connessione all'ascolto della chat
connettiAEventSub();

function accumulaPuntiInRam(channelId, username, punti) {
    if (!ramChatBuffer[channelId]) ramChatBuffer[channelId] = {};
    if (!ramChatBuffer[channelId][username]) ramChatBuffer[channelId][username] = 0;
    ramChatBuffer[channelId][username] += punti;
}

// Svuotamento della RAM su Redis ogni 60 secondi (Risparmio chiamate)
const TIMER_BATCH_MS = 60000;
async function svuotaRamSuRedis() {
    const canali = Object.keys(ramChatBuffer);
    if (canali.length === 0) return;
    for (const channelId of canali) {
        const utenti = Object.keys(ramChatBuffer[channelId]);
        for (const user of utenti) {
            await redisClient.zIncrBy(`leaderboard:${channelId}`, ramChatBuffer[channelId][user], user);
        }
    }
    ramChatBuffer = {};
    console.log('✅ Batch RAM -> Redis completato.');
}
const intervalloRegolare = setInterval(svuotaRamSuRedis, TIMER_BATCH_MS);

// Graceful Shutdown (Salvataggio dati prima dello spegnimento di Render)
process.on('SIGTERM', async () => {
    clearInterval(intervalloRegolare);
    await svuotaRamSuRedis();
    await redisClient.quit();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🚀 EBS in ascolto sulla porta ${PORT}`));