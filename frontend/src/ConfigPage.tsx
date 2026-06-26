import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Definizione delle interfacce per la sicurezza dei tipi di dati in TypeScript
interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
  roles: {
    moderator?: boolean;
    vip?: boolean;
    subscriber?: boolean;
    ordinary?: boolean;
  };
  badges: Record<string, string>;
}

interface ChannelConfig {
  chat_abilitata: boolean;
  durata_messaggio_secondi: number;
  nascondi_bot: boolean;
}

const BANNED_BOTS = ['nightbot', 'streamelements', 'moobot', 'wizebot'];

export default function OverlayChat({ channelConfig }: { channelConfig: ChannelConfig }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const maxMessages = 8;

  const getContainerBorder = (roles: ChatMessage['roles']) => {
    if (roles.moderator) return 'border-green-500';
    if (roles.vip) return 'border-purple-600';
    if (roles.subscriber) return 'border-blue-500';
    return 'border-black';
  };

  const getNickBoxBg = (roles: ChatMessage['roles']) => {
    if (roles.moderator) return 'bg-green-950/80 text-green-300';
    if (roles.vip) return 'bg-purple-950/80 text-purple-300';
    if (roles.subscriber) return 'bg-blue-950/80 text-blue-300';
    return 'bg-zinc-800 text-zinc-300';
  };

  useEffect(() => {
    if (!channelConfig?.chat_abilitata) return;

    const interval = setInterval(() => {
      const utentiTest = [
        { displayName: 'StreamerVip', roles: { vip: true, subscriber: true }, text: 'Ciao chat! Come va? Kappa', badges: { vip: '1', sub: '12' } },
        { displayName: 'ModSuper', roles: { moderator: true }, text: 'Ragazzi mantenete il rispetto in chat PogChamp', badges: { mod: '1' } },
        { displayName: 'AbbonatoFedele', roles: { subscriber: true }, text: 'Super minigioco! Partecipo! LUL', badges: { sub: '6' } },
        { displayName: 'Visitatore99', roles: { ordinary: true }, text: 'Bellissima questa estensione grafica!', badges: {} },
        { displayName: 'Nightbot', roles: { ordinary: true }, text: 'Seguite lo streamer sui social!', badges: {} }
      ];

      const utenteScelto = utentiTest[Math.floor(Math.random() * utentiTest.length)];
      
      const msgCasuale: ChatMessage = {
        id: Math.random().toString(),
        ...utenteScelto
      };

      if (channelConfig.nascondi_bot && BANNED_BOTS.includes(msgCasuale.displayName.toLowerCase())) {
        return; 
      }

      setMessages((prev) => {
        const nuovaLista = [...prev, msgCasuale];
        if (nuovaLista.length > maxMessages) {
          nuovaLista.shift();
        }
        return nuovaLista;
      });

      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msgCasuale.id));
      }, (channelConfig.durata_messaggio_secondi || 8) * 1000);

    }, 2500);

    return () => clearInterval(interval);
  }, [channelConfig]);

  return (
    <div className="w-96 h-[600px] bg-transparent flex flex-col justify-end p-4 pointer-events-none select-none font-sans">
      <div className="flex flex-col gap-3 justify-end items-start overflow-hidden w-full">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
              layout
              className={`w-full p-2.5 rounded-xl bg-zinc-900/90 backdrop-blur-md border-2 ${getContainerBorder(msg.roles)} shadow-2xl flex flex-col gap-2 pointer-events-auto`}
            >
              <div className={`px-2 py-1 rounded-md flex items-center justify-between font-bold text-xs ${getNickBoxBg(msg.roles)}`}>
                <span>{msg.displayName}</span>
                <div className="flex gap-1 items-center">
                  {Object.keys(msg.badges).map((badgeName) => (
                    <span 
                      key={badgeName} 
                      className="px-1.5 py-0.5 bg-purple-600 text-[9px] text-white font-black tracking-wider rounded border border-purple-400 uppercase shadow"
                    >
                      {badgeName}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-zinc-100 px-1 font-medium leading-relaxed break-words">
                {msg.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}