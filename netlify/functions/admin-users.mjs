// /.netlify/functions/admin-users.mjs
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
};
const ok = (data) => ({ statusCode: 200, headers: cors, body: JSON.stringify({ success: true, ...data }) });
const err = (code, msg) => ({ statusCode: code, headers: cors, body: JSON.stringify({ success: false, error: msg }) });

function needEnv() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
}
function getUserFromJWT(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { const e = new Error('Sem token'); e.code = 401; throw e; }
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { const e = new Error('Token inválido'); e.code = 401; throw e; }
}
function assertAdmin(user) {
  if (!user || user.role !== 'admin') { const e = new Error('Acesso negado'); e.code = 403; throw e; }
}
const genPass = (n=10)=> {
  const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  return Array.from({length:n},()=>c[Math.floor(Math.random()*c.length)]).join('');
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({});
  try {
    needEnv();
    const me = getUserFromJWT(event);
    assertAdmin(me);
    const sql = neon(process.env.DATABASE_URL);

    if (event.httpMethod === 'GET') {
      const users = await sql/*sql*/`
        SELECT id, name, email, COALESCE(role,'user') AS role,
               COALESCE(is_active,true) AS is_active, created_at, last_login
        FROM users
        ORDER BY created_at DESC NULLS LAST, id DESC
      `;
      return ok({ users });
    }

    if (event.httpMethod === 'PUT') {
      const { userId, name, role, is_active } = JSON.parse(event.body || '{}');
      if (!userId) return err(400, 'ID do utilizador é obrigatório');
      const rows = await sql/*sql*/`
        UPDATE users
        SET name=${name ?? null}, role=${role ?? 'user'}, is_active=${is_active ?? true}
        WHERE id=${userId}
        RETURNING id, name, email, role, is_active, created_at, last_login
      `;
      if (!rows.length) return err(404, 'Utilizador não encontrado');
      return ok({ user: rows[0], message: 'Utilizador atualizado com sucesso' });
    }

    if (event.httpMethod === 'PATCH') {
      const { userId } = JSON.parse(event.body || '{}');
      if (!userId) return err(400, 'ID do utilizador é obrigatório');
      const newPassword = genPass();
      const hash = await bcrypt.hash(newPassword, 10);
      const rows = await sql/*sql*/`
        UPDATE users SET password_hash=${hash} WHERE id=${userId} RETURNING id
      `;
      if (!rows.length) return err(404, 'Utilizador não encontrado');
      return ok({ newPassword, message: 'Password redefinida com sucesso' });
    }

    if (event.httpMethod === 'DELETE') {
      const { userId } = JSON.parse(event.body || '{}');
      if (!userId) return err(400, 'ID do utilizador é obrigatório');
      const rows = await sql/*sql*/`DELETE FROM users WHERE id=${userId} RETURNING id`;
      if (!rows.length) return err(404, 'Utilizador não encontrado');
      return ok({ deleted: true, message: 'Utilizador eliminado com sucesso' });
    }

    return err(405, 'Método não permitido');
  } catch (e) {
    const code = e.code || 500;
    return err(code, String(e.message || e));
  }
};
