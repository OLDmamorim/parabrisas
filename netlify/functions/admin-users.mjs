// Endpoint para gestão de utilizadores (apenas admin)
import { jsonHeaders } from './db.mjs';
import { requireAdmin, getAllUsers, updateUser, deleteUser, resetUserPassword } from '../../auth-utils.mjs';

export async function handler(event, context) {
  try {
    // Verificar se é admin
    const adminUser = await requireAdmin(event);
    
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetUsers();
        
      case 'PUT':
        return await handleUpdateUser(event);
        
      case 'DELETE':
        return await handleDeleteUser(event);
        
      case 'PATCH':
        return await handleResetPassword(event);
        
      default:
        return {
          statusCode: 405,
          headers: jsonHeaders,
          body: JSON.stringify({ error: 'Método não permitido' })
        };
    }
    
  } catch (error) {
    console.error('Erro na gestão de utilizadores:', error);
    
    const statusCode = error.message.includes('Acesso negado') ? 403 : 401;
    
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        error: error.message || 'Erro interno do servidor' 
      })
    };
  }
}

async function handleGetUsers() {
  const users = await getAllUsers();
  
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      users
    })
  };
}

async function handleUpdateUser(event) {
  const { userId, ...updates } = JSON.parse(event.body);
  
  if (!userId) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'ID do utilizador é obrigatório' })
    };
  }
  
  const updatedUser = await updateUser(userId, updates);
  
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      message: 'Utilizador atualizado com sucesso',
      user: updatedUser
    })
  };
}

async function handleDeleteUser(event) {
  const { userId } = JSON.parse(event.body);
  
  if (!userId) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'ID do utilizador é obrigatório' })
    };
  }
  
  const deletedUser = await deleteUser(userId);
  
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      message: 'Utilizador eliminado com sucesso',
      user: deletedUser
    })
  };
}

async function handleResetPassword(event) {
  const { userId } = JSON.parse(event.body);
  
  if (!userId) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'ID do utilizador é obrigatório' })
    };
  }
  
  const result = await resetUserPassword(userId);
  
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      message: 'Password redefinida com sucesso',
      newPassword: result.newPassword,
      user: result.user
    })
  };
}

