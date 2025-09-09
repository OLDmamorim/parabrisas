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
    const { text, eurocode, filename, marca } = JSON.parse(event.body);

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    const sql = neon(process.env.DATABASE_URL);

    // Criar tabela se não existir (com coluna marca)
    await sql`
      CREATE TABLE IF NOT EXISTS ocr_results (
        id SERIAL PRIMARY KEY,
        text TEXT,
        eurocode VARCHAR(50),
        filename VARCHAR(255),
        marca VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Adicionar coluna marca se não existir (para compatibilidade retroativa)
    try {
      await sql`ALTER TABLE ocr_results ADD COLUMN IF NOT EXISTS marca VARCHAR(100)`;
    } catch (error) {
      // Coluna já existe, ignorar erro
    }

    // Inserir novo registo
    const result = await sql`
      INSERT INTO ocr_results (text, eurocode, filename, marca)
      VALUES (${text || ''}, ${eurocode || ''}, ${filename || ''}, ${marca || ''})
      RETURNING id, text, eurocode, filename, marca, timestamp
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result[0]
      })
    };

  } catch (error) {
    console.error('Save OCR Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save OCR result',
        details: error.message
      })
    };
  }
};

