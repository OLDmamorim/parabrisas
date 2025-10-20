// /.netlify/functions/get-vehicle-from-eurocode.mjs
// Função para obter informação do veículo a partir do eurocode
// Substitui a função getVehicleFromEurocode() do ficheiro eurocode-mapping.mjs

import { jsonHeaders, sql } from './db.mjs';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return cors(405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    let eurocode;

    // Suportar GET e POST
    if (event.httpMethod === 'GET') {
      eurocode = event.queryStringParameters?.eurocode;
    } else {
      const payload = JSON.parse(event.body || '{}');
      eurocode = payload.eurocode;
    }

    if (!eurocode) {
      return cors(400, { ok: false, error: 'Eurocode é obrigatório' });
    }

    console.log('🔍 A procurar veículo para eurocode:', eurocode);

    // Extrair prefixo (4 primeiros dígitos, removendo # e *)
    const prefix = eurocode.replace(/[#*]/g, '').substring(0, 4);

    // Validar prefixo (deve ter 4 dígitos)
    if (!/^\d{4}$/.test(prefix)) {
      return cors(400, { ok: false, error: 'Eurocode inválido (prefixo deve ter 4 dígitos)' });
    }

    // Procurar na base de dados
    const result = await sql`
      SELECT marca, modelo FROM eurocodes WHERE prefix = ${prefix}
    `;

    if (result.length === 0) {
      console.log('❌ Eurocode não encontrado:', prefix);
      return cors(200, { 
        ok: true, 
        vehicle: null,
        prefix: prefix,
        found: false
      });
    }

    const { marca, modelo } = result[0];
    
    // Construir string do veículo
    let vehicle;
    if (marca && modelo) {
      vehicle = `${marca} ${modelo}`;
    } else if (marca) {
      vehicle = marca;
    } else {
      vehicle = null;
    }

    console.log('✅ Veículo encontrado:', vehicle);

    return cors(200, { 
      ok: true, 
      vehicle: vehicle,
      marca: marca,
      modelo: modelo,
      prefix: prefix,
      found: true
    });

  } catch (e) {
    console.error('❌ Erro ao procurar eurocode:', e);
    return cors(500, { 
      ok: false, 
      error: String(e?.message || e)
    });
  }
};

