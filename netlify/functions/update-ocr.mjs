// /.netlify/functions/update-ocr.mjs - Com autenticação
import { jsonHeaders, sql, init } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

// Função para detetar marca do texto (copiada do original)
function detectBrandFromText(text) {
  if (!text) return '';
  const t = String(text).toUpperCase();
  
  const brands = [
    'PILKINGTON', 'GUARDIAN', 'SAINT-GOBAIN', 'SEKURIT', 'FUYAO',
    'XINYI', 'ASAHI', 'CENTRAL', 'VITRO', 'SOLIVER', 'SPLINTEX',
    'BENSON', 'SHATTERPRUFE', 'TAMGLASS', 'GLASSOLUTIONS', 'CARGLASS'
  ];
  
  for (const brand of brands) {
    if (t.includes(brand)) return brand;
  }
  return '';
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  if (event.httpMethod !== 'POST')    return cors(405, { ok: false, error: 'Method Not Allowed' });

  try {
    // Inicializar BD
    await init();
    
    // Verificar autenticação
    const user = await requireAuth(event);
    
    const payload = JSON.parse(event.body || '{}');
    const { id } = payload || {};
    if (!id) return cors(400, { ok: false, error: 'Missing id' });

    // Ir buscar o registo atual e verificar se pertence ao utilizador
    const current = await sql`
      SELECT * FROM ocr_results 
      WHERE id = ${id} AND user_id = ${user.id} 
      LIMIT 1
    `;
    
    if (!current || current.length === 0) {
      return cors(404, { ok: false, error: 'Registo não encontrado ou sem permissão' });
    }
    
    const currentRecord = current[0];

    // Preparar novos valores (mantém o que não vier)
    const newText     = payload.text ?? currentRecord.text;
    const newEurocode = payload.eurocode ?? currentRecord.eurocode ?? currentRecord.euro_validado;
    const newFilename = payload.filename ?? currentRecord.filename;
    const newSource   = payload.source ?? currentRecord.source;
    const newVehicle  = payload.vehicle ?? currentRecord.vehicle;
    const newMatricula = payload.matricula ?? currentRecord.matricula;
    const newLoja = payload.loja ?? currentRecord.loja ?? 'LOJA';
    const newObservacoes = payload.observacoes ?? currentRecord.observacoes ?? '';

    // Brand: se o cliente enviou, usa; senão, se o texto mudou, recalcula; senão mantém
    let newBrand = payload.brand;
    if (newBrand === undefined) {
      newBrand = newText !== currentRecord.text ? detectBrandFromText(newText) : currentRecord.brand;
    }

    // Atualizar registo
    try {
      const rows = await sql`
        UPDATE ocr_results
        SET 
          text = ${newText},
          eurocode = ${newEurocode},
          brand = ${newBrand || ''},
          vehicle = ${newVehicle || ''},
          filename = ${newFilename},
          source = ${newSource},
          matricula = ${newMatricula || null},
          loja = ${newLoja || 'LOJA'},
          observacoes = ${newObservacoes || ''}
        WHERE id = ${id} AND user_id = ${user.id}
        RETURNING id, ts AS updated_at
      `;
      
      if (rows.length === 0) {
        return cors(404, { ok: false, error: 'Registo não encontrado' });
      }
      
      return cors(200, { ok: true, row: rows[0] });
      
    } catch (e) {
      // Fallback se algumas colunas não existirem
      const msg = String(e?.message || e);
      if (msg.includes('column') && msg.includes('does not exist')) {
        const rows = await sql`
          UPDATE ocr_results
          SET 
            text = ${newText},
            filename = ${newFilename},
            source = ${newSource}
          WHERE id = ${id} AND user_id = ${user.id}
          RETURNING id, ts AS updated_at
        `;
        
        return cors(200, { ok: true, row: rows[0], note: 'Some columns missing (ignored)' });
      }
      throw e;
    }

  } catch (e) {
    console.error('Erro ao atualizar OCR:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return cors(statusCode, { ok: false, error: String(e?.message || e) });
  }
};