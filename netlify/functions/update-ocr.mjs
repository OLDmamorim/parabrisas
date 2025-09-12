// /.netlify/functions/update-ocr.js
import { neon } from '@neondatabase/serverless';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  if (event.httpMethod !== 'POST')    return cors(405, { ok: false, error: 'Method Not Allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const payload = JSON.parse(event.body || '{}');
    const { id } = payload || {};
    if (!id) return cors(400, { ok: false, error: 'Missing id' });

    // Ir buscar o registo atual
    const current = (await sql`SELECT * FROM ocr_results WHERE id = ${id} LIMIT 1;`)?.[0];
    if (!current) return cors(404, { ok: false, error: 'Not found' });

    // Preparar novos valores (mantém o que não vier)
    const newText     = payload.text ?? current.text;
    const newEurocode = payload.eurocode ?? current.euro_validado;
    const newFilename = payload.filename ?? current.filename;
    const newSource   = payload.source ?? current.source;

    // Brand: se o cliente enviou, usa; senão, se o texto mudou, recalcula; senão mantém
    let newBrand = payload.brand;
    if (newBrand === undefined) {
      newBrand = newText !== current.text ? detectBrandFromText(newText) : current.brand;
    }

    const rows = await sql`
      UPDATE ocr_results
      SET text = ${newText},
          euro_validado = ${newEurocode},
          filename = ${newFilename},
          source = ${newSource},
          brand = ${newBrand}
      WHERE id = ${id}
      RETURNING id, ts, text, euro_validado, brand, filename, source;
    `;

    const r = rows?.[0] || null;
    return cors(200, {
      ok: true,
      item: r && {
        id: r.id,
        created_at: r.ts,
        text: r.text,
        eurocode: r.euro_validado,
        brand: r.brand,
        filename: r.filename,
        source: r.source,
      },
    });
  } catch (err) {
    return cors(500, { ok: false, error: String(err?.message || err) });
  }
};

/* ---------- Brand detection (mesma função do save) ---------- */
function normBrandText(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .trim();
}

const BRAND_PATTERNS = [
  { canon: 'AGC', rx: /\bA[GC]C\b|\bAG0\b|\bASAHI\b/ },
  { canon: 'Pilkington', rx: /\bPILK[1I]NGT[0O]N\b|\bPILKINGTON\b/ },
  { canon: 'Saint-Gobain Sekurit', rx: /\bSEKURIT\b|\bSAINT\s*G[0O]BA[1I]N\b/ },
  { canon: 'Guardian', rx: /\bGUARD[1I]AN\b/ },
  { canon: 'Fuyao (FYG/FUYAO)', rx: /\bFUYAO\b|\bFYG\b/ },
  { canon: 'XYG', rx: /\bXYG\b/ },
  { canon: 'NordGlass', rx: /\bN[0O]RDGLASS\b|\bNORDGLASS\b/ },
  { canon: 'Splintex', rx: /\bSPL[1I]NTEX\b|\bSPLINTEX\b/ },
  { canon: 'Sicursiv', rx: /\bSICURSIV\b/ },
  { canon: 'Carlite', rx: /\bCARL[1I]TE\b/ },
  { canon: 'PPG', rx: /\bPPG\b/ },
  { canon: 'Mopar', rx: /\bMOPAR\b/ },
  { canon: 'Shatterprufe', rx: /\bSHATTERPRUFE\b/ },
  { canon: 'Protec', rx: /\bPROTEC\b/ },
  { canon: 'Lamilex', rx: /\bLAMI[1I]LEX\b/ },
  { canon: 'Vitro', rx: /\bVITR[0O]\b|\bVITRO\b/ },
  { canon: 'Toyota (OEM)', rx: /\bTOYOTA\b|\bTOY0TA\b/ },
  { canon: 'Ford (Carlite)', rx: /\bFORD\b/ },
  { canon: 'GM', rx: /\bGENERAL\s*MOTORS\b|\bGM\b/ },
  { canon: 'VW (OEM)', rx: /\bVOLKSWAGEN\b|\bVW\b/ },
  { canon: 'Hyundai (OEM)', rx: /\bHYUNDAI\b/ },
  { canon: 'Kia (OEM)', rx: /\bKIA\b/ },
];

function detectBrandFromText(rawText) {
  const text = normBrandText(rawText);
  for (const { canon, rx } of BRAND_PATTERNS) {
    if (rx.test(text)) return canon;
  }
  const candidates = Array.from(new Set(text.split(' '))).filter((w) => w.length >= 4 && w.length <= 12);
  const targets = [
    'PILKINGTON','SEKURIT','AGC','ASAHI','FUYAO','FYG','GUARDIAN','NORDGLASS','SPLINTEX','XYG','SICURSIV','CARLITE',
    'MOPAR','VITRO','PPG','PROTEC','LAMILEX','VOLKSWAGEN','TOYOTA','HYUNDAI','KIA','FORD','GENERAL','MOTORS','VW','GM'
  ];
  let best = { canon: null, dist: 3 };
  for (const w of candidates) {
    for (const t of targets) {
      const d = editDistance(w, t);
      if (d < best.dist) best = { canon: guessCanonFromToken(t), dist: d };
    }
  }
  return best.canon;
}

function editDistance(a, b) {
  a = String(a); b = String(b);
  const dp = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}
function guessCanonFromToken(t) {
  t = String(t).toUpperCase();
  if (t.includes('PILK')) return 'Pilkington';
  if (t.includes('SEKURIT') || t.includes('SAINT')) return 'Saint-Gobain Sekurit';
  if (t.includes('AGC') || t.includes('ASAHI')) return 'AGC';
  if (t.includes('FUYAO') || t.includes('FYG')) return 'Fuyao (FYG/FUYAO)';
  if (t.includes('GUARD')) return 'Guardian';
  if (t.includes('NORD')) return 'NordGlass';
  if (t.includes('SPLINTEX')) return 'Splintex';
  if (t.includes('XYG')) return 'XYG';
  if (t.includes('SICURSIV')) return 'Sicursiv';
  if (t.includes('CARLITE')) return 'Carlite';
  if (t.includes('MOPAR')) return 'Mopar';
  if (t.includes('VITRO')) return 'Vitro';
  if (t === 'VW' || t.includes('VOLKSWAGEN')) return 'VW (OEM)';
  if (t === 'GM' || t.includes('GENERAL') || t.includes('MOTORS')) return 'GM';
  if (t.includes('TOYOTA')) return 'Toyota (OEM)';
  if (t.includes('HYUNDAI')) return 'Hyundai (OEM)';
  if (t.includes('KIA')) return 'Kia (OEM)';
  if (t.includes('FORD')) return 'Ford (Carlite)';
  return null;
}