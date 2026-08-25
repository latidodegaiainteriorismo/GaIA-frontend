/**
 * AudioLibrary.jsx
 * Ubicación: src/components/AudioLibrary.jsx
 *
 * Panel "Mis audios" para el creator. Permite:
 *   - Ver la lista de audios grabados (título, duración, fecha)
 *   - Entrar en uno y ver su transcripción trocito a trocito, cada uno
 *     con su minuto exacto
 *   - Pulsar cualquier fragmento para que el audio original salte
 *     directamente a ese punto y empiece a sonar
 *
 * Pensado para el caso "GaIA interpretó esto mal, vamos a escuchar
 * exactamente qué dijimos en ese momento" — el texto transcrito no
 * siempre captura el tono o los matices reales de la grabación.
 *
 * Props:
 *   apiBase    {string}  URL base del backend
 *   authToken  {string}  Token Bearer de la sesión actual
 *   onClose    {func}    Callback para cerrar el panel
 */

import { useState, useEffect, useRef, useCallback } from "react";

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(18,12,8,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, backdropFilter: "blur(4px)", padding: "20px",
  },
  panel: {
    background: "linear-gradient(160deg, #1e1410 0%, #2a1c14 100%)",
    border: "1px solid rgba(212,174,120,0.2)",
    borderRadius: "20px", padding: "28px 26px 24px",
    width: "min(560px, 94vw)", maxHeight: "85vh", overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    fontFamily: "'Georgia', serif", color: "#e8d5b0",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 },
  title: { fontSize: "18px", fontWeight: "600", color: "#d4ae78", margin: 0 },
  subtitle: { fontSize: "12px", color: "#8a7055", marginTop: "4px", fontStyle: "italic" },
  btnClose: { background: "none", border: "none", color: "#8a7055", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "2px 6px" },
  btnBack: { background: "none", border: "none", color: "#c49050", cursor: "pointer", fontSize: "13px", padding: "0 0 4px", textAlign: "left" },

  list: { overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" },
  item: {
    padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
    border: "1px solid rgba(212,174,120,0.15)", background: "rgba(255,255,255,0.03)",
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px",
  },
  itemTitle: { fontSize: "14px", color: "#e8d5b0" },
  itemMeta: { fontSize: "11px", color: "#8a7055", marginTop: "3px" },
  empty: { fontSize: "13px", color: "#6a5540", textAlign: "center", padding: "24px 0", fontStyle: "italic" },

  player: { flexShrink: 0, width: "100%" },
  chunksList: { overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" },
  chunk: (active) => ({
    padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
    background: active ? "rgba(196,144,80,0.18)" : "rgba(255,255,255,0.03)",
    border: "1px solid " + (active ? "rgba(196,144,80,0.4)" : "rgba(212,174,120,0.12)"),
    display: "flex", gap: "10px", alignItems: "flex-start",
  }),
  chunkTime: { fontSize: "11px", color: "#c49050", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginTop: "1px" },
  chunkText: { fontSize: "13px", color: "#d8c5a0", lineHeight: 1.5 },
  loading: { fontSize: "13px", color: "#6a5540", textAlign: "center", padding: "24px 0", fontStyle: "italic" },
};

export default function AudioLibrary({ apiBase, authToken, onClose }) {
  const [audios, setAudios]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null); // audio_id seleccionado, o null = lista
  const [chunks, setChunks]     = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [activeChunk, setActiveChunk] = useState(null);
  const audioRef = useRef(null);

  // ── Cargar lista de audios al abrir el panel ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${apiBase}/audio/list`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => { if (!cancelled) setAudios(data.audios || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, authToken]);

  // ── Al seleccionar un audio: cargar sus fragmentos + URL firmada ──────────
  const openAudio = useCallback(async (id) => {
    setSelected(id);
    setChunksLoading(true);
    setChunks([]);
    setAudioUrl(null);
    setActiveChunk(null);
    try {
      const [chunksRes, urlRes] = await Promise.all([
        fetch(`${apiBase}/audio/${id}/chunks`, { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()),
        fetch(`${apiBase}/audio/${id}/url`, { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()),
      ]);
      setChunks(chunksRes.chunks || []);
      if (urlRes.url) setAudioUrl(urlRes.url);
    } catch (_) {}
    setChunksLoading(false);
  }, [apiBase, authToken]);

  // ── Al pulsar un fragmento: saltar el audio a ese punto y reproducir ──────
  const playFrom = useCallback((chunk) => {
    setActiveChunk(chunk.chunk_index);
    if (audioRef.current) {
      audioRef.current.currentTime = chunk.start_time;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const backToList = () => { setSelected(null); setChunks([]); setAudioUrl(null); };

  const selectedMeta = audios.find(a => a.id === selected);

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.panel}>

        <div style={S.header}>
          <div>
            {selected && <button style={S.btnBack} onClick={backToList}>← volver a la lista</button>}
            <h2 style={S.title}>{selected ? (selectedMeta?.title || 'Audio') : 'Mis audios'}</h2>
            <p style={S.subtitle}>
              {selected
                ? 'Pulsa cualquier fragmento para escuchar exactamente ese momento'
                : 'Grabaciones guardadas — solo visible para el creator'}
            </p>
          </div>
          <button style={S.btnClose} onClick={onClose}>×</button>
        </div>

        {/* ── Vista: lista de audios ── */}
        {!selected && (
          <div style={S.list}>
            {loading && <p style={S.loading}>Cargando...</p>}
            {!loading && audios.length === 0 && (
              <p style={S.empty}>Aún no has grabado ningún audio para GaIA.</p>
            )}
            {!loading && audios.map(a => (
              <div key={a.id} style={S.item} onClick={() => openAudio(a.id)}>
                <div>
                  <div style={S.itemTitle}>{a.title || a.filename}</div>
                  <div style={S.itemMeta}>
                    {fmtTime(a.duration_seconds || 0)} · {a.chunk_count} fragmentos · {fmtDate(a.uploaded_at)}
                    {a.visibility === 'all' && ' · público'}
                  </div>
                </div>
                <span style={{ color: '#8a7055', fontSize: '18px' }}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Vista: transcripción + reproductor de un audio ── */}
        {selected && (
          <>
            {audioUrl && (
              <audio ref={audioRef} controls src={audioUrl} style={S.player} />
            )}
            <div style={S.chunksList}>
              {chunksLoading && <p style={S.loading}>Cargando transcripción...</p>}
              {!chunksLoading && chunks.length === 0 && (
                <p style={S.empty}>Este audio no tiene fragmentos transcritos.</p>
              )}
              {!chunksLoading && chunks.map(c => (
                <div
                  key={c.chunk_index}
                  style={S.chunk(activeChunk === c.chunk_index)}
                  onClick={() => playFrom(c)}
                >
                  <span style={S.chunkTime}>{fmtTime(c.start_time)}</span>
                  <span style={S.chunkText}>{c.content}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
