// netlify/functions/delete-ocr.mjs - Com autenticação
import { jsonHeaders, sql, init } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

export const handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true })
    };
  }
  
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Inicializar BD
    await init();
    
    // Verificar autenticação
    const user = await requireAuth(event);
    
    const { id } = JSON.parse(event.body || "{}");
    if (!id) {
      return { 
        statusCode: 400, 
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Missing id" }) 
      };
    }

    // Eliminar apenas se pertencer ao utilizador
    const result = await sql`
      DELETE FROM ocr_results 
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Registo não encontrado ou sem permissão" })
      };
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, deleted: id })
    };
    
  } catch (err) {
    console.error("Erro DELETE:", err);
    const statusCode = err.message.includes('Token') || err.message.includes('autenticação') ? 401 : 500;
    
    return { 
      statusCode, 
      headers: jsonHeaders,
      body: JSON.stringify({ error: err.message }) 
    };
  }
};

