import { neon } from '@neondatabase/serverless';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { id, text, eurocode, marca } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID is required' })
      };
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    const sql = neon(process.env.DATABASE_URL);

    // Adicionar coluna marca se não existir (para compatibilidade retroativa)
    try {
      await sql`ALTER TABLE ocr_results ADD COLUMN IF NOT EXISTS marca VARCHAR(100)`;
    } catch (error) {
      // Coluna já existe, ignorar erro
    }

    // Atualizar registo incluindo marca
    const result = await sql`
      UPDATE ocr_results 
      SET text = ${text || ''}, 
          eurocode = ${eurocode || ''}, 
          marca = ${marca || ''}
      WHERE id = ${id}
      RETURNING id, text, eurocode, filename, marca, 
                TO_CHAR(timestamp, 'DD/MM/YYYY HH24:MI:SS') as timestamp
    `;

    if (result.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Record not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result[0]
      })
    };

  } catch (error) {
    console.error('Update OCR Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to update OCR result',
        details: error.message
      })
    };
  }
};

