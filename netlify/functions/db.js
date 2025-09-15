// Helper de ligação ao Neon + criação da tabela na 1ª execução
const { neon } = require('@neondatabase/serverless');

const CONN = process.env.NEON_DATABASE_URL;
if (!CONN) throw new Error('NEON_DATABASE_URL não definido');

const sql = neon(CONN);

let inited = false;
async function init() {
  if (inited) return;
  await sql/*sql*/`
    create table if not exists ocr_results (
      id bigserial primary key,
      ts timestamptz not null default now(),
      text text,
      filename text,
      source text,
      ip text
    )
  `;
  inited = true;
}

// headers comuns
const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
};

module.exports = {
  sql,
  init,
  jsonHeaders
};