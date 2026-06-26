const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// 1. CONNESSIONE A REDIS (Configurata per Upstash con SSL/TLS obbligatorio)
// =========================================================================
const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
        tls: true,                  // Forza l'uso di SSL/TLS richiesto da Upstash
        rejectUnauthorized: false    // Evita blocchi sui certificati cloud di Render/Upstash
    }
});

redisClient.on('error', err => console.error('❌ Errore client Redis:', err));
redisClient.connect().then(() => console.log('✅ Connesso a Redis con successo.'));

// =========================================================================
// 2. BUFFER TEMPORANEO IN RAM (Ottimizzazione per non consumare le 500k chiamate)
// =========================================================================
let ramChatBuffer = {
    // Struttura dati interna: { channelId: { username: punteggioAccumulato } }
};

// =========================================================================
// 3. ENDPOINT DI HEALTH CHECK (Per UptimeRobot con Log Visivo Obbligatorio)
// =========================================================================
app.get('/ping', (req, res) => {
    // Questo comando costringerà Render a scrivere visibilmente sui log di sistema ad ogni ping
    console.log(`[PING] Richiesta di controllo ricevuta alle ore: ${new Date().toISOString()}`);
    res.status(200).send('Sto bene, sono sveglio!');
});

// =========================================================================
// 4. MIDDLEWARE DI AUTENTICAZIONE JWT TWITCH (Sicurezza Canale/Streamer)
// =========================================================================
const secret = Buffer.from(process.env.TWITCH_EXTENSION_SECRET || 'CHIAVE_PROVVISORIA_TEST', 'base64');

function verificaTwitchToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token non valido o mancante' });
    }
    const token = authHeader.split(' ')[1]; // Estrae il token effettivo dopo "Bearer"
    try {
        const payload = jwt.verify(token, secret);
        req.twitchData = payload; // Contiene channel_id, user_id e il ruolo (broadcaster, viewer, ecc.)
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token alterato o scaduto' });
    }
}

// =========================================================================
// 5. API DI CONFIGURAZIONE (Salvataggio e Lettura Impostazioni Chat da Redis)
// =========================================================================

// Salva la configurazione dello Streamer (Scrittura immediata su Redis al click "Salva")
app.post('/api/config/:channelId', verificaTwitchToken, async (req, res) => {
    const { channelId } = req.params;
    const configData = req.body;

    // Controllo di sicurezza aggiuntivo: solo il proprietario del canale può configurare
    if (req.twitchData.role !== 'broadcaster' && req.twitchData.channel_id !== channelId) {
        return res.status(403).json({ error: 'Accesso negato: non sei lo streamer di questo canale' });
    }

    try {
        await redisClient.set(`config:${channelId}`, JSON.stringify(configData));
        res.status(200).json({ status: 'success', message: 'Configurazione salvata su Redis' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legge la configurazione della chat (Usata dall'Overlay React al primo avvio)
app.get('/api/config/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const data = await redisClient.get(`config:${channelId}`);
        if (!data) {
            // Valori di default provvisori se lo streamer non ha ancora configurato nulla
            return res.json({ chat_abilitata: true, mostra_emotes: true, durata_messaggio_secondi: 8, nascondi_bot: true });
        }
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// 6. LOGICA DI LOGISTICA DATI: ACCUMULO IN RAM E SVUOTAMENTO BATCH (1 MINUTO)
// =========================================================================
const TIMER_BATCH_MS = 1200000; // Sincronizzazione programmata ogni 60 secondi (1 minuto)

// Funzione centralizzata per svuotare la RAM e scrivere massivamente su Redis
async function svuotaRamSuRedis() {
    const canaliDaAggiornare = Object.keys(ramChatBuffer);
    if (canaliDaAggiornare.length === 0) return;

    console.log('🔄 Avvio sincronizzazione RAM -> Redis (Batch Minuto)...');
    
    for (const channelId of canaliDaAggiornare) {
        const utenti = Object.keys(ramChatBuffer[channelId]);
        
        for (const username of utenti) {
            const puntiDaAggiungere = ramChatBuffer[channelId][username];
            try {
                // Incrementa il punteggio all'interno della classifica (Sorted Set) di Redis per quel canale
                await redisClient.zIncrBy(`leaderboard:${channelId}`, puntiDaAggiungere, username);
            } catch (err) {
                console.error(`❌ Errore di scrittura su Redis per l'utente ${username}:`, err);
            }
        }
    }

    // Resetta completamente il buffer in RAM del server per il minuto successivo
    ramChatBuffer = {};
    console.log('✅ Sincronizzazione completata con successo. RAM svuotata.');
}

// Funzione interna provvisoria (da collegare a EventSub) per intercettare i punti dei comandi della chat
function riceviComandoChat(channelId, username, puntiOttenuti) {
    if (!ramChatBuffer[channelId]) {
        ramChatBuffer[channelId] = {};
    }
    if (!ramChatBuffer[channelId][username]) {
        ramChatBuffer[channelId][username] = 0;
    }
    
    // Accumula il punteggio nella RAM locale senza disturbare Redis
    ramChatBuffer[channelId][username] += puntiOttenuti;
    console.log(`[RAM BUFFER] Memorizzati temporaneamente ${puntiOttenuti} punti per ${username}`);
}

// Attiva l'intervallo di svuotamento regolare ogni 60 secondi
const intervalloRegolare = setInterval(svuotaRamSuRedis, TIMER_BATCH_MS);

// =========================================================================
// 7. INTERCETTAZIONE SEGNALE DI SPEGNIMENTO (Graceful Shutdown)
// =========================================================================
process.on('SIGTERM', async () => {
    console.log('⚠️ Ricevuto segnale SIGTERM da Render. Preparazione allo spegnimento del server...');
    
    // Ferma il timer standard per evitare collisioni o doppie scritture
    clearInterval(intervalloRegolare);
    
    // Forza l'immediato salvataggio dei punti accumulati nell'ultimo frammento di minuto su Redis
    console.log('💾 Salvataggio di emergenza dei dati in RAM su Redis prima della chiusura...');
    await svuotaRamSuRedis();
    
    // Disconnette il client Redis in modo pulito
    try {
        await redisClient.quit();
        console.log('🔌 Collegamento Redis interrotto correttamente.');
    } catch (err) {
        console.error('Errore durante la chiusura di Redis:', err);
    }

    console.log('👋 Spegnimento completato. Il processo Node.js si interrompe ora.');
    process.exit(0);
});

// =========================================================================
// 8. AVVIO DEL SERVER EXPRESS
// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 EBS Server in esecuzione e protetto sulla porta ${PORT}`);
});