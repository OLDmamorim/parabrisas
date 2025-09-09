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
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    // Tentar buscar com coluna marca, se não existir, buscar sem ela
    let rows;
    try {
      rows = await sql`
        select id, ts, text, filename, source, euro_validado, marca
        from ocr_results
        order by ts desc
        limit 200
      `;
    } catch (e) {
      // Se coluna marca não existir, buscar sem ela
      rows = await sql`
        select id, ts, text, filename, source, euro_validado, null as marca
        from ocr_results
        order by ts desc
        limit 200
      `;
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, rows })
    };
  } catch (e) {
    console.error('Erro na listagem:', e);
    return { 
      statusCode: 500, 
      headers: jsonHeaders, 
      body: JSON.stringify({ ok: false, error: e.message }) 
    };
  }
};

