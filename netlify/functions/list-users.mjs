// /.netlify/functions/list-users.mjs
// Função para listar todos os utilizadores (apenas para gestores)
import { jsonHeaders, sql, init } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  if (event.httpMethod !== 'GET') return cors(405, { ok: false, error: 'Method Not Allowed' });

  try {
    await init();
    const user = await requireAuth(event);
    
    // Verificar se o utilizador é gestor ou administrador
    if (user.role !== 'gestor' && user.role !== 'administrador') {
      return err(403, 'Acesso negado. Apenas gestores/administradores podem listar utilizadores.');
    }

    console.log('📋 Listando todos os utilizadores para gestor:', user.email);

    // Listar todos os utilizadores
    const users = await sql`
      SELECT 
        id, 
        email, 
        role,
        created_at
      FROM users 
      ORDER BY role DESC, email ASC
    `;

    console.log(`✅ ${users.length} utilizadores encontrados`);

    return cors(200, {
      ok: true,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role || 'user',
        created_at: u.created_at
      }))
    });

  } catch (e) {
    console.error('❌ Erro ao listar utilizadores:', e);
    return cors(500, { 
      ok: false, 
      error: String(e?.message || e)
    });
  }
};

