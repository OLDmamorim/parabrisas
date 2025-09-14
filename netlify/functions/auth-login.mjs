// Endpoint para login de utilizadores
import { jsonHeaders } from '../../db.mjs';
import { authenticateUser, generateToken } from '../../auth-utils.mjs';

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
    const { email, password } = JSON.parse(event.body);
    
    // Validar campos obrigatórios
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ 
          error: 'Email e password são obrigatórios' 
        })
      };
    }
    
    // Autenticar utilizador
    const user = await authenticateUser(email, password);
    
    // Gerar token
    const token = generateToken(user);
    
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Login realizado com sucesso',
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
    console.error('Erro no login:', error);
    
    return {
      statusCode: 401,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        error: error.message || 'Credenciais inválidas' 
      })
    };
  }
}