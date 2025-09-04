// ===== EUROCODE DETECTION v13 =====

// Função para limpar e validar eurocodes
function extractEurocodes(text) {
  if (!text) return [];

  // 1) Normalizar o texto: remover símbolos que não interessam
  const cleaned = text.replace(/[^A-Z0-9\s]/gi, " ");

  // 2) Procurar potenciais eurocodes
  const regex = /\b(\d{4}[A-Z]{2}[A-Z0-9]{0,6})\b/g;
  const matches = [];
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

// Exemplo de uso (para testes locais)
const exemplos = [
  "5427ACL1C",
  "7249ACCMV1M",
  "5350AGS",
  "7289BGNM",
  "7249ACCM.V1M",
  "3999AGNV-P8L"
];

exemplos.forEach(txt => {
  console.log(txt, "->", extractEurocodes(txt));
});

// ===== Integração no teu fluxo =====
// No ponto onde recebes o texto do OCR:
//   const eurocodes = extractEurocodes(textoOCR);
//   guarda apenas eurocodes[0] (primeiro válido encontrado)