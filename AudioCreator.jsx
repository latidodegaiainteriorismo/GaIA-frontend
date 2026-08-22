/**
 * AudioCreator.jsx
 *
 * Componente de grabación y subida de audio para el creator de GaIA.
 * Solo se renderiza si el backend confirma que el usuario tiene rol creator.
 *
 * Props:
 *   apiBase    {string}  URL base del backend, ej. "https://gaia-2py8.onrender.com"
 *   authToken  {string}  Token Bearer de la sesión actual
 *   onClose    {func}    Callback para cerrar el panel
 *
 * Flujo:
 *   1. Grabar audio con MediaRecorder (webm/opus)
 *   2. Mostrar contador de tiempo + indicador visual de grabación
 *   3. Avisar a los 20 minutos
 *   4. Al detener → subir al backend → mostrar progreso
 *   5. Mostrar título generado automáticamente (editable)
 *   6. Confirmar o editar título → guardar
 *
 * No depende de ninguna librería externa — solo React y la Web Audio API.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ── Constantes ─────────────────────────────────────────────────────────────────
const WARN_SECONDS  = 20 * 60;   // aviso a los 20 min
const MAX_SECONDS   = 30 * 60;   // límite absoluto (25MB ≈ 30min en webm)
const PULSE_MS      = 800;       // intervalo de pulso del indicador rojo

// ── Utilidades ────────────────────────────────────────────────────────────────
function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Estilos inline (no depende de Tailwind ni de CSS externo) ─────────────────
// Paleta: tonos tierra cálidos + oro suave — coherente con la identidad visual
// de GaIA (femenina, meditativa, ligada a la tierra y al cosmos).
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

  // Zona central: indicador + timer
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
    background: recording
      ? (pulse ? "#e03c28" : "#c43420")
      : "rgba(212,174,120,0.35)",
    transition: "all 0.4s",
    boxShadow: recording && pulse ? "0 0 16px rgba(220,80,60,0.6)" : "none",
  }),
  timer: (recording, warn) => ({
    fontSize: "38px", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em",
    color: warn ? "#e07040" : (recording ? "#e8d5b0" : "#5a4535"),
    fontFamily: "'Georgia', monospace",
    transition: "color 0.3s",
  }),
  warnText: {
    fontSize: "12px", color: "#e07040", textAlign: "center",
    background: "rgba(224,112,64,0.12)", borderRadius: "8px",
    padding: "6px 12px",
  },

  // Botones de acción
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
    flex: 1, padding: "12px 0", borderRadius: "12px", border: "none",
    background: "rgba(200,60,40,0.15)",
    color: "#e07060", fontSize: "14px", cursor: "pointer",
    border: "1px solid rgba(200,60,40,0.25)",
  },

  // Zona de subida de archivo
  uploadZone: {
    border: "1.5px dashed rgba(212,174,120,0.3)", borderRadius: "12px",
    padding: "16px", textAlign: "center", cursor: "pointer",
    fontSize: "13px", color: "#8a7055",
    transition: "border-color 0.2s",
  },

  // Barra de progreso
  progressWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  progressBar: (pct) => ({
    height: "4px", borderRadius: "2px",
    background: `linear-gradient(90deg, #c49050 ${pct}%, rgba(212,174,120,0.12) ${pct}%)`,
    transition: "background 0.3s",
  }),
  progressLabel: {
    fontSize: "13px", color: "#a08060", textAlign: "center",
  },

  // Resultado: título editable
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
  meta: {
    fontSize: "12px", color: "#6a5540",
    display: "flex", gap: "16px",
  },
};

// ── Componente principal ───────────────────────────────────────────────────────
export default function AudioCreator({ apiBase, authToken, onClose }) {
  // Estados de grabación
  const [phase, setPhase]         = useState("idle"); // idle | recording | uploading | done | error
  const [elapsed, setElapsed]     = useState(0);
  const [pulse, setPulse]         = useState(false);
  const [warned, setWarned]       = useState(false);

  // Progreso de subida
  const [progress, setProgress]   = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  // Resultado
  const [result, setResult]       = useState(null); // { id, title, duration, chunks, transcript_preview }
  const [editTitle, setEditTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // Refs
  const mediaRecorder = useRef(null);
  const chunks        = useRef([]);
  const timerRef      = useRef(null);
  const pulseRef      = useRef(null);
  const fileInput     = useRef(null);

  // ── Limpieza al desmontar ────────────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(pulseRef.current);
  }, []);

  // ── Iniciar grabación ────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunks.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        handleUpload(blob, "grabacion.webm");
      };

      mr.start(1000); // chunk cada segundo para no perder datos si falla
      mediaRecorder.current = mr;
      setPhase("recording");
      setElapsed(0);
      setWarned(false);

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next === WARN_SECONDS) setWarned(true);
          if (next >= MAX_SECONDS) stopRecording();
          return next;
        });
      }, 1000);

      pulseRef.current = setInterval(() => setPulse(p => !p), PULSE_MS);
    } catch (err) {
      alert("No se pudo acceder al micrófono. Comprueba los permisos del navegador.");
    }
  }, []);

  // ── Detener grabación ────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(pulseRef.current);
    setPulse(false);
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
  }, []);

  // ── Subir archivo (desde grabación o desde disco) ─────────────────────────
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

  // ── Guardar título editado ────────────────────────────────────────────────
  const saveTitle = useCallback(async () => {
    if (!result?.id || !editTitle.trim()) return;
    setSavingTitle(true);
    try {
      await fetch(`${apiBase}/audio/${result.id}/title`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
    } catch (_) {}
    setSavingTitle(false);
  }, [apiBase, authToken, result, editTitle]);

  // ── Subida desde archivo del disco ───────────────────────────────────────
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUpload(file, file.name);
  }, [handleUpload]);

  // ── Resetear ─────────────────────────────────────────────────────────────
  const reset = () => {
    setPhase("idle");
    setElapsed(0);
    setWarned(false);
    setProgress(0);
    setProgressMsg("");
    setResult(null);
    setEditTitle("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isRecording = phase === "recording";
  const isUploading = phase === "uploading";
  const isDone      = phase === "done";
  const isError     = phase === "error";

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.panel}>

        {/* Cabecera */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Grabar audio para GaIA</h2>
            <p style={S.subtitle}>Solo visible para el creator · Privado hasta que lo promuevas</p>
          </div>
          <button style={S.btnClose} onClick={onClose}>×</button>
        </div>

        {/* ── FASE: idle o recording ── */}
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
                <div
                  style={S.uploadZone}
                  onClick={() => fileInput.current?.click()}
                >
                  📁 Seleccionar audio (mp3, m4a, wav, webm…)
                  <input
                    ref={fileInput}
                    type="file"
                    accept="audio/*"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* ── FASE: uploading ── */}
        {isUploading && (
          <div style={S.progressWrap}>
            <div style={S.progressBar(progress)} />
            <p style={S.progressLabel}>{progressMsg}</p>
          </div>
        )}

        {/* ── FASE: done ── */}
        {isDone && result && (
          <div style={S.resultZone}>
            <div style={S.meta}>
              <span>⏱ {fmtTime(Math.round(result.duration || 0))}</span>
              <span>📦 {result.chunks} fragmentos</span>
            </div>

            <div>
              <p style={S.resultLabel}>TÍTULO GENERADO POR GAIA</p>
              <input
                style={S.titleInput}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={saveTitle}
                placeholder="Escribe un título descriptivo..."
              />
            </div>

            {result.transcript_preview && (
              <p style={S.previewText}>{result.transcript_preview}</p>
            )}

            <div style={S.btnRow}>
              <button
                style={S.btnPrimary}
                onClick={saveTitle}
                disabled={savingTitle}
              >
                {savingTitle ? "Guardando..." : "✓ Guardar"}
              </button>
              <button style={S.btnSecondary} onClick={reset}>
                Grabar otro
              </button>
            </div>
          </div>
        )}

        {/* ── FASE: error ── */}
        {isError && (
          <div style={S.resultZone}>
            <p style={{ color: "#e07060", fontSize: "14px", textAlign: "center" }}>
              ✕ {progressMsg}
            </p>
            <button style={S.btnSecondary} onClick={reset}>
              Intentar de nuevo
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
