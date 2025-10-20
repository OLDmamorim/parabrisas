import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders };
  }

  try {
    const user = await requireAuth(event);
    const path = event.path.replace('/.netlify/functions/inventario-api', '');
    const method = event.httpMethod;

    // POST /inventario - Criar novo inventário
    if (method === 'POST' && path === '') {
      const { loja } = JSON.parse(event.body || '{}');
      const [inventario] = await sql`
        INSERT INTO inventarios (user_id, user_email, loja, status, total_items)
        VALUES (${user.id || null}, ${user.email}, ${loja || 'Desconhecida'}, 'aberto', 0)
        RETURNING *
      `;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventario }) };
    }

    // GET /inventario - Listar todos os inventários
    if (method === 'GET' && path === '') {
      const inventarios = await sql`
        SELECT * FROM inventarios 
        ORDER BY data_inventario DESC
      `;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventarios }) };
    }

    // GET /inventario/:id - Obter inventário específico
    if (method === 'GET' && path.match(/^\/\d+$/)) {
      const id = parseInt(path.substring(1));
      const [inventario] = await sql`
        SELECT * FROM inventarios WHERE id = ${id}
      `;
      if (!inventario) {
        return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Inventário não encontrado' }) };
      }
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventario }) };
    }

    // GET /inventario/:id/items - Listar items de um inventário
    if (method === 'GET' && path.match(/^\/\d+\/items$/)) {
      const id = parseInt(path.split('/')[1]);
      const items = await sql`
        SELECT * FROM inventario_items 
        WHERE inventario_id = ${id}
        ORDER BY created_at ASC
      `;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, items }) };
    }

    // POST /inventario/:id/items - Adicionar item ao inventário
    if (method === 'POST' && path.match(/^\/\d+\/items$/)) {
      const id = parseInt(path.split('/')[1]);
      const { hora, tipo, veiculo, eurocode, marca, matricula, sm_loja, obs } = JSON.parse(event.body || '{}');

      // Verificar se inventário existe e está aberto
      const [inventario] = await sql`
        SELECT * FROM inventarios WHERE id = ${id}
      `;
      if (!inventario) {
        return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Inventário não encontrado' }) };
      }
      if (inventario.status === 'fechado') {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Inventário já está fechado' }) };
      }

      // Adicionar item
      const [item] = await sql`
        INSERT INTO inventario_items (
          inventario_id, hora, tipo, veiculo, eurocode, marca, matricula, sm_loja, obs
        ) VALUES (
          ${id}, ${hora}, ${tipo}, ${veiculo}, ${eurocode}, ${marca}, ${matricula || ''}, ${sm_loja || ''}, ${obs || ''}
        )
        RETURNING *
      `;

      // Atualizar contador de items
      await sql`
        UPDATE inventarios 
        SET total_items = (SELECT COUNT(*) FROM inventario_items WHERE inventario_id = ${id}),
            updated_at = NOW()
        WHERE id = ${id}
      `;

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, item }) };
    }

    // DELETE /inventario/:id - Eliminar inventário
    if (method === 'DELETE' && path.match(/^\/\d+$/)) {
      const id = parseInt(path.substring(1));
      
      // Eliminar items do inventário primeiro
      await sql`
        DELETE FROM inventario_items WHERE inventario_id = ${id}
      `;
      
      // Eliminar o inventário
      const [inventario] = await sql`
        DELETE FROM inventarios WHERE id = ${id}
        RETURNING *
      `;

      if (!inventario) {
        return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Inventário não encontrado' }) };
      }

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, message: 'Inventário eliminado com sucesso' }) };
    }

    // POST /inventario/:id/close - Fechar inventário
    if (method === 'POST' && path.match(/^\/\d+\/close$/)) {
      const id = parseInt(path.split('/')[1]);
      
      const [inventario] = await sql`
        UPDATE inventarios 
        SET status = 'fechado', updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (!inventario) {
        return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Inventário não encontrado' }) };
      }

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventario }) };
    }

    // Rota não encontrada
    return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Rota não encontrada' }) };

  } catch (e) {
    console.error('Erro na API de inventário:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};

