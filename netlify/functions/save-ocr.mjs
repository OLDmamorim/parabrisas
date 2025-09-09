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
    
    // Adicionar coluna marca se não existir (compatibilidade)
    try {
      await sql`ALTER TABLE ocr_results ADD COLUMN IF NOT EXISTS marca text`;
    } catch (e) {
      // Coluna já existe, ignorar
    }
    
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

    const { ts, text, filename, source, euro_validado, eurocode, marca } = JSON.parse(event.body || '{}');
    if (!text && !filename) {
      return { statusCode: 400, headers: jsonHeaders, body: '"Texto ou filename obrigatório"' };
    }

    // Normalizar timestamp
    const tsDate = (() => {
      if (typeof ts === "number") return new Date(ts < 1e12 ? ts * 1000 : ts);
      if (typeof ts === "string" && ts) {
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

    // Tentar inserir com coluna marca, se não existir, inserir sem ela
    let rows;
    try {
      rows = await sql`
        insert into ocr_results (ts, text, filename, source, ip, euro_validado, marca)
        values (${tsDate}, ${text || ''}, ${filename || ''}, ${source || ''}, ${ip}, ${euroFinal}, ${marca || ''})
        returning id, ts, text, filename, source, euro_validado, marca
      `;
    } catch (e) {
      // Se coluna marca não existir, inserir sem ela
      rows = await sql`
        insert into ocr_results (ts, text, filename, source, ip, euro_validado)
        values (${tsDate}, ${text || ''}, ${filename || ''}, ${source || ''}, ${ip}, ${euroFinal})
        returning id, ts, text, filename, source, euro_validado, null as marca
      `;
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, row: rows[0] })
    };
  } catch (e) {
    console.error('Erro ao guardar:', e);
    return { 
      statusCode: 500, 
      headers: jsonHeaders, 
      body: JSON.stringify({ ok: false, error: e.message }) 
    };
  }
};

