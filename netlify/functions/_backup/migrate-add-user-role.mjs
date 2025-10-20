// /.netlify/functions/migrate-add-user-role.mjs
// Função para adicionar coluna role à tabela users
import { jsonHeaders, sql, init } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  if (event.httpMethod !== 'POST') return cors(405, { ok: false, error: 'Method Not Allowed' });

  try {
    await init();
    const user = await requireAuth(event);
    
    // Apenas admin pode executar migrações
    if (user.email !== 'mramorim78@gmail.com') {
      return cors(403, { ok: false, error: 'Acesso negado. Apenas admin pode executar migrações.' });
    }

    console.log('🔧 Iniciando migração: adicionar coluna role aos utilizadores');

    // Verificar se a coluna já existe
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'role'
    `;

    if (checkColumn.length > 0) {
      console.log('✅ Coluna role já existe');
      
      // Atualizar admin para gestor se ainda não for
      await sql`
        UPDATE users
        SET role = 'gestor'
        WHERE email = 'mramorim78@gmail.com' AND (role IS NULL OR role != 'gestor')
      `;
      
      return cors(200, { 
        ok: true, 
        message: 'Coluna role já existe. Admin atualizado para gestor.',
        already_exists: true 
      });
    }

    // Adicionar coluna role
    console.log('📝 Adicionando coluna role...');
    await sql`
      ALTER TABLE users 
      ADD COLUMN role VARCHAR(20) DEFAULT 'user'
    `;

    console.log('✅ Coluna role adicionada com sucesso');

    // Atualizar admin para gestor
    console.log('📝 Atualizando admin para gestor...');
    await sql`
      UPDATE users
      SET role = 'gestor'
      WHERE email = 'mramorim78@gmail.com'
    `;

    console.log('✅ Admin atualizado para gestor');

    // Listar utilizadores
    const users = await sql`
      SELECT id, email, role FROM users ORDER BY role DESC, email
    `;

    return cors(200, {
      ok: true,
      message: 'Migração executada com sucesso',
      column_added: true,
      users: users
    });

  } catch (e) {
    console.error('❌ Erro na migração:', e);
    return cors(500, { 
      ok: false, 
      error: String(e?.message || e),
      details: e.stack 
    });
  }
};

