// netlify/functions/clear-ocr.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.NEON_DATABASE_URL);

export const handler = async (event) => {
  try {
    // Obter parâmetro tipo do query string ou body
    let tipo = 'recepcao'; // padrão
    
    if (event.queryStringParameters?.tipo) {
      tipo = event.queryStringParameters.tipo;
    } else if (event.body) {
      try {
        const body = JSON.parse(event.body);
        tipo = body.tipo || 'recepcao';
      } catch {}
    }
    
    // Se tipo='all', limpar TUDO. Caso contrário, limpar apenas o tipo especificado
    if (tipo === 'all') {
      await sql`DELETE FROM ocr_results`;
    } else {
      await sql`DELETE FROM ocr_results WHERE tipo = ${tipo} OR (tipo IS NULL AND ${tipo} = 'recepcao')`;
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, tipo }) };
  } catch (err) {
    console.error("Erro clear:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};