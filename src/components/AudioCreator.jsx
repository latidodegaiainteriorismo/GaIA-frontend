/**
 * AudioCreator.jsx
 * Ubicación correcta: src/components/AudioCreator.jsx
 *
 * Componente de grabación y subida de audio para el creator de GaIA.
 * Solo se renderiza si el backend confirma que el usuario tiene rol creator.
 *
 * Props:
 *   apiBase    {string}  URL base del backend, ej. "https://gaia-2py8.onrender.com"
 *   authToken  {string}  Token Bearer de la sesión actual
 *   onClose    {func}    Callback para cerrar el panel
 */

import { useState, useRef, useEffect, useCallback } from "react";

const WARN_SECONDS = 20 * 60;
const MAX_SECONDS  = 30 * 60;
const PULSE_MS     = 800;

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(18,12,8,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, backdropFilter: "blur(4px)",
  },
  panel: {
    background: "linear-gradient(160deg, #1e1410 0%, #2a1c14 100%)",
    border: "1px solid rgba(212,174,120,0.2)",
    borderRadius: "20px", padding: "36px 32px 28px",
    width: "min(420px, 92vw)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    fontFamily: "'Georgia', serif", color: "#e8d5b0",
    display: "flex", flexDirection: "column", gap: "24px",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  },
  title: {
    fontSize: "18px", fontWeight: "600", letterSpacing: "0.02em",
    color: "#d4ae78", margin: 0,
  },
  subtitle: {
    fontSize: "12px", color: "#8a7055", marginTop: "4px", fontStyle: "italic",
  },
  btnClose: {
    background: "none", border: "none", color: "#8a7055", cursor: "pointer",
    fontSize: "22px", lineHeight: 1, padding: "2px 6px",
  },
  // Badge persistente con el nº de audios ya en cola — visible en cualquier
  // fase (idle, grabando, subiendo, resultado), para que nunca haya duda
  // de cuántos se han aceptado hasta el momento.
  queueBadge: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    background: "rgba(196,144,80,0.14)", border: "1px solid rgba(196,144,80,0.3)",
    borderRadius: "20px", padding: "6px 14px", fontSize: "12px", color: "#d4ae78",
    alignSelf: "center",
  },
  // Mensaje flash de confirmación tras aceptar/descartar — aparece y se
  // autolimpia, no bloquea ninguna otra interacción.
  flash: (tone) => ({
    fontSize: "12px", textAlign: "center", padding: "7px 12px", borderRadius: "10px",
    background: tone === 'discard' ? 'rgba(200,90,70,0.14)' : 'rgba(120,170,110,0.14)',
    color: tone === 'discard' ? '#e0a080' : '#a8d0a0',
    border: '1px solid ' + (tone === 'discard' ? 'rgba(200,90,70,0.28)' : 'rgba(120,170,110,0.28)'),
  }),
  recorderZone: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
  },
  pulseRing: (recording) => ({
    width: "80px", height: "80px", borderRadius: "50%",
    border: recording ? "2px solid rgba(220,80,60,0.4)" : "2px solid rgba(212,174,120,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "border-color 0.4s",
  }),
  dot: (recording, pulse) => ({
    width: recording ? "36px" : "28px",
    height: recording ? "36px" : "28px",
    borderRadius: "50%",
    background: recording ? (pulse ? "#e03c28" : "#c43420") : "rgba(212,174,120,0.35)",
    transition: "all 0.4s",
    boxShadow: recording && pulse ? "0 0 16px rgba(220,80,60,0.6)" : "none",
  }),
  timer: (recording, warn) => ({
    fontSize: "38px", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em",
    color: warn ? "#e07040" : (recording ? "#e8d5b0" : "#5a4535"),
    fontFamily: "'Georgia', monospace", transition: "color 0.3s",
  }),
  warnText: {
    fontSize: "12px", color: "#e07040", textAlign: "center",
    background: "rgba(224,112,64,0.12)", borderRadius: "8px", padding: "6px 12px",
  },
  btnRow: {
    display: "flex", gap: "10px", justifyContent: "center",
  },
  btnPrimary: {
    flex: 1, padding: "12px 0", borderRadius: "12px", border: "none",
    background: "linear-gradient(135deg, #c49050, #a87040)",
    color: "#fff8ee", fontSize: "14px", fontWeight: "600",
    cursor: "pointer", letterSpacing: "0.03em",
    boxShadow: "0 4px 12px rgba(180,120,40,0.3)",
  },
  btnSecondary: {
    flex: 1, padding: "12px 0", borderRadius: "12px",
    border: "1px solid rgba(212,174,120,0.3)", background: "transparent",
    color: "#b09060", fontSize: "14px", cursor: "pointer",
  },
  btnDanger: {
    flex: 1, padding: "12px 0", borderRadius: "12px",
    background: "rgba(200,60,40,0.15)", color: "#e07060", fontSize: "14px",
    cursor: "pointer", border: "1px solid rgba(200,60,40,0.25)",
  },
  uploadZone: {
    border: "1.5px dashed rgba(212,174,120,0.3)", borderRadius: "12px",
    padding: "16px", textAlign: "center", cursor: "pointer",
    fontSize: "13px", color: "#8a7055",
  },
  progressWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  progressBar: (pct) => ({
    height: "4px", borderRadius: "2px",
    background: `linear-gradient(90deg, #c49050 ${pct}%, rgba(212,174,120,0.12) ${pct}%)`,
    transition: "background 0.3s",
  }),
  progressLabel: { fontSize: "13px", color: "#a08060", textAlign: "center" },
  resultZone: { display: "flex", flexDirection: "column", gap: "12px" },
  resultLabel: { fontSize: "12px", color: "#8a7055", letterSpacing: "0.05em" },
  titleInput: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,174,120,0.25)",
    borderRadius: "10px", padding: "10px 14px",
    color: "#e8d5b0", fontSize: "15px", fontFamily: "'Georgia', serif",
    width: "100%", boxSizing: "border-box", outline: "none",
  },
  previewText: {
    fontSize: "12px", color: "#6a5540", lineHeight: 1.6,
    maxHeight: "80px", overflow: "hidden",
    borderLeft: "2px solid rgba(212,174,120,0.2)", paddingLeft: "10px",
  },
  meta: { fontSize: "12px", color: "#6a5540", display: "flex", gap: "16px" },
};

export default function AudioCreator({ apiBase, authToken, onClose, onAudioReady }) {
  const [phase, setPhase]             = useState("idle");
  const [elapsed, setElapsed]         = useState(0);
  const [pulse, setPulse]             = useState(false);
  const [warned, setWarned]           = useState(false);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult]           = useState(null);
  const [editTitle, setEditTitle]     = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  // Cola de audios aceptados en esta sesión de grabación (vía "Grabar otro"),
  // pendientes de enviarse todos juntos al chat cuando se pulse "Guardar"
  // definitivo. Cada entrada: { id, transcript, title }.
  const [queue, setQueue] = useState([]);
  // Mensaje breve de confirmación tras aceptar/descartar un audio — se
  // autolimpia a los 2.5s. Independiente del "phase" para que no
  // interfiera con la transición idle/recording/uploading/done.
  const [flashMsg, setFlashMsg] = useState(null); // { text, tone: 'ok'|'discard' }
  const flashTimerRef = useRef(null);

  const showFlash = (text, tone = 'ok') => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashMsg({ text, tone });
    flashTimerRef.current = setTimeout(() => setFlashMsg(null), 2500);
  };

  const mediaRecorder = useRef(null);
  const audioChunks   = useRef([]);
  const timerRef      = useRef(null);
  const pulseRef      = useRef(null);
  const fileInput     = useRef(null);
  // CORRECCIÓN TDZ: handleUpload se guarda en un ref para que startRecording
  // pueda referenciarlo sin depender del orden de declaración de const.
  const handleUploadRef  = useRef(null);
  const stopRecordingRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(pulseRef.current);
  }, []);

  // ── handleUpload declarado ANTES de startRecording para evitar TDZ ──────────
  const handleUpload = useCallback(async (blob, filename) => {
    setPhase("uploading");
    setProgress(10);
    setProgressMsg("Subiendo audio...");

    const formData = new FormData();
    formData.append("audio", blob, filename);

    try {
      setProgress(30);
      setProgressMsg("Transcribiendo con Whisper...");

      const res = await fetch(`${apiBase}/audio/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      setProgress(80);
      setProgressMsg("Generando título y chunks...");

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setProgress(100);
      setProgressMsg("¡Listo!");

      setTimeout(() => {
        setResult(data);
        setEditTitle(data.title || "");
        setPhase("done");
      }, 400);

    } catch (err) {
      setPhase("error");
      setProgressMsg(err.message || "Error desconocido al subir el audio.");
    }
  }, [apiBase, authToken]);

  // Mantener los refs sincronizados con los callbacks más recientes
  // ── stopRecording declarado antes de cualquier referencia ─────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(pulseRef.current);
    setPulse(false);
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
  }, []);

  // Mantener los refs sincronizados con los callbacks más recientes
  useEffect(() => {
    handleUploadRef.current = handleUpload;
  }, [handleUpload]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // ── startRecording usa el ref para evitar cualquier dependencia de orden ─────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      audioChunks.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        // Usa el ref en vez de la variable directa — sin riesgo de TDZ
        handleUploadRef.current(blob, "grabacion.webm");
      };

      mr.start(1000);
      mediaRecorder.current = mr;
      setPhase("recording");
      setElapsed(0);
      setWarned(false);

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next === WARN_SECONDS) setWarned(true);
          if (next >= MAX_SECONDS) stopRecordingRef.current?.();
          return next;
        });
      }, 1000);

      pulseRef.current = setInterval(() => setPulse(p => !p), PULSE_MS);
    } catch {
      alert("No se pudo acceder al micrófono. Comprueba los permisos del navegador.");
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUpload(file, file.name);
  }, [handleUpload]);

  // ── Persistir SOLO el título (sin decidir nada sobre el destino del audio) ──
  // Se usa tanto en onBlur del campo de texto como paso previo a las tres
  // acciones de abajo, para que el título editado quede guardado siempre.
  const persistTitle = useCallback(async (id, title) => {
    if (!id || !title.trim()) return;
    try {
      await fetch(`${apiBase}/audio/${id}/title`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title.trim() }),
      });
    } catch (_) {}
  }, [apiBase, authToken]);

  const saveTitle = useCallback(() => {
    if (result?.id) persistTitle(result.id, editTitle);
  }, [result, editTitle, persistTitle]);

  // ── "No guardar": descarta el audio actual (ya estaba subido al backend
  // desde que terminó de procesarse, así que hay que borrarlo explícitamente)
  // y vuelve a la pantalla de grabación. No toca la cola — los audios ya
  // aceptados con "Grabar otro" anteriormente se mantienen intactos.
  const discardCurrent = useCallback(async () => {
    if (result?.id) {
      try {
        await fetch(`${apiBase}/audio/${result.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (_) {}
    }
    const quedan = queue.length;
    showFlash(
      quedan > 0
        ? `✕ Descartado — ${quedan} audio${quedan > 1 ? 's' : ''} en cola. Puedes grabar otro.`
        : '✕ Descartado — puedes grabar otro cuando quieras.',
      'discard'
    );
    reset();
  }, [apiBase, authToken, result, queue.length]);

  // ── "Grabar otro": acepta el audio actual (queda en la cola, con su
  // título ya persistido) y vuelve a la pantalla de grabación sin cerrar
  // el modal. No se envía al chat todavía — eso solo ocurre en "Guardar".
  const acceptAndRecordAnother = useCallback(async () => {
    if (!result?.id) return;
    setSavingTitle(true);
    await persistTitle(result.id, editTitle);
    setSavingTitle(false);
    const nuevoTotal = queue.length + 1;
    setQueue(prev => [...prev, {
      id: result.id,
      transcript: result.transcript_full || result.transcript_preview || "",
      title: editTitle.trim(),
    }]);
    showFlash(`✓ Guardado — ${nuevoTotal} audio${nuevoTotal > 1 ? 's' : ''} en cola`, 'ok');
    reset();
  }, [result, editTitle, persistTitle, queue.length]);

  // ── "Guardar" definitivo: acepta el audio actual, añade TODA la cola
  // acumulada (incluido este) y la envía entera a App.jsx en un solo aviso
  // — App.jsx la procesa en orden, una pregunta tras otra, igual que si
  // se hubieran escrito o dictado por voz una detrás de otra.
  const finalSave = useCallback(async () => {
    if (!result?.id || !editTitle.trim()) return;
    setSavingTitle(true);
    await persistTitle(result.id, editTitle);
    setSavingTitle(false);

    const fullQueue = [...queue, {
      id: result.id,
      transcript: result.transcript_full || result.transcript_preview || "",
      title: editTitle.trim(),
    }];

    if (onAudioReady) onAudioReady(fullQueue);
    onClose?.();
  }, [result, editTitle, queue, persistTitle, onAudioReady, onClose]);

  const reset = () => {
    setPhase("idle"); setElapsed(0); setWarned(false);
    setProgress(0); setProgressMsg(""); setResult(null); setEditTitle("");
  };

  const isRecording = phase === "recording";
  const isUploading = phase === "uploading";
  const isDone      = phase === "done";
  const isError     = phase === "error";

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.panel}>

        <div style={S.header}>
          <div>
            <h2 style={S.title}>Grabar audio para GaIA</h2>
            <p style={S.subtitle}>Solo visible para el creator · Privado hasta que lo promuevas</p>
          </div>
          <button style={S.btnClose} onClick={onClose}>×</button>
        </div>

        {/* Badge persistente: cuántos audios llevas ya aceptados en esta
            sesión de grabación, visible en cualquier fase del flujo. */}
        {queue.length > 0 && (
          <div style={S.queueBadge}>
            📦 {queue.length} audio{queue.length > 1 ? 's' : ''} guardado{queue.length > 1 ? 's' : ''} en cola
          </div>
        )}

        {/* Confirmación temporal tras aceptar o descartar el último audio */}
        {flashMsg && (
          <div style={S.flash(flashMsg.tone)}>{flashMsg.text}</div>
        )}

        {(phase === "idle" || isRecording) && (
          <>
            <div style={S.recorderZone}>
              <div style={S.pulseRing(isRecording)}>
                <div style={S.dot(isRecording, pulse)} />
              </div>
              <span style={S.timer(isRecording, warned && isRecording)}>
                {fmtTime(elapsed)}
              </span>
              {warned && isRecording && (
                <p style={S.warnText}>
                  ⚠️ Llevas 20 minutos grabando. El límite es 30 min / 25 MB.
                </p>
              )}
            </div>

            <div style={S.btnRow}>
              {!isRecording ? (
                <button style={S.btnPrimary} onClick={startRecording}>
                  ● Empezar a grabar
                </button>
              ) : (
                <button style={S.btnDanger} onClick={stopRecording}>
                  ■ Detener y procesar
                </button>
              )}
            </div>

            {!isRecording && (
              <>
                <div style={{ textAlign: "center", color: "#5a4535", fontSize: "12px" }}>
                  — o sube un archivo —
                </div>
                <div style={S.uploadZone} onClick={() => fileInput.current?.click()}>
                  📁 Seleccionar audio (mp3, m4a, wav, webm…)
                  <input
                    ref={fileInput} type="file" accept="audio/*"
                    style={{ display: "none" }} onChange={handleFileSelect}
                  />
                </div>
              </>
            )}
          </>
        )}

        {isUploading && (
          <div style={S.progressWrap}>
            <div style={S.progressBar(progress)} />
            <p style={S.progressLabel}>{progressMsg}</p>
          </div>
        )}

        {isDone && result && (
          <div style={S.resultZone}>
            <div style={S.meta}>
              <span>⏱ {fmtTime(Math.round(result.duration || 0))}</span>
              <span>📦 {result.chunks} fragmentos</span>
            </div>
            <div>
              <p style={S.resultLabel}>TÍTULO GENERADO POR GAIA</p>
              <input
                style={S.titleInput} value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={saveTitle}
                placeholder="Escribe un título descriptivo..."
              />
            </div>
            {result.transcript_preview && (
              <p style={S.previewText}>{result.transcript_preview}</p>
            )}
            {/* Tres acciones: Guardar (cierra y envía toda la cola al chat),
                No guardar (descarta este audio, se borra del backend) y
                Grabar otro (acepta este audio en la cola y graba uno más) */}
            <div style={S.btnRow}>
              <button style={S.btnPrimary} onClick={finalSave} disabled={savingTitle}>
                {savingTitle ? "Guardando..." : queue.length > 0 ? `✓ Guardar (${queue.length + 1})` : "✓ Guardar"}
              </button>
              <button style={S.btnSecondary} onClick={acceptAndRecordAnother} disabled={savingTitle}>
                Grabar otro
              </button>
            </div>
            <div style={S.btnRow}>
              <button style={S.btnDanger} onClick={discardCurrent} disabled={savingTitle}>
                ✕ No guardar
              </button>
            </div>
          </div>
        )}

        {isError && (
          <div style={S.resultZone}>
            <p style={{ color: "#e07060", fontSize: "14px", textAlign: "center" }}>
              ✕ {progressMsg}
            </p>
            <button style={S.btnSecondary} onClick={reset}>Intentar de nuevo</button>
          </div>
        )}

      </div>
    </div>
  );
}
