import { neon } from '@neondatabase/serverless';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
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

    // Buscar todos os registos incluindo marca
    const results = await sql`
      SELECT id, text, eurocode, filename, marca, 
             TO_CHAR(timestamp, 'DD/MM/YYYY HH24:MI:SS') as timestamp
      FROM ocr_results 
      ORDER BY timestamp DESC
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results)
    };

  } catch (error) {
    console.error('List OCR Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch OCR results',
        details: error.message
      })
    };
  }
};

