import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql } from './db.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'expressglass_jwt_secret_2024_muito_seguro_aqui';

// Função para hash de password
export async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

// Função para verificar password
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Função para gerar token JWT
export function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Função para verificar token JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware para verificar autenticação
export async function requireAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autenticação necessário');
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    throw new Error('Token inválido ou expirado');
  }

  // Buscar utilizador na base de dados
  const user = await sql`
    SELECT id, email, name, role, active 
    FROM users 
    WHERE id = ${decoded.userId}
  `;

  if (user.length === 0 || !user[0].active) {
    throw new Error('Utilizador não encontrado ou inativo');
  }

  return user[0];
}

// Função para criar utilizador
export async function createUser(email, password, name, role = 'user') {
  // Verificar se email já existe
  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${email}
  `;

  if (existingUser.length > 0) {
    throw new Error('Email já está em uso');
  }

  // Hash da password
  const hashedPassword = await hashPassword(password);

  // Criar utilizador
  const newUser = await sql`
    INSERT INTO users (email, password_hash, name, role, active, created_at)
    VALUES (${email}, ${hashedPassword}, ${name}, ${role}, true, NOW())
    RETURNING id, email, name, role, active, created_at
  `;

  return newUser[0];
}

// Função para autenticar utilizador
export async function authenticateUser(email, password) {
  // Buscar utilizador
  const user = await sql`
    SELECT id, email, password_hash, name, role, active 
    FROM users 
    WHERE email = ${email}
  `;

  if (user.length === 0) {
    throw new Error('Credenciais inválidas');
  }

  const userData = user[0];

  if (!userData.active) {
    throw new Error('Conta desativada');
  }

  // Verificar password
  const isValidPassword = await verifyPassword(password, userData.password_hash);
  
  if (!isValidPassword) {
    throw new Error('Credenciais inválidas');
  }

  // Remover password_hash do retorno
  const { password_hash, ...userWithoutPassword } = userData;
  
  return userWithoutPassword;
}

// Função para obter todos os utilizadores (admin)
export async function getAllUsers() {
  const users = await sql`
    SELECT id, email, name, role, active, created_at
    FROM users 
    ORDER BY created_at DESC
  `;

  return users;
}

// Função para atualizar utilizador (admin)
export async function updateUser(userId, updates) {
  const { email, name, role, active, password } = updates;
  
  let updateQuery = sql`UPDATE users SET `;
  const setParts = [];
  const values = [];

  if (email !== undefined) {
    setParts.push(`email = $${values.length + 1}`);
    values.push(email);
  }
  
  if (name !== undefined) {
    setParts.push(`name = $${values.length + 1}`);
    values.push(name);
  }
  
  if (role !== undefined) {
    setParts.push(`role = $${values.length + 1}`);
    values.push(role);
  }
  
  if (active !== undefined) {
    setParts.push(`active = $${values.length + 1}`);
    values.push(active);
  }

  if (password) {
    const hashedPassword = await hashPassword(password);
    setParts.push(`password_hash = $${values.length + 1}`);
    values.push(hashedPassword);
  }

  if (setParts.length === 0) {
    throw new Error('Nenhum campo para atualizar');
  }

  const updatedUser = await sql`
    UPDATE users 
    SET ${sql.unsafe(setParts.join(', '))}
    WHERE id = ${userId}
    RETURNING id, email, name, role, active, created_at
  `;

  return updatedUser[0];
}

// Função para eliminar utilizador (admin)
export async function deleteUser(userId) {
  // Primeiro eliminar todos os registos OCR do utilizador
  await sql`DELETE FROM ocr_results WHERE user_id = ${userId}`;
  
  // Depois eliminar o utilizador
  const deletedUser = await sql`
    DELETE FROM users 
    WHERE id = ${userId}
    RETURNING id, email, name
  `;

  return deletedUser[0];
}
