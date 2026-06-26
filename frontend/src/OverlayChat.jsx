import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Lista interna per escludere i bot noti se l'opzione è attiva
const KNOWN_BOTS = ['nightbot', 'streamelements', 'moobot', 'wizebot'];

export default function OverlayChat({ channelConfig, socketEvents }) {
  const [messages, setMessages] = useState([]);
  const maxMessagesVisible = 10; // Soglia per prevenire il flooding

  useEffect(() => {
    if (!channelConfig?.chat_abilitata) return;

    // Simulazione arrivo messaggio da WebSocket EBS (Sostituire con l'ascoltatore reale del tuo socket)
    const handleNewMessage = (msg) => {
      // Filtro dei bot
      if (channelConfig.nascondi_bot && KNOWN_BOTS.includes(msg.username.toLowerCase())) {
        return;
      }

      setMessages((prev) => {
        const updated = [...prev, msg];
        // Se superiamo la soglia di flooding, eliminiamo subito i messaggi più vecchi (in cima)
        if (updated.length > maxMessagesVisible) {
          updated.shift();
        }
        return updated;
      });

      // Timer di autodistruzione del messaggio singolo (es. 8 secondi)
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }, (channelConfig.durata_messaggio_secondi || 8) * 1000);
    };

    // Collega qui il tuo ricevitore di eventi socket
    // socket.on('message', handleNewMessage);
  }, [channelConfig]);

  // Ritorna il colore del bordo specifico richiesto per categoria utente
  const getUserBorderColor = (roles) => {
    if (roles.moderator) return 'border-green-500';
    if (roles.vip) return 'border-purple-600'; // Viola per VIP
    if (roles.subscriber) return 'border-blue-500'; // Blu per Sub
    return 'border-black'; // Nero classico per visitatori normali
  };

  // Funzione per formattare il testo renderizzando le emoticon di Twitch
  const renderMessageText = (text, emotes) => {
    if (!emotes) return text;
    // Logica di parsing delle emoticon basata sulle stringhe fornite dall'API di Twitch
    // Per brevità in questo blocco UI restituiamo il testo, ma qui si mappa la stringa convertendo gli ID in tag <img src="twitch-cdn" />
    return text; 
  };

  return (
    <div className="w-full h-full bg-transparent flex flex-col justify-end p-4 pointer-events-none select-none">
      {/* Contenitore messaggi orientato in colonna invertita per spingere i nuovi in basso */}
      <div className="w-80 flex flex-col gap-2 max-h-[500px] overflow-hidden">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }} // Dissolvenza in uscita
              layout
              className={`p-2 rounded-lg bg-twitch-chatBg border-2 ${getUserBorderColor(msg.roles)} shadow-md flex flex-col gap-1 pointer-events-auto`}
            >
              {/* Intestazione: Variante di colore chiaro del box */}
              <div className="bg-zinc-800/90 p-1 rounded flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-100">{msg.displayName}</span>
                {/* Contenitore dei Badge del canale */}
                <div className="flex gap-1">
                  {msg.badges && Object.keys(msg.badges).map((badge) => (
                    <span key={badge} className="px-1 py-0.5 bg-twitch-purple rounded text-[10px] text-white font-semibold uppercase">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              {/* Corpo del messaggio */}
              <p className="text-sm text-zinc-200 px-1 break-words">
                {renderMessageText(msg.text, msg.emotes)}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}