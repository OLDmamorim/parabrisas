// netlify/functions/clear-ocr.mjs
import { neon } from "@neondatabase/serverless";
import { requireAuth } from './auth-utils.mjs';

const sql = neon(process.env.NEON_DATABASE_URL);

export const handler = async (event) => {
  try {
    // Verificar autenticação e obter utilizador
    const user = await requireAuth(event);
    const userId = user.id;
    
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
    
    // IMPORTANTE: Sempre filtrar por user_id para garantir isolamento de dados
    // Se tipo='all', limpar TUDO do utilizador. Caso contrário, limpar apenas o tipo especificado
    if (tipo === 'all') {
      await sql`DELETE FROM ocr_results WHERE user_id = ${userId}`;
    } else {
      await sql`DELETE FROM ocr_results WHERE user_id = ${userId} AND (tipo = ${tipo} OR (tipo IS NULL AND ${tipo} = 'recepcao'))`;
    }
    
    return { statusCode: 200, body: JSON.stringify({ ok: true, tipo, userId }) };
  } catch (err) {
    console.error("Erro clear:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};