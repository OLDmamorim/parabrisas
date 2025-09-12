// ====== VEHICLE (car brand) DETECTION — versão única ======

// Normalizador SÓ para veículo (não troca I→1 nem O→0)
function normVehText(s){
  return String(s || "")
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

const VEHICLE_PATTERNS = [
  { canon: "BMW",           rx: /\bBMW\b/ },
  { canon: "Mercedes-Benz", rx: /\bMERCEDES(?:[-\s]?BENZ)?\b|\bMERCEDES\b/ },
  { canon: "Audi",          rx: /\bAUDI\b/ },
  { canon: "Volkswagen",    rx: /\bVOLKSWAGEN\b|\bVW\b/ },
  { canon: "Seat",          rx: /\bSEAT\b/ },
  { canon: "Škoda",         rx: /\bSKODA\b/ },
  { canon: "Opel",          rx: /\bOPEL\b|\bVAUXHALL\b/ },
  { canon: "Peugeot",       rx: /\bPEUGEOT\b/ },
  { canon: "Citroën",       rx: /\bCITRO[ËE]N\b|\bCITROEN\b/ },
  { canon: "Renault",       rx: /\bRENAULT\b/ },
  { canon: "Dacia",         rx: /\bDACIA\b/ },
  { canon: "Fiat",          rx: /\bFIAT\b/ },
  { canon: "Alfa Romeo",    rx: /\bALFA\s*ROMEO\b/ },
  { canon: "Lancia",        rx: /\bLANCIA\b/ },
  { canon: "Ford",          rx: /\bFORD\b/ },
  { canon: "Toyota",        rx: /\bTOYOTA\b/ },
  { canon: "Honda",         rx: /\bHONDA\b/ },
  { canon: "Nissan",        rx: /\bNISSAN\b/ },
  { canon: "Mazda",         rx: /\bMAZDA\b/ },
  { canon: "Mitsubishi",    rx: /\bMITSUBISHI\b/ },
  { canon: "Subaru",        rx: /\bSUBARU\b/ },
  { canon: "Suzuki",        rx: /\bSUZUKI\b/ },
  { canon: "Hyundai",       rx: /\bHYUNDAI\b/ },
  { canon: "Kia",           rx: /\bKIA\b/ },
  { canon: "Volvo",         rx: /\bVOLVO\b/ },
  { canon: "Saab",          rx: /\bSAAB\b/ },
  { canon: "Jaguar",        rx: /\bJAGUAR\b/ },
  { canon: "Land Rover",    rx: /\bLAND\s*ROVER\b/ },
  { canon: "Range Rover",   rx: /\bRANGE\s*ROVER\b/ },
  { canon: "Mini",          rx: /\bMINI\b/ },
  { canon: "Porsche",       rx: /\bPORSCHE\b/ },
  { canon: "Smart",         rx: /\bSMART\b/ },
  { canon: "Tesla",         rx: /\bTESLA\b/ }
];

// (mantém a antiga para compatibilidade se precisares noutro lado)
function detectVehicleFromText(rawText) {
  const text = normVehText(rawText); // ← usar normalizador de veículo
  for (const { canon, rx } of VEHICLE_PATTERNS) {
    if (rx.test(text)) return canon;
  }
  const tokens = Array.from(new Set(text.split(' '))).filter(w => w.length >= 3 && w.length <= 12);
  const TARGETS = ["BMW","MERCEDES","MERCEDESBENZ","AUDI","VOLKSWAGEN","VW","SEAT","SKODA","OPEL","VAUXHALL","PEUGEOT","CITROEN","RENAULT","DACIA","FIAT","ALFAROMEO","LANCIA","FORD","TOYOTA","HONDA","NISSAN","MAZDA","MITSUBISHI","SUBARU","SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR","LANDROVER","RANGEROOVER","MINI","PORSCHE","SMART","TESLA"];
  let best = { canon: null, dist: 2 };
  for (const w of tokens) {
    for (const t of TARGETS) {
      const d = editDistance(w, t);
      if (d < best.dist) best = { canon: guessVehicleFromToken(t), dist: d };
    }
  }
  return best.canon;
}

function guessVehicleFromToken(t) {
  t = String(t).toUpperCase();
  if (t.includes("MERCEDES")) return "Mercedes-Benz";
  if (t === "VW" || t.includes("VOLKSWAGEN")) return "Volkswagen";
  if (t.includes("SKODA")) return "Škoda";
  if (t.includes("VAUXHALL") || t.includes("OPEL")) return "Opel";
  if (t.includes("PEUGEOT")) return "Peugeot";
  if (t.includes("CITROEN")) return "Citroën";
  if (t.includes("RENAULT")) return "Renault";
  if (t.includes("DACIA")) return "Dacia";
  if (t.includes("ALFAROMEO")) return "Alfa Romeo";
  if (t.includes("LANDROVER")) return "Land Rover";
  if (t.includes("RANGEROOVER") || t.includes("RANGERO")) return "Range Rover";
  const simple = ["BMW","AUDI","SEAT","FIAT","LANCIA","FORD","TOYOTA","HONDA","NISSAN","MAZDA","MITSUBISHI","SUBARU","SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR","MINI","PORSCHE","SMART","TESLA"];
  if (simple.includes(t)) return t[0] + t.slice(1).toLowerCase();
  return null;
}

// ====== NOVO: Marca + Modelo (captura a palavra seguinte válida)
function detectVehicleAndModelFromText(rawText) {
  const text = normVehText(rawText);           // ← usar normalizador de veículo
  const tokens = text.split(/\s+/);

  // 1) encontra a marca
  let brand = null, brandIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    for (const { canon, rx } of VEHICLE_PATTERNS) {
      if (rx.test(tokens[i])) { brand = canon; brandIdx = i; break; }
    }
    if (brand) break;
  }
  if (!brand) return { full: '' };

  // 2) tenta apanhar o modelo nas 3 palavras seguintes (filtra ruído)
  const BAD = new Set([
    'LOT','MATERIAL','NO','NR','HU','GLASS','NORDGLASS','SEKURIT','PILKINGTON','AGC','ASAHI','XYG','FYG',
    'GESTGLASS','CAR','BRACKET','OCL','TE','VE' // “OCL.TE.VE”
  ]);
  const isModel = (s) => !!s && /^[A-Z0-9\-]+$/.test(s) && !BAD.has(s) && s.length <= 12;

  let model = '';
  for (let j = brandIdx + 1; j < Math.min(brandIdx + 4, tokens.length); j++) {
    const tok = tokens[j].replace(/[^\w\-]/g, '');
    if (isModel(tok)) { model = tok; break; }
  }

  return { full: brand + (model ? ' ' + model : '') };
}