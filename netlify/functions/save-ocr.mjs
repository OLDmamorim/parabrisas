// /.netlify/functions/save-ocr.mjs
import { neon } from '@neondatabase/serverless';

const CONN = process.env.NEON_DATABASE_URL;
if (!CONN) throw new Error('NEON_DATABASE_URL não definido');
const sql = neon(CONN);

const jsonHeaders = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };

let inited = false;
async function init() {
  if (inited) return;
  await sql`
    create table if not exists ocr_results (
      id bigserial primary key,
      ts timestamptz not null default now(),
      text text,
      filename text,
      source text,
      ip text,
      euro_validado text
    )
  `;
  await sql`alter table ocr_results add column if not exists brand text`; // marca do vidro
  await sql`alter table ocr_results add column if not exists marca text`; // marca do veículo
  inited = true;
}

/* ---------- DETEÇÃO DE MARCA DO VIDRO (brand) ---------- */
function normBrandText(s){
  return String(s||'')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .replace(/O/g,'0')
    .replace(/I/g,'1')
    .trim();
}
const BRAND_PATTERNS = [
  { canon:'AGC',                  rx:/\bA[GC]C\b|\bAG0\b|\bASAHI\b/ },
  { canon:'Pilkington',           rx:/\bPILK[1I]NGT[0O]N\b|\bPILKINGTON\b/ },
  { canon:'Saint-Gobain Sekurit', rx:/\bSEKURIT\b|\bSAINT\s*G[0O]BA[1I]N\b/ },
  { canon:'Guardian',             rx:/\bGUARD[1I]AN\b/ },
  { canon:'Fuyao (FYG/FUYAO)',    rx:/\bFUYAO\b|\bFYG\b/ },
  { canon:'XYG',                  rx:/\bXYG\b/ },
  { canon:'NordGlass',            rx:/\bN[0O]RDGLASS\b|\bNORDGLASS\b/ },
  { canon:'Splintex',             rx:/\bSPL[1I]NTEX\b|\bSPLINTEX\b/ },
  { canon:'Sicursiv',             rx:/\bSICURSIV\b/ },
  { canon:'Carlite',              rx:/\bCARL[1I]TE\b/ },
  { canon:'PPG',                  rx:/\bPPG\b/ },
  { canon:'Mopar',                rx:/\bMOPAR\b/ },
  { canon:'Shatterprufe',         rx:/\bSHATTERPRUFE\b/ },
  { canon:'Protec',               rx:/\bPROTEC\b/ },
  { canon:'Lamilex',              rx:/\bLAMI[1I]LEX\b/ },
  { canon:'Vitro',                rx:/\bVITR[0O]\b|\bVITRO\b/ },
  { canon:'Toyota (OEM)',         rx:/\bTOYOTA\b|\bTOY0TA\b/ },
  { canon:'Ford (Carlite)',       rx:/\bFORD\b/ },
  { canon:'GM',                   rx:/\bGENERAL\s*MOTORS\b|\bGM\b/ },
  { canon:'VW (OEM)',             rx:/\bVOLKSWAGEN\b|\bVW\b/ },
  { canon:'Hyundai (OEM)',        rx:/\bHYUNDAI\b/ },
  { canon:'Kia (OEM)',            rx:/\bKIA\b/ },
];
function editDistance(a,b){
  a=String(a); b=String(b);
  const dp=Array(a.length+1).fill().map(()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) dp[i][0]=i;
  for(let j=0;j<=b.length;j++) dp[0][j]=j;
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      const c=a[i-1]===b[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+c);
    }
  }
  return dp[a.length][b.length];
}
function guessCanonFromToken(t){
  t=String(t).toUpperCase();
  if (t.includes('PILK')) return 'Pilkington';
  if (t.includes('SEKURIT')||t.includes('SAINT')) return 'Saint-Gobain Sekurit';
  if (t.includes('AGC')||t.includes('ASAHI')) return 'AGC';
  if (t.includes('FUYAO')||t.includes('FYG')) return 'Fuyao (FYG/FUYAO)';
  if (t.includes('GUARD')) return 'Guardian';
  if (t.includes('NORD')) return 'NordGlass';
  if (t.includes('SPLINTEX')) return 'Splintex';
  if (t.includes('XYG')) return 'XYG';
  if (t.includes('SICURSIV')) return 'Sicursiv';
  if (t.includes('CARLITE')) return 'Carlite';
  if (t.includes('MOPAR')) return 'Mopar';
  if (t.includes('VITRO')) return 'Vitro';
  if (t==='VW'||t.includes('VOLKSWAGEN')) return 'VW (OEM)';
  if (t==='GM'||t.includes('GENERAL')||t.includes('MOTORS')) return 'GM';
  if (t.includes('TOYOTA')) return 'Toyota (OEM)';
  if (t.includes('HYUNDAI')) return 'Hyundai (OEM)';
  if (t.includes('KIA')) return 'Kia (OEM)';
  if (t.includes('FORD')) return 'Ford (Carlite)';
  return null;
}
function detectBrandFromText(rawText){
  const text = normBrandText(rawText);
  for (const {canon,rx} of BRAND_PATTERNS) if (rx.test(text)) return canon;
  const candidates = Array.from(new Set(text.split(' '))).filter(w=>w.length>=4&&w.length<=12);
  const targets = ['PILKINGTON','SEKURIT','AGC','ASAHI','FUYAO','FYG','GUARDIAN','NORDGLASS','SPLINTEX','XYG','SICURSIV','CARLITE','MOPAR','VITRO','PPG','PROTEC','LAMILEX','VOLKSWAGEN','TOYOTA','HYUNDAI','KIA','FORD','GENERAL','MOTORS','VW','GM'];
  let best={canon:null,dist:3};
  for (const w of candidates){
    for (const t of targets){
      const d=editDistance(w,t);
      if (d<best.dist) best={canon:guessCanonFromToken(t), dist:d};
    }
  }
  return best.canon;
}

/* ---------- DETEÇÃO DE MARCA DO VEÍCULO ---------- */
function normVehText(s){
  return String(s||'')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
const VEH_PATTERNS = [
  // Europe
  { canon: "BMW",            rx: /\bBMW\b/ },
  { canon: "Mercedes-Benz",  rx: /\bMERCEDES\b|\bMERCEDES[-\s]*BENZ\b/ },
  { canon: "Audi",           rx: /\bAUDI\b/ },
  { canon: "Volkswagen",     rx: /\bVOLKSWAGEN\b|\bVW\b/ },
  { canon: "Škoda",          rx: /\bSKODA\b|\bŠKODA\b/ },
  { canon: "SEAT/Cupra",     rx: /\bSEAT\b|\bCUPRA\b/ },
  { canon: "Opel/Vauxhall",  rx: /\bOPEL\b|\bVAUXHALL\b/ },
  { canon: "Peugeot",        rx: /\bPEUGEOT\b/ },
  { canon: "Citroën",        rx: /\bCITROEN\b|\bCITROËN\b/ },
  { canon: "Renault",        rx: /\bRENAULT\b/ },
  { canon: "Dacia",          rx: /\bDACIA\b/ },
  { canon: "Fiat",           rx: /\bFIAT\b/ },
  { canon: "Alfa Romeo",     rx: /\bALFA\s*ROMEO\b/ },
  { canon: "Lancia",         rx: /\bLANCIA\b/ },
  { canon: "Volvo",          rx: /\bVOLVO\b/ },
  { canon: "Saab",           rx: /\bSAAB\b/ },
  { canon: "Mini",           rx: /\bMINI\b/ },
  { canon: "Smart",          rx: /\bSMART\b/ },
  { canon: "Jaguar",         rx: /\bJAGUAR\b/ },
  { canon: "Land Rover",     rx: /\bLAND\s*ROVER\b|\bRANGE\s*ROVER\b/ },
  { canon: "Porsche",        rx: /\bPORSCH[E]?\b/ },

  // Asia
  { canon: "Toyota",         rx: /\bTOYOTA\b/ },
  { canon: "Lexus",          rx: /\bLEXUS\b/ },
  { canon: "Nissan/Infiniti",rx: /\bNISSAN\b|\bINFINITI\b/ },
  { canon: "Honda/Acura",    rx: /\bHONDA\b|\bACURA\b/ },
  { canon: "Mazda",          rx: /\bMAZDA\b/ },
  { canon: "Mitsubishi",     rx: /\bMITSUBISHI\b/ },
  { canon: "Subaru",         rx: /\bSUBARU\b/ },
  { canon: "Suzuki",         rx: /\bSUZUKI\b/ },
  { canon: "Hyundai",        rx: /\bHYUNDAI\b/ },
  { canon: "Kia",            rx: /\bKIA\b/ },

  // US
  { canon: "Ford",           rx: /\bFORD\b/ },
  { canon: "Chevrolet",      rx: /\bCHEVROLET\b|\bCHEVY\b/ },
  { canon: "Chrysler",       rx: /\bCHRYSLER\b/ },
  { canon: "Dodge",          rx: /\bDODGE\b/ },
  { canon: "Jeep",           rx: /\bJEEP\b/ },
  { canon: "RAM",            rx: /\bRAM\b/ },
  { canon: "Cadillac",       rx: /\bCADILLAC\b/ },
  { canon: "GMC",            rx: /\bGMC\b/ },
  { canon: "Buick",          rx: /\bBUICK\b/ },

  // EV/China (úteis em PT)
  { canon: "Tesla",          rx: /\bTESLA\b/ },
  { canon: "BYD",            rx: /\bBYD\b/ },
  { canon: "MG",             rx: /\bMG\b/ },
];
function detectVehicleFromText(raw){
  const t = normVehText(raw);
  for (const {canon, rx} of VEH_PATTERNS){
    if (rx.test(t)) return canon;
  }
  return null;
}

/* ------------------------------------ */

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    const body = JSON.parse(event.body || '{}');
    const { ts, text='', filename='', source='', euro_validado, eurocode, brand: brandFromClient, vehicle: vehicleFromClient } = body;

    const tsDate = (() => {
      if (typeof ts === 'number') return new Date(ts < 1e12 ? ts * 1000 : ts);
      if (typeof ts === 'string' && ts) { const d=new Date(ts); if(!Number.isNaN(d.getTime())) return d; }
      return new Date();
    })();

    const ip =
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] || null;

    const euroFinal = euro_validado || eurocode || '';
    const brand   = (brandFromClient   || detectBrandFromText(text)   || null);
    const vehicle = (vehicleFromClient || detectVehicleFromText(text) || null);

    // Inserir já com brand + marca (veículo). Se falhar, tenta sem as novas colunas.
    try {
      const rows = await sql`
        insert into ocr_results (ts, text, filename, source, ip, euro_validado, brand, marca)
        values (${tsDate}, ${text}, ${filename}, ${source}, ${ip}, ${euroFinal}, ${brand}, ${vehicle})
        returning id, ts, text, filename, source, euro_validado, brand, marca
      `;
      const r = rows?.[0];
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok:true, row: { ...r, vehicle: r?.marca ?? null } })
      };
    } catch (e1) {
      console.warn('INSERT com brand/marca falhou, a tentar sem:', e1?.message || e1);
      const rows = await sql`
        insert into ocr_results (ts, text, filename, source, ip, euro_validado)
        values (${tsDate}, ${text}, ${filename}, ${source}, ${ip}, ${euroFinal})
        returning id, ts, text, filename, source, euro_validado, brand, marca
      `;
      const r = rows?.[0];
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok:true, row: { ...r, vehicle: r?.marca ?? null }, note:'saved_without_brand_vehicle' })
      };
    }
  } catch (e) {
    console.error('Erro ao guardar:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};