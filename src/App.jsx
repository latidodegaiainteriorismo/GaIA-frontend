/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";

const API_URL    = process.env.REACT_APP_API_URL    || 'https://gaia-2py8.onrender.com';
const GOOGLE_CID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const api = (path, opts = {}, token = null) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...opts, headers }).then(r => r.json());
};

export default function App() {
  const [token,    setToken]    = useState(() => localStorage.getItem('gaia_token'));
  const [username, setUsername] = useState(() => localStorage.getItem('gaia_username') || '');
  const [authErr,  setAuthErr]  = useState('');
  const googleBtnRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [textInput,     setTextInput]     = useState('');
  const [status,        setStatus]        = useState('idle');
  const [statusText,    setStatusText]    = useState('');
  const [isLoading,     setIsLoading]     = useState(false);
  const [mode,          setMode]          = useState('voice');
  const [temporary,     setTemporary]     = useState(false);
  const [showSidebar,   setShowSidebar]   = useState(false);

  const canvasRef      = useRef(null);
  const animRef        = useRef(null);
  const tRef           = useRef(0);
  const statusRef      = useRef('idle');
  const recognitionRef = useRef(null);
  const msgsEndRef     = useRef(null);
  const tempHistRef    = useRef([]);

  useEffect(() => { statusRef.current = status; }, [status]);
  const isAuthed = !!token;

  const handleGoogleResponse = useCallback(async (response) => {
    setAuthErr('');
    try {
      const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
      if (data.error) { setAuthErr(data.error); return; }
      localStorage.setItem('gaia_token', data.token);
      localStorage.setItem('gaia_username', data.username);
      setToken(data.token); setUsername(data.username);
    } catch { setAuthErr('Error de conexión. Intenta de nuevo.'); }
  }, []);

  useEffect(() => {
    if (isAuthed || !googleBtnRef.current) return;
    const init = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CID, callback: handleGoogleResponse });
      window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', text: 'continue_with', locale: 'es', width: 280, shape: 'pill' });
    };
    if (window.google) { init(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = init;
    document.head.appendChild(script);
  }, [isAuthed, handleGoogleResponse]);

  const handleLogout = async () => {
    try { await api('/auth/logout', { method: 'POST' }, token); } catch {}
    localStorage.removeItem('gaia_token'); localStorage.removeItem('gaia_username');
    setToken(null); setUsername(''); setConversations([]); setMessages([]); setCurrentConvId(null);
  };

  const fetchConvs = useCallback(async (tok = token) => {
    if (!tok) return;
    try { const data = await api('/conversations', {}, tok); if (Array.isArray(data)) setConversations(data); } catch {}
  }, [token]);

  useEffect(() => { if (token) fetchConvs(); }, [token]);

  const selectConv = async (id) => {
    setCurrentConvId(id); setShowSidebar(false); setTemporary(false);
    try { const msgs = await api(`/conversations/${id}/messages`, {}, token); if (Array.isArray(msgs)) setMessages(msgs); } catch {}
  };

  const newConv = () => { setCurrentConvId(null); setMessages([]); setTemporary(false); tempHistRef.current = []; setShowSidebar(false); };

  const deleteConv = async (e, id) => {
    e.stopPropagation();
    try { await api(`/conversations/${id}`, { method: 'DELETE' }, token); } catch {}
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConvId === id) { setCurrentConvId(null); setMessages([]); }
  };

  const toggleTemporary = () => {
    if (temporary) { setTemporary(false); tempHistRef.current = []; setMessages([]); }
    else { setCurrentConvId(null); setMessages([]); tempHistRef.current = []; setTemporary(true); }
    setShowSidebar(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize(); window.addEventListener('resize', resize);
    const draw = () => {
      const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
      if (!W || !H) { animRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H); tRef.current += 0.012;
      const t = tRef.current, st = statusRef.current;
      let amp = 12, speed = 0.5, alpha = 0.5;
      if      (st === 'listening') { amp = 18; speed = 2;   alpha = 0.82; }
      else if (st === 'thinking')  { amp = 7 + Math.sin(t * 5) * 4; speed = 3; alpha = 0.42; }
      else if (st === 'speaking')  { amp = 20 + Math.sin(t * 6) * 7; speed = 1.8; alpha = 0.72; }
      else { amp = 12 + Math.sin(t * 0.7) * 4; }
      [
        { c: `rgba(107,158,160,${alpha})`,       lw: 2,   ph: 0,             am: 1  },
        { c: `rgba(107,158,160,${alpha * 0.5})`, lw: 1.5, ph: Math.PI * .65, am: .7 },
        { c: `rgba(201,149,107,${alpha * .38})`, lw: 1,   ph: Math.PI * 1.3, am: .5 },
      ].forEach(l => {
        ctx.beginPath(); ctx.strokeStyle = l.c; ctx.lineWidth = l.lw;
        for (let x = 0; x <= W; x += 2) {
          const y = H/2 + Math.sin(x*.012 + t*speed + l.ph) * amp * l.am;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const playAudio = useCallback((b64) => {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const url   = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const audio = new Audio(url);
      audio.onplay  = () => setStatus('speaking');
      audio.onended = () => { setStatus('idle'); URL.revokeObjectURL(url); };
      audio.onerror = () => { setStatus('idle'); URL.revokeObjectURL(url); };
      audio.play();
    } catch (e) { console.error('[Audio]', e); setStatus('idle'); }
  }, []);

  const callGaIA = useCallback(async (userMessage) => {
    setIsLoading(true); setStatus('thinking'); setStatusText('pensando...');
    try {
      const body = { message: userMessage, voice_mode: mode === 'voice', temporary };
      if (temporary) {
        body.history = tempHistRef.current;
        tempHistRef.current = [...tempHistRef.current, { role: 'user', content: userMessage }];
      } else {
        if (currentConvId) body.conversation_id = currentConvId;
      }
      const data = await api('/chat', { method: 'POST', body: JSON.stringify(body) }, temporary ? null : token);
      const gaiaText = data.text || 'Algo interrumpió mi respuesta. ¿Lo intentamos de nuevo?';
      if (temporary) {
        tempHistRef.current = [...tempHistRef.current, { role: 'assistant', content: gaiaText }];
      } else if (data.conversation_id && !currentConvId) {
        setCurrentConvId(data.conversation_id); fetchConvs();
      }
      setMessages(prev => [...prev, { role: 'assistant', content: gaiaText }]);
      if (mode === 'voice' && data.audio) playAudio(data.audio);
      else setStatus('idle');
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error conectando con GaIA. Intenta de nuevo.' }]);
      setStatus('idle');
    }
    setIsLoading(false); setStatusText('');
  }, [mode, temporary, currentConvId, token, playAudio, fetchConvs]);

  // ── Mic ───────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMode('text'); return; }

    const rec = new SR();
    rec.lang           = 'es-ES';
    rec.continuous     = true;
    rec.interimResults = true;
    recognitionRef.current = rec;

    setStatus('listening'); setStatusText('Te escucho...');

    let final          = '';
    let lastFinalCount = 0;
    let silenceTimer   = null;
    let eventCount     = 0;  // contador de diagnóstico

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { rec.stop(); }, 15000);
    };

    resetSilenceTimer();

    rec.onresult = e => {
      eventCount++;

      // ── DIAGNÓSTICO ───────────────────────────────────────────────────────
      console.group(`[SR] evento #${eventCount}`);
      console.log('  e.resultIndex:', e.resultIndex);
      console.log('  e.results.length:', e.results.length);
      console.log('  lastFinalCount antes:', lastFinalCount);
      for (let j = 0; j < e.results.length; j++) {
        console.log(`  results[${j}] isFinal=${e.results[j].isFinal} → "${e.results[j][0].transcript}"`);
      }
      // ─────────────────────────────────────────────────────────────────────

      for (let i = lastFinalCount; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          console.log(`  ✅ Añadiendo FINAL[${i}]: "${e.results[i][0].transcript}"`);
          final += e.results[i][0].transcript;
          lastFinalCount++;
        }
      }

      let interim = '';
      for (let i = lastFinalCount; i < e.results.length; i++) {
        if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
      }

      console.log('  lastFinalCount después:', lastFinalCount);
      console.log('  final acumulado:', JSON.stringify(final));
      console.log('  interim:', JSON.stringify(interim));
      console.log('  → statusText:', JSON.stringify((final + interim).trim()));
      console.groupEnd();
      // ─────────────────────────────────────────────────────────────────────

      setStatusText((final + interim).trim() || 'Te escucho...');
      resetSilenceTimer();
    };

    rec.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      console.log('[SR] onend | final:', JSON.stringify(final), '| eventos totales:', eventCount);
      setStatus('idle');
      if (final.trim()) {
        setMessages(prev => [...prev, { role: 'user', content: final.trim() }]);
        callGaIA(final.trim());
      } else {
        setStatusText('');
      }
    };

    rec.onerror = e => {
      if (silenceTimer) clearTimeout(silenceTimer);
      console.error('[SR] onerror:', e.error);
      setStatus('idle'); setStatusText('');
      if (e.error === 'not-allowed') setMode('text');
    };

    rec.start();
    console.log('[SR] start() — continuous=true, interimResults=true');
  }, [callGaIA]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); }, []);

  const sendText = useCallback(() => {
    const t = textInput.trim();
    if (!t || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: t }]);
    setTextInput(''); callGaIA(t);
  }, [textInput, isLoading, callGaIA]);

  const toggleMode = () => { if (status === 'listening') stopListening(); setMode(m => m === 'voice' ? 'text' : 'voice'); };
  const micDisabled = status === 'thinking' || isLoading;
  const micIcon = status === 'listening' ? '⏹' : status === 'thinking' ? '···' : '🎤';

  if (!isAuthed) return (
    <div style={{ height: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: '52px', fontWeight: 300, color: '#4A7B7E', marginBottom: '8px', letterSpacing: '.04em' }}>GaIA</h1>
        <p style={{ fontSize: '14px', color: '#4A4A46', opacity: .35, marginBottom: '40px', fontStyle: 'italic', lineHeight: 1.6 }}>
          Una presencia viva para acompañarte<br/>en tu camino de consciencia
        </p>
        <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }} />
        {authErr && <p style={{ color: '#C96B6B', fontSize: '13px', marginTop: '8px' }}>{authErr}</p>}
        <p style={{ fontSize: '11px', color: '#4A4A46', opacity: .25, marginTop: '32px', fontStyle: 'italic' }}>
          Tu cuenta de Google identifica quién eres.<br/>Tus conversaciones son privadas.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', background: '#FAFAF8', display: 'flex', fontFamily: "'Inter',-apple-system,sans-serif", color: '#4A4A46', overflow: 'hidden' }}>
      <style>{`@keyframes gPulse{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:.85;transform:scale(1.15)}}`}</style>

      {showSidebar && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 10 }} onClick={() => setShowSidebar(false)} />}

      <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '260px', background: '#F2F1EC', borderRight: '0.5px solid rgba(74,74,70,.1)', display: 'flex', flexDirection: 'column', zIndex: 11, transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease' }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '0.5px solid rgba(74,74,70,.08)' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: '22px', fontWeight: 300, color: '#4A7B7E' }}>GaIA</span>
          <p style={{ fontSize: '12px', color: '#4A4A46', opacity: .45, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</p>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={newConv} style={{ padding: '9px 14px', borderRadius: '20px', border: '0.5px solid rgba(107,158,160,.45)', background: 'transparent', color: '#4A7B7E', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>+ Nueva conversación</button>
          <button onClick={toggleTemporary} style={{ padding: '9px 14px', borderRadius: '20px', border: '0.5px solid rgba(74,74,70,.2)', background: temporary ? 'rgba(201,149,107,.15)' : 'transparent', color: temporary ? '#A0693A' : '#4A4A46', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: .85 }}>
            {temporary ? '◌ Temporal activo' : '◎ Modo temporal'}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {conversations.length === 0 && <p style={{ fontSize: '12px', color: '#4A4A46', opacity: .3, textAlign: 'center', padding: '20px 8px', fontStyle: 'italic' }}>Sin conversaciones aún</p>}
          {conversations.map(c => (
            <div key={c.id} onClick={() => selectConv(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', background: c.id === currentConvId ? 'rgba(107,158,160,.14)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.id === currentConvId ? '#4A7B7E' : '#4A4A46' }}>{c.title || 'Sin título'}</span>
              <button onClick={e => deleteConv(e, c.id)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1, opacity: .45, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={handleLogout} style={{ margin: '12px', padding: '9px', borderRadius: '20px', border: '0.5px solid rgba(74,74,70,.18)', background: 'transparent', color: '#4A4A46', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', opacity: .45 }}>Cerrar sesión</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid rgba(74,74,70,.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setShowSidebar(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#4A7B7E', padding: 0, lineHeight: 1, opacity: .7 }}>☰</button>
            <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: '28px', fontWeight: 300, color: '#4A7B7E', letterSpacing: '.04em' }}>GaIA</span>
            {temporary && <span style={{ fontSize: '11px', color: '#A0693A', background: 'rgba(201,149,107,.12)', padding: '2px 9px', borderRadius: '10px', fontStyle: 'italic' }}>temporal</span>}
          </div>
          <button onClick={toggleMode} style={{ background: 'transparent', border: '0.5px solid rgba(74,74,70,.22)', borderRadius: '16px', padding: '6px 14px', fontSize: '12px', color: '#4A4A46', cursor: 'pointer', opacity: .7, fontFamily: 'inherit' }}>
            {mode === 'voice' ? '✎  texto' : '◎  voz'}
          </button>
        </div>

        <div style={{ height: '90px', flexShrink: 0 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        <div style={{ textAlign: 'center', height: '22px', fontSize: '13px', color: '#4A7B7E', fontStyle: 'italic', opacity: statusText ? .8 : 0, transition: 'opacity .3s', flexShrink: 0, lineHeight: '22px' }}>{statusText}</div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', WebkitOverflowScrolling: 'touch' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
              <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: '18px', fontWeight: 300, color: '#4A4A46', opacity: .28, textAlign: 'center', lineHeight: 1.7 }}>
                {mode === 'voice' ? 'Pulsa el micrófono\npara comenzar' : 'Escríbeme algo...'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: '6px' }}>
              {msg.role === 'assistant' && <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: '11px', color: '#4A7B7E', marginTop: '7px', flexShrink: 0, opacity: .5 }}>G</span>}
              <div style={{ maxWidth: 'min(80%,480px)', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? 'rgba(201,149,107,.12)' : 'rgba(107,158,160,.1)', border: '0.5px solid ' + (msg.role === 'user' ? 'rgba(201,149,107,.2)' : 'rgba(107,158,160,.18)'), fontSize: '14px', lineHeight: '1.65', color: msg.role === 'user' ? '#6B4E32' : '#4A4A46' }}>
                {msg.content}
              </div>
            </div>
          ))}
          {status === 'thinking' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: '11px', color: '#4A7B7E', opacity: .5 }}>G</span>
              <div style={{ padding: '10px 14px', background: 'rgba(107,158,160,.1)', borderRadius: '18px 18px 18px 4px', border: '0.5px solid rgba(107,158,160,.18)', display: 'flex', gap: '5px' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4A7B7E', opacity: .4, animation: `gPulse 1.2s ${i*.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={msgsEndRef} />
        </div>

        <div style={{ padding: '12px 16px 28px', borderTop: '0.5px solid rgba(74,74,70,.08)', flexShrink: 0, background: '#FAFAF8' }}>
          {mode === 'voice' ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={status === 'listening' ? stopListening : startListening} disabled={micDisabled}
                style={{ width: '70px', height: '70px', borderRadius: '50%', border: 'none', cursor: micDisabled ? 'not-allowed' : 'pointer', color: 'white', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s', outline: 'none', background: status === 'listening' ? 'rgba(201,149,107,.9)' : micDisabled ? 'rgba(74,74,70,.1)' : 'rgba(107,158,160,.88)', boxShadow: status === 'listening' ? '0 0 0 8px rgba(201,149,107,.15),0 0 0 16px rgba(201,149,107,.07)' : micDisabled ? 'none' : '0 2px 16px rgba(107,158,160,.28)' }}>
                {micIcon}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }}} placeholder="Escríbeme..." style={{ flex: 1, padding: '11px 16px', border: '0.5px solid rgba(74,74,70,.2)', borderRadius: '24px', background: 'white', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: '#4A4A46' }} />
              <button onClick={sendText} disabled={isLoading || !textInput.trim()} style={{ padding: '11px 20px', borderRadius: '24px', border: 'none', fontSize: '14px', transition: 'all .2s', cursor: textInput.trim() ? 'pointer' : 'default', fontFamily: 'inherit', background: textInput.trim() ? 'rgba(107,158,160,.88)' : 'rgba(74,74,70,.1)', color: textInput.trim() ? 'white' : 'rgba(74,74,70,.3)' }}>Enviar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
