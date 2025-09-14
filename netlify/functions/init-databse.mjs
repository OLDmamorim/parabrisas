import { initAuthDatabase } from '../../init-db.mjs';

export const handler = async (event, context) => {
  try {
    await initAuthDatabase();
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Base de dados inicializada com sucesso!' 
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message 
      })
    };
  }
};
