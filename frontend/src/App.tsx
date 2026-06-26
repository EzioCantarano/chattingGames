import React from 'react';
import OverlayChat from './OverlayChat';
import ConfigPage from './ConfigPage';

export default function App() {
  // Intercettiamo i parametri dell'URL generati da Twitch (es: ?view=overlay oppure ?view=config)
  const urlParams = new URLSearchParams(window.location.search);
  const viewMode = urlParams.get('view');

  // Configurazione temporanea locale per i test grafici
  const mockConfig = {
    chat_abilitata: true,
    durata_messaggio_secondi: 8,
    nascondi_bot: true
  };

  // CASO 1: Se Twitch passa ?view=config carichiamo l'interfaccia dello streamer
  if (viewMode === 'config') {
    return (
      <ConfigPage 
        channelId="test_channel_123" 
        backendUrl="https://onrender.com" 
        token="MOCK_DEVELOPMENT_TOKEN" 
      />
    );
  }

  // CASO 2: Di default (o con ?view=overlay) mostriamo la chat grafica trasparente per gli spettatori
  return (
    <div className="w-screen h-screen bg-transparent select-none pointer-events-none">
      <OverlayChat channelConfig={mockConfig} />
    </div>
  );
}