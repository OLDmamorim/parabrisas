// Utilitários de autenticação
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('./db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui';
const JWT_EXPIRES_IN = '24h';

// Hash de password
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verificar password
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Gerar JWT token
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verificar JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido');
  }
}

// Validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validar password
function isValidPassword(password) {
  // Mínimo 8 caracteres, pelo menos 1 maiúscula, 1 minúscula, 1 número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Obter utilizador por ID
async function getUserById(userId) {
  const result = await sql`
    SELECT id, email, name, role, created_at, last_login, is_active
    FROM users 
    WHERE id = ${userId} AND is_active = true
  `;
  return result[0] || null;
}

// Obter utilizador por email
async function getUserByEmail(email) {
  const result = await sql`
    SELECT id, email, name, role, password_hash, created_at, last_login, is_active
    FROM users 
    WHERE email = ${email}
  `;
  return result[0] || null;
}

// Criar novo utilizador
async function createUser(email, password, name, role = 'user') {
  // Validações
  if (!isValidEmail(email)) {
    throw new Error('Email inválido');
  }
  
  if (!isValidPassword(password)) {
    throw new Error('Password deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número');
  }
  
  // Verificar se email já existe
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email já está em uso');
  }
  
  // Hash da password
  const passwordHash = await hashPassword(password);
  
  // Inserir utilizador
  const result = await sql`
    INSERT INTO users (email, name, password_hash, role, is_active, created_at)
    VALUES (${email}, ${name}, ${passwordHash}, ${role}, true, NOW())
    RETURNING id, email, name, role, created_at, is_active
  `;
  
  return result[0];
}

// Autenticar utilizador
async function authenticateUser(email, password) {
  const user = await getUserByEmail(email);
  
  if (!user) {
    throw new Error('Email ou password incorretos');
  }
  
  if (!user.is_active) {
    throw new Error('Conta desativada');
  }
  
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Email ou password incorretos');
  }
  
  // Atualizar último login
  await sql`
    UPDATE users 
    SET last_login = NOW() 
    WHERE id = ${user.id}
  `;
  
  // Remover password_hash do retorno
  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Middleware de autenticação
async function requireAuth(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autenticação necessário');
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  // Verificar se utilizador ainda existe e está ativo
  const user = await getUserById(decoded.userId);
  if (!user) {
    throw new Error('Utilizador inválido ou inativo');
  }
  
  return user;
}

// Middleware de administrador
async function requireAdmin(event) {
  const user = await requireAuth(event);
  if (user.role !== 'admin') {
    throw new Error('Acesso negado - privilégios de administrador necessários');
  }
  return user;
}

// Obter todos os utilizadores (apenas admin)
async function getAllUsers() {
  const result = await sql`
    SELECT id, email, name, role, created_at, last_login, is_active, matricula
    FROM users 
    ORDER BY created_at DESC
  `;
  return result;
}

// Atualizar utilizador
async function updateUser(userId, updates) {
  const allowedFields = ['name', 'role', 'is_active'];
  const updateFields = {};
  
  // Filtrar apenas campos permitidos
  for (const field of allowedFields) {
    if (updates.hasOwnProperty(field)) {
      updateFields[field] = updates[field];
    }
  }
  
  if (Object.keys(updateFields).length === 0) {
    throw new Error('Nenhum campo válido para atualizar');
  }
  
  // Construir query dinamicamente
  const setClause = Object.keys(updateFields)
    .map(field => `${field} = $${Object.keys(updateFields).indexOf(field) + 2}`)
    .join(', ');
  
  const values = [userId, ...Object.values(updateFields)];
  
  const result = await sql`
    UPDATE users 
    SET ${sql.unsafe(setClause)}
    WHERE id = $1
    RETURNING id, email, name, role, created_at, last_login, is_active
  `.apply(null, values);
  
  if (result.length === 0) {
    throw new Error('Utilizador não encontrado');
  }
  
  return result[0];
}

// Eliminar utilizador
async function deleteUser(userId) {
  // Primeiro, eliminar registos OCR associados
  await sql`DELETE FROM ocr_results WHERE user_id = ${userId}`;
  
  // Depois, eliminar o utilizador
  const result = await sql`
    DELETE FROM users 
    WHERE id = ${userId}
    RETURNING id, email, name, role
  `;
  
  if (result.length === 0) {
    throw new Error('Utilizador não encontrado');
  }
  
  return result[0];
}

// Reset de password
async function resetUserPassword(userId) {
  // Gerar nova password temporária
  const newPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await hashPassword(newPassword);
  
  const result = await sql`
    UPDATE users 
    SET password_hash = ${passwordHash}
    WHERE id = ${userId}
    RETURNING id, email, name, role
  `;
  
  if (result.length === 0) {
    throw new Error('Utilizador não encontrado');
  }
  
  return {
    user: result[0],
    newPassword
  };
}

// Validar e formatar matrícula
function isValidMatricula(matricula) {
  if (!matricula) return true; // Campo opcional
  
  // Formato: XX-XX-XX (2 dígitos/letras, hífen, 2 dígitos/letras, hífen, 2 dígitos/letras)
  const matriculaRegex = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/;
  return matriculaRegex.test(matricula.toUpperCase());
}

function formatMatricula(matricula) {
  if (!matricula) return '';
  
  // Remover espaços e converter para maiúsculas
  const clean = matricula.replace(/\s/g, '').toUpperCase();
  
  // Se já tem hífens no formato correto, retornar
  if (/^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/.test(clean)) {
    return clean;
  }
  
  // Se tem 6 caracteres sem hífens, adicionar hífens
  if (/^[A-Z0-9]{6}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  
  return matricula; // Retornar original se não conseguir formatar
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  isValidEmail,
  isValidPassword,
  getUserById,
  getUserByEmail,
  createUser,
  authenticateUser,
  requireAuth,
  requireAdmin,
  getAllUsers,
  updateUser,
  deleteUser,
  resetUserPassword,
  isValidMatricula,
  formatMatricula
};