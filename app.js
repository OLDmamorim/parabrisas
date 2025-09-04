/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const DEMO_MODE    = false;

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";

const cameraBtn     = document.getElementById("btnCamera");
const cameraInput   = document.getElementById("cameraInput");
const mobileStatus  = document.getElementById("mobileStatus");
const uploadBtn     = document.getElementById("btnUpload");
const fileInput     = document.getElementById("fileInput");
const exportBtn     = document.getElementById("btnExport");
const clearBtn      = document.getElementById("btnClear");
const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");
const toast         = document.getElementById("toast");

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== Helpers ===== */
function showToast(msg,type='info'){toast.textContent=msg;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2200);}
const statusEl = () => (isDesktop ? desktopStatus : mobileStatus);
function setStatus(html){ statusEl().innerHTML = html || ""; }

/* ===== HISTÓRICO (mobile) ===== */
let captureHistory = [];
function saveHistory(){ try{ localStorage.setItem('expressglass_history', JSON.stringify(captureHistory)); }catch{} }
function loadHistory(){ try{ const s=localStorage.getItem('expressglass_history'); if(s) captureHistory=JSON.parse(s);}catch{} }
loadHistory();

const mobileHistoryList = document.getElementById("mobileHistoryList");

function truncate50(s){
  if(!s) return "";
  const oneLine = String(s).replace(/\s+/g,' ').trim();
  return oneLine.length > 50 ? oneLine.slice(0,50) + "…" : oneLine;
}
function renderHistory(){
  if(!mobileHistoryList) return;
  if(!captureHistory.length){
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há capturas realizadas.</p>';
    return;
  }
  const items = captureHistory.slice(0,5).map(item => `
    <div class="history-item">
      <span class="history-time">${new Date(item.timestamp || item.ts).toLocaleString()}</span>
      <div class="history-text">${truncate50(item.text || '')}</div>
    </div>
  `).join('');
  mobileHistoryList.innerHTML = items;
}
function addCaptureToHistory(row){
  captureHistory.unshift({id: row.id,timestamp: row.ts,filename: row.filename,text: row.text || ''});
  if(captureHistory.length > 20) captureHistory = captureHistory.slice(0,20);
  saveHistory();
  renderHistory();
}
document.addEventListener('DOMContentLoaded', renderHistory);
if (document.readyState !== 'loading') renderHistory();

/* resto do fluxo OCR e desktop (igual ao anterior) */