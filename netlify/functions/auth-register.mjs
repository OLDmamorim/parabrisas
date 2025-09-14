// Endpoint para registo de novos utilizadores
import { jsonHeaders } from './db.mjs';
import { createUser, generateToken } from './auth-utils.mjs';

export async function handler(event, context) {
  // Apenas POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }
  
  try {
    const { email, password, name } = JSON.parse(event.body);
    
    // Validar campos obrigatórios
    if (!email || !password || !name) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ 
          error: 'Email, password e nome são obrigatórios' 
        })
      };
    }
    
    // Criar utilizador
    const user = await createUser(email, password, name);
    
    // Gerar token
    const token = generateToken(user);
    
    return {
      statusCode: 201,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Utilizador criado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      })
    };
    
  } catch (error) {
    console.error('Erro no registo:', error);
    
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        error: error.message || 'Erro interno do servidor' 
      })
    };
  }
}

