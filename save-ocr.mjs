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

    const { text, eurocode, filename, marca } = JSON.parse(event.body || '{}');
    const ip = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';

    // Tentar inserir com coluna marca, se não existir, inserir sem ela
    let result;
    try {
      result = await sql`
        insert into ocr_results (text, filename, source, ip, euro_validado, marca)
        values (${text || ''}, ${filename || ''}, 'web', ${ip}, ${eurocode || ''}, ${marca || ''})
        returning id, ts, text, filename, source, euro_validado, marca
      `;
    } catch (e) {
      // Se coluna marca não existir, inserir sem ela
      result = await sql`
        insert into ocr_results (text, filename, source, ip, euro_validado)
        values (${text || ''}, ${filename || ''}, 'web', ${ip}, ${eurocode || ''})
        returning id, ts, text, filename, source, euro_validado, null as marca
      `;
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, data: result[0] })
    };
  } catch (e) {
    console.error('Erro ao salvar:', e);
    return { 
      statusCode: 500, 
      headers: jsonHeaders, 
      body: JSON.stringify({ ok: false, error: e.message }) 
    };
  }
};

