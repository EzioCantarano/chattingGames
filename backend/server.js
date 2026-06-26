const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connessione a Redis
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', err => console.error('Errore client Redis:', err));
redisClient.connect().then(() => console.log('✅ Connesso a Redis con successo.'));

// 2. Buffer temporaneo in RAM (Per non consumare le chiamate Redis)
let ramChatBuffer = {
    // Struttura interna: { channelId: { username: punteggioAccumulato } }
};

// 3. Endpoint di Health Check per UptimeRobot (Evita lo standby di Render)
// Sostituisci la vecchia rotta /ping con questa:
app.get('/ping', (req, res) => {
    // Questo comando costringerà Render a scrivere sui log di sistema
    console.log(`[PING] Richiesta di controllo ricevuta alle ore: ${new Date().toISOString()}`);
    res.status(200).send('Sto bene, sono sveglio!');
});

// 4. Middleware per verificare i JWT di Twitch (Sicurezza)
const secret = Buffer.from(process.env.TWITCH_EXTENSION_SECRET || 'CHIAVE_PROVVISORIA_TEST', 'base64');
function verificaTwitchToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token non valido' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, secret);
        req.twitchData = payload; // Contiene channel_id e ruolo
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token alterato o scaduto' });
    }
}

// 5. API per lo Streamer: Salva Configurazione della Chat (Scrittura immediata su Redis)
app.post('/api/config/:channelId', verificaTwitchToken, async (req, res) => {
    const { channelId } = req.params;
    const configData = req.body;

    try {
        // Salva l'intera configurazione come stringa JSON associata al canale
        await redisClient.set(`config:${channelId}`, JSON.stringify(configData));
        res.status(200).json({ status: 'success', message: 'Configurazione salvata su Redis' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. API per leggere la configurazione della chat (Usata dall'Overlay al caricamento)
app.get('/api/config/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const data = await redisClient.get(`config:${channelId}`);
        if (!data) {
            // Configurazione di default se il canale non ha mai salvato nulla
            return res.json({ chat_abilitata: true, mostra_emotes: true, durata_messaggio_secondi: 8, nascondi_bot: true });
        }
        res.json(JSON.json(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Funzione che simula la ricezione di un comando chat valido da EventSub
// Invece di scrivere subito su Redis, accumula i dati nella RAM
function riceviComandoChat(channelId, username, puntiOttenuti) {
    if (!ramChatBuffer[channelId]) {
        ramChatBuffer[channelId] = {};
    }
    if (!ramChatBuffer[channelId][username]) {
        ramChatBuffer[channelId][username] = 0;
    }
    
    // Accumulo nella RAM del server
    ramChatBuffer[channelId][username] += puntiOttenuti;
    console.log(`[RAM BUFFER] Accumulati ${puntiOttenuti} punti per ${username} sul canale ${channelId}`);
}

// 8. TIMER PERIODICO (Ogni 20 secondi): Svuota la RAM ed esegue il Batch su Redis
setInterval(async () => {
    const canaliDaAggiornare = Object.keys(ramChatBuffer);
    if (canaliDaAggiornare.length === 0) return;

    console.log('🔄 Avvio sincronizzazione RAM -> Redis (Batch)...');
    
    // Usiamo una pipeline o esecuzioni multiple concentrate
    for (const channelId of canaliDaAggiornare) {
        const utenti = Object.keys(ramChatBuffer[channelId]);
        
        for (const username of utenti) {
            const puntiDaAggiungere = ramChatBuffer[channelId][username];
            
            // Incrementa il punteggio su Redis all'interno della classifica (Sorted Set) del canale
            // Questo comando consuma solo 1 chiamata Redis per utente attivo ogni 20 secondi!
            await redisClient.zIncrBy(`leaderboard:${channelId}`, puntiDaAggiungere, username);
        }
    }

    // Svuota completamente il buffer RAM per i prossimi 20 secondi
    ramChatBuffer = {};
    console.log('✅ Sincronizzazione completata. RAM svuotata.');
}, 30000); // 20000 millisecondi = 20 secondi


// Avvio Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 EBS Server in esecuzione sulla porta ${PORT}`);
});