// APP.JS (BD + Validação de Eurocode + CSS Forçado para Texto Pequeno)
// =========================
// VERSÃO: 19/09/2025  - Persistência Loja/Observações + AuthorizedFetch
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// ===== Auth token helper =====
const TOKEN_KEY = 'eg_auth_token';

function getSavedToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch(_){ return ''; }
}

function saveToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token || ''); } catch(_){}
}

async function promptForToken(message='Cola aqui o token de autenticação') {
  const t = window.prompt(message, getSavedToken() || '');
  if (t && t.trim()) { saveToken(t.trim()); return t.trim(); }
  return null;
}

async function authorizedFetch(url, options={}) {
  const opts = Object.assign({ headers: {} }, options);
  opts.headers = Object.assign({}, opts.headers);
  let token = getSavedToken();
  if (token) {
    opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    opts.headers['x-api-key'] = token;
  }
  let res = await fetch(url, opts);
  if (res.status === 401 || res.status === 403) {
    token = await promptForToken('Token necessário. Cola aqui o token (ex.: Bearer xxxxx ou só o token)');
    if (token) {
      opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      opts.headers['x-api-key'] = token;
      res = await fetch(url, opts);
    }
  }
  return res;
}

// ---- Seletores ----
const fileInput  = document.getElementById('fileInput');
const btnUpload  = document.getElementById('btnUpload');
const btnExport  = document.getElementById('btnExport');
const btnClear   = document.getElementById('btnClear');
const resultsBody= document.getElementById('resultsBody');

const cameraInput  = document.getElementById('cameraInput');
const btnCamera    = document.getElementById('btnCamera');
const mobileStatus = document.getElementById('mobileStatus');
const mobileHistoryList = document.getElementById('mobileHistoryList');

const desktopStatus = document.getElementById('desktopStatus');
const toast = document.getElementById('toast');

// ---- Modal de edição OCR ----
const editOcrModal = document.getElementById('editOcrModal');
const editOcrTextarea = document.getElementById('editOcrTextarea');
const editOcrClose = document.getElementById('editOcrClose');
const editOcrCancel = document.getElementById('editOcrCancel');
const editOcrSave = document.getElementById('editOcrSave');

// ---- Estado ----
let RESULTS = [];
let FILTERED_RESULTS = [];
let currentEditingRow = null;

// =========================
// CSS forçado
function addCustomCSS() {
  const style = document.createElement('style');
  style.textContent = `
    #resultsBody td, #resultsBody td * { font-size: 12px !important; }
    #resultsBody button { font-size: 11px !important; }
    .table th { font-size: 12px !important; }
    .ocr-text, .ocr-text * { font-size: 12px !important; }
  `;
  document.head.appendChild(style);
}

// =========================
// Utils UI
function showToast(msg, type='') {
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2200);
}
function setStatus(el, text, mode='') {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error','success');
  if (mode==='error') el.classList.add('error');
  if (mode==='success') el.classList.add('success');
}

// =========================
// Normalização (corrigido)
function normalizeRow(r){
  let timestamp = r.timestamp || r.created_at || r.updated_at || r.ts || '';
  if (!timestamp) timestamp = new Date().toLocaleString('pt-PT');
  if (typeof timestamp === 'number') timestamp = new Date(timestamp).toLocaleString('pt-PT');
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    try { timestamp = new Date(timestamp).toLocaleString('pt-PT'); } catch {}
  }
  const text = r.text ?? '';
  let brand = r.brand ?? '';
  if (!brand && text) brand = detectBrandFromText(text) || '';
  return {
    id:        r.id ?? nul
