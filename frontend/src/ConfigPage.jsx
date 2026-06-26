import React, { useState, useEffect } from 'react';

export default function ConfigPage({ channelId, backendUrl, token }) {
  const [config, setConfig] = useState({
    chat_abilitata: true,
    mostra_emotes: true,
    durata_messaggio_secondi: 8,
    nascondi_bot: true
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch(`${backendUrl}/api/config/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      alert('Impostazioni salvate su Redis con successo!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      <h1 className="text-2xl font-bold text-twitch-purple mb-6">⚙️ Configurazione Estensione Chat</h1>
      
      {/* Riquadro Abilitazione Chat */}
      <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="font-semibold block">Abilita Chat Grafica Overlay</span>
            <span className="text-sm text-slate-400">Mostra o nascondi l'intera chat grafica sullo schermo.</span>
          </div>
          <input 
            type="checkbox" 
            checked={config.chat_abilitata} 
            onChange={(e) => setConfig({...config, chat_abilitata: e.target.checked})}
            className="w-5 h-5 accent-twitch-purple"
          />
        </label>
      </div>

      {/* Riquadro Filtro Bot */}
      <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="font-semibold block">Ignora i Messaggi dei Bot</span>
            <span className="text-sm text-slate-400">Nasconde automaticamente i messaggi di Nightbot, Streamelements, ecc.</span>
          </div>
          <input 
            type="checkbox" 
            checked={config.nascondi_bot} 
            onChange={(e) => setConfig({...config, nascondi_bot: e.target.checked})}
            className="w-5 h-5 accent-twitch-purple"
          />
        </label>
      </div>

      {/* Riquadro Durata */}
      <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <label className="block mb-2 font-semibold">Durata Visibilità Messaggi (Secondi)</label>
        <input 
          type="number" 
          value={config.durata_messaggio_secondi} 
          onChange={(e) => setConfig({...config, durata_messaggio_secondi: parseInt(e.target.value)})}
          className="w-full bg-slate-700 p-2 rounded text-white border border-slate-600 focus:outline-none focus:border-twitch-purple"
          min="3" max="30"
        />
      </div>

      <button 
        onClick={handleSave} 
        disabled={loading}
        className="w-full bg-twitch-purple hover:bg-purple-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
      >
        {loading ? 'Salvataggio...' : 'Salva Modifiche'}
      </button>
    </div>
  );
}