/**
 * LearningsPanel.jsx
 * Ubicación: src/components/LearningsPanel.jsx
 *
 * Panel de gestión de lo que GaIA va aprendiendo automáticamente de las
 * conversaciones con el creator (ver backend classification.py):
 *
 *   - Estructura Basal: ajustes sobre el propio comportamiento de GaIA.
 *     Cada nota se puede desactivar (revertir el aprendizaje al instante)
 *     o eliminar definitivamente.
 *   - Conocimiento (Enciclopedia / Astrología): contenido extraído de
 *     conversación viva, privado hasta que se promueve a visibilidad
 *     pública — mismo patrón que la promoción de audios.
 *
 * Props:
 *   apiBase    {string}  URL base del backend
 *   authToken  {string}  Token Bearer de la sesión actual
 *   onClose    {func}    Callback para cerrar el panel
 */

import { useState, useEffect, useCallback } from "react";

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    width: "min(600px, 94vw)", maxHeight: "85vh", overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    fontFamily: "'Georgia', serif", color: "#e8d5b0",
    display: "flex", flexDirection: "column", gap: "14px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 },
  title: { fontSize: "18px", fontWeight: "600", color: "#d4ae78", margin: 0 },
  subtitle: { fontSize: "12px", color: "#8a7055", marginTop: "4px", fontStyle: "italic" },
  btnClose: { background: "none", border: "none", color: "#8a7055", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "2px 6px" },

  tabs: { display: "flex", gap: "8px", flexShrink: 0 },
  tab: (active) => ({
    flex: 1, padding: "8px 12px", borderRadius: "12px", cursor: "pointer",
    fontSize: "12px", textAlign: "center",
    background: active ? "rgba(196,144,80,0.18)" : "transparent",
    border: "1px solid " + (active ? "rgba(196,144,80,0.4)" : "rgba(212,174,120,0.15)"),
    color: active ? "#d4ae78" : "#8a7055",
  }),

  catFilter: { display: "flex", gap: "6px", flexShrink: 0 },
  catBtn: (active) => ({
    padding: "5px 12px", borderRadius: "14px", fontSize: "11px", cursor: "pointer",
    background: active ? "rgba(196,144,80,0.18)" : "transparent",
    border: "1px solid " + (active ? "rgba(196,144,80,0.4)" : "rgba(212,174,120,0.15)"),
    color: active ? "#d4ae78" : "#8a7055",
  }),

  list: { overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" },
  item: {
    padding: "12px 14px", borderRadius: "12px",
    border: "1px solid rgba(212,174,120,0.15)", background: "rgba(255,255,255,0.03)",
  },
  itemContent: { fontSize: "13px", color: "#d8c5a0", lineHeight: 1.5, marginBottom: "8px" },
  itemMeta: { fontSize: "10px", color: "#6a5540", marginBottom: "8px" },
  itemActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  smallBtn: (tone) => ({
    padding: "5px 12px", borderRadius: "10px", fontSize: "11px", cursor: "pointer",
    border: "1px solid " + (tone === 'danger' ? 'rgba(200,90,70,0.35)' : tone === 'ok' ? 'rgba(120,170,110,0.35)' : 'rgba(212,174,120,0.25)'),
    background: "transparent",
    color: tone === 'danger' ? '#e0a080' : tone === 'ok' ? '#a8d0a0' : '#c49050',
  }),
  badge: (tone) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "10px", fontSize: "10px",
    background: tone === 'public' ? 'rgba(120,170,110,0.15)' : 'rgba(196,144,80,0.12)',
    color: tone === 'public' ? '#a8d0a0' : '#c49050',
  }),

  empty: { fontSize: "13px", color: "#6a5540", textAlign: "center", padding: "24px 0", fontStyle: "italic" },
  loading: { fontSize: "13px", color: "#6a5540", textAlign: "center", padding: "24px 0", fontStyle: "italic" },
};

export default function LearningsPanel({ apiBase, authToken, onClose }) {
  const [tab, setTab] = useState('basal'); // 'basal' | 'knowledge'
  const [basalNotes, setBasalNotes] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [catFilter, setCatFilter] = useState(null); // null | 'Enciclopedia de la Biología' | 'Astrología'
  const [loading, setLoading] = useState(true);

  const authHeaders = { Authorization: `Bearer ${authToken}` };

  const loadBasal = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/learnings/basal`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => setBasalNotes(data.notes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase, authToken]);

  const loadKnowledge = useCallback(() => {
    setLoading(true);
    const url = catFilter
      ? `${apiBase}/learnings/knowledge?category=${encodeURIComponent(catFilter)}`
      : `${apiBase}/learnings/knowledge`;
    fetch(url, { headers: authHeaders })
      .then(r => r.json())
      .then(data => setKnowledgeItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase, authToken, catFilter]);

  useEffect(() => {
    if (tab === 'basal') loadBasal();
    else loadKnowledge();
  }, [tab, loadBasal, loadKnowledge]);

  const toggleBasal = useCallback(async (id, active) => {
    setBasalNotes(prev => prev.map(n => n.id === id ? { ...n, active } : n));
    try {
      await fetch(`${apiBase}/learnings/basal/${id}/toggle`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    } catch (_) {}
  }, [apiBase, authToken]);

  const deleteBasal = useCallback(async (id) => {
    setBasalNotes(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`${apiBase}/learnings/basal/${id}`, { method: "DELETE", headers: authHeaders });
    } catch (_) {}
  }, [apiBase, authToken]);

  const promoteKnowledge = useCallback(async (id, visibility) => {
    setKnowledgeItems(prev => prev.map(k => k.id === id ? { ...k, visibility } : k));
    try {
      await fetch(`${apiBase}/learnings/knowledge/${id}/promote`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
    } catch (_) {}
  }, [apiBase, authToken]);

  const deleteKnowledge = useCallback(async (id) => {
    setKnowledgeItems(prev => prev.filter(k => k.id !== id));
    try {
      await fetch(`${apiBase}/learnings/knowledge/${id}`, { method: "DELETE", headers: authHeaders });
    } catch (_) {}
  }, [apiBase, authToken]);

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.panel}>

        <div style={S.header}>
          <div>
            <h2 style={S.title}>Aprendizajes de GaIA</h2>
            <p style={S.subtitle}>Lo que GaIA extrae automáticamente de vuestras conversaciones</p>
          </div>
          <button style={S.btnClose} onClick={onClose}>×</button>
        </div>

        <div style={S.tabs}>
          <div style={S.tab(tab === 'basal')} onClick={() => setTab('basal')}>Estructura Basal</div>
          <div style={S.tab(tab === 'knowledge')} onClick={() => setTab('knowledge')}>Enciclopedia / Astrología</div>
        </div>

        {tab === 'knowledge' && (
          <div style={S.catFilter}>
            <div style={S.catBtn(!catFilter)} onClick={() => setCatFilter(null)}>Todas</div>
            <div style={S.catBtn(catFilter === 'Enciclopedia de la Biología')} onClick={() => setCatFilter('Enciclopedia de la Biología')}>Enciclopedia</div>
            <div style={S.catBtn(catFilter === 'Astrología')} onClick={() => setCatFilter('Astrología')}>Astrología</div>
          </div>
        )}

        <div style={S.list}>
          {loading && <p style={S.loading}>Cargando...</p>}

          {/* ── Estructura Basal ── */}
          {!loading && tab === 'basal' && basalNotes.length === 0 && (
            <p style={S.empty}>Aún no hay ajustes de comportamiento aprendidos.</p>
          )}
          {!loading && tab === 'basal' && basalNotes.map(n => (
            <div key={n.id} style={S.item}>
              <p style={S.itemContent}>{n.content}</p>
              <p style={S.itemMeta}>{fmtDate(n.created_at)} · {n.active ? 'activa' : 'desactivada'}</p>
              <div style={S.itemActions}>
                {n.active ? (
                  <button style={S.smallBtn('danger')} onClick={() => toggleBasal(n.id, false)}>Desactivar (revertir)</button>
                ) : (
                  <button style={S.smallBtn('ok')} onClick={() => toggleBasal(n.id, true)}>Reactivar</button>
                )}
                <button style={S.smallBtn()} onClick={() => deleteBasal(n.id)}>Eliminar definitivamente</button>
              </div>
            </div>
          ))}

          {/* ── Conocimiento ── */}
          {!loading && tab === 'knowledge' && knowledgeItems.length === 0 && (
            <p style={S.empty}>Aún no hay conocimiento extraído de conversación.</p>
          )}
          {!loading && tab === 'knowledge' && knowledgeItems.map(k => (
            <div key={k.id} style={S.item}>
              <p style={S.itemContent}>{k.content}</p>
              <p style={S.itemMeta}>
                {k.category} · {fmtDate(k.created_at)}{' '}
                <span style={S.badge(k.visibility === 'all' ? 'public' : 'private')}>
                  {k.visibility === 'all' ? 'público' : 'privado'}
                </span>
              </p>
              <div style={S.itemActions}>
                {k.visibility === 'all' ? (
                  <button style={S.smallBtn()} onClick={() => promoteKnowledge(k.id, 'creator')}>Volver a privado</button>
                ) : (
                  <button style={S.smallBtn('ok')} onClick={() => promoteKnowledge(k.id, 'all')}>Promover a público</button>
                )}
                <button style={S.smallBtn('danger')} onClick={() => deleteKnowledge(k.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
