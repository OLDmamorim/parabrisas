// /.netlify/functions/save-ocr.mjs
import { neon } from '@neondatabase/serverless';

const CONN = process.env.NEON_DATABASE_URL;
if (!CONN) throw new Error('NEON_DATABASE_URL não definido');

const sql = neon(CONN);

const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
};

let inited = false;
async function init() {
  if (inited) return;
  try {
    // tabela base (como já tinhas)
    await sql`
      create table if not exists ocr_results (
        id bigserial primary key,
        ts timestamptz not null default now(),
        text text,
        filename text,
        source text,
        ip text,
        euro_validado text
      )
    `;
    // coluna brand, só se não existir (seguro)
    await sql`alter table ocr_results add column if not exists brand text`;
    inited = true;
  } catch (e) {
    console.error('Erro ao inicializar tabela:', e);
    throw e;
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    const body = JSON.parse(event.body || '{}');
    const { ts, text, filename, source, euro_validado, eurocode, brand } = body;

    if (!text && !filename) {
      return { statusCode: 400, headers: jsonHeaders, body: '"Texto ou filename obrigatório"' };
    }

    // Normalizar timestamp
    const tsDate = (() => {
      if (typeof ts === 'number') return new Date(ts < 1e12 ? ts * 1000 : ts);
      if (typeof ts === 'string' && ts) {
        const d = new Date(ts);
        if (!Number.isNaN(d.getTime())) return d;
      }
      return new Date();
    })();

    const ip =
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] || null;

    // Usar eurocode ou euro_validado
    const euroFinal = euro_validado || eurocode || '';

    // 1) tenta inserir com brand
    try {
      const rows = await sql`
        insert into ocr_results (ts, text, filename, source, ip, euro_validado, brand)
        values (${tsDate}, ${text || ''}, ${filename || ''}, ${source || ''}, ${ip}, ${euroFinal}, ${brand || null})
        returning id, ts, text, filename, source, euro_validado, brand
      `;
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, row: rows[0] })
      };
    } catch (e1) {
      // 2) fallback legado (sem brand), para nunca bloquear
      console.warn('INSERT com brand falhou, a tentar sem brand:', e1?.message || e1);
      const rows = await sql`
        insert into ocr_results (ts, text, filename, source, ip, euro_validado)
        values (${tsDate}, ${text || ''}, ${filename || ''}, ${source || ''}, ${ip}, ${euroFinal})
        returning id, ts, text, filename, source, euro_validado, brand
      `;
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, row: rows[0], note: 'saved_without_brand' })
      };
    }
  } catch (e) {
    console.error('Erro ao guardar:', e);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};