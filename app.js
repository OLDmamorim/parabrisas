  let timestamp = r.timestamp || r.datahora || r.created_at || r.createdAt || 
                  r.date || r.datetime || r.data || r.hora || r.created || 
                  r.updated_at || r.updatedAt || r.ts || '';

  if (!timestamp) timestamp = new Date().toLocaleString('pt-PT');
  if (typeof timestamp === 'number') timestamp = new Date(timestamp).toLocaleString('pt-PT');
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    try { timestamp = new Date(timestamp).toLocaleString('pt-PT'); } catch (e) {}
  }

  return {
    id:          r.id ?? r.rowId ?? r.uuid ?? r._id ?? null,
    timestamp:   timestamp,
    text:        r.text ?? r.ocr_text ?? r.ocr ?? r.texto ?? '',
    eurocode:    r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? r.codigo ?? '',
    filename:    r.filename ?? r.file ?? '',
    source:      r.source ?? r.origem ?? ''
  };
}

// =========================
