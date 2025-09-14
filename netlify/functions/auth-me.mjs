// Endpoint para obter e atualizar dados do utilizador atual
import { jsonHeaders, sql } from '../db.mjs';
import { requireAuth, formatMatricula, isValidMatricula } from '../auth-utils.mjs';

export async function handler(event, context) {
  try {
    // Verificar autenticação
    const user = await requireAuth(event);
    
    if (event.httpMethod === 'GET') {
      return await handleGetUser(user);
    } else if (event.httpMethod === 'PATCH') {
      return await handleUpdateUser(event, user);
    } else {
      return {
        statusCode: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Método não permitido' })
      };
    }
    
  } catch (error) {
    console.error('Erro no auth-me:', error);
    
    return {
      statusCode: 401,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        error: error.message || 'Não autorizado' 
      })
    };
  }
}

async function handleGetUser(user) {
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        matricula: user.matricula,
        created_at: user.created_at,
        last_login: user.last_login
      }
    })
  };
}

async function handleUpdateUser(event, user) {
  const { matricula } = JSON.parse(event.body);
  
  // Validar e formatar matrícula se fornecida
  let formattedMatricula = null;
  if (matricula) {
    formattedMatricula = formatMatricula(matricula);
    if (!isValidMatricula(formattedMatricula)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Formato de matrícula inválido. Use XX-XX-XX' })
      };
    }
  }
  
  // Atualizar na base de dados
  const result = await sql`
    UPDATE users 
    SET matricula = ${formattedMatricula}, updated_at = NOW()
    WHERE id = ${user.id}
    RETURNING id, email, name, role, matricula, created_at, last_login, is_active
  `;
  
  if (result.length === 0) {
    return {
      statusCode: 404,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Utilizador não encontrado' })
    };
  }
  
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      message: 'Matrícula atualizada com sucesso',
      user: result[0]
    })
  };
}

