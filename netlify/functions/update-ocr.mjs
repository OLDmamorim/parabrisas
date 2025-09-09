import { neon } from '@neondatabase/serverless';

const CONN = process.env.NEON_DATABASE_URL;
if (!CONN) throw new Error('NEON_DATABASE_URL não definido');

const sql = neon(CONN);

const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    const { id, text, eurocode, filename, source, marca } = JSON.parse(event.body || '{}');
    
    if (!id) {
      return { statusCode: 400, headers: jsonHeaders, body: '"ID é obrigatório"' };
    }

    if (!text && !eurocode) {
      return { statusCode: 400, headers: jsonHeaders, body: '"Texto ou Eurocode é obrigatório"' };
    }

    // Atualizar registo na base de dados
    const rows = await sql`
      update ocr_results 
      set text = ${text || ''}, 
          euro_validado = ${eurocode || ''}, 
          filename = ${filename || ''}, 
          source = ${source || ''},
          marca = ${marca || ''}
      where id = ${id}
      returning id, ts, text, filename, source, euro_validado, marca
    `;

    if (rows.length === 0) {
      return { 
        statusCode: 404, 
        headers: jsonHeaders, 
        body: JSON.stringify({ ok: false, error: 'Registo não encontrado' }) 
      };
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, row: rows[0] })
    };
    
  } catch (e) {
    console.error('Erro ao atualizar:', e);
    return { 
      statusCode: 500, 
      headers: jsonHeaders, 
      body: JSON.stringify({ ok: false, error: e.message }) 
    };
  }
};