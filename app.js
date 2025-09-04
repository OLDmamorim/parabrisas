<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>EXPRESSGLASS · Receção material</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    :root{
      --bg1:#1e55e6; --bg2:#0b3fb2;
      --card:#0b1320; --muted:#cfe0ff; --line:#263251;
      --chip:#1a2640; --chip-b:#2b3b62;
    }
    *{box-sizing:border-box}
    body{margin:0;background:linear-gradient(180deg,var(--bg1) 0%,var(--bg2) 80%);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#eaf2ff}
    .wrap{max-width:960px;margin:0 auto;padding:16px}
    header{display:flex;align-items:center;justify-content:space-between}
    header h1{font-size:40px;letter-spacing:3px;margin:16px 0 0}
    .badge{background:rgba(255,255,255,.2);padding:8px 14px;border-radius:999px;font-weight:700}

    .card{background:var(--card);border-radius:24px;padding:20px;margin-top:18px;box-shadow:0 14px 40px rgba(0,0,0,.25)}
    .card-inner{max-width:760px;margin:0 auto}
    .row-between{display:flex;align-items:center;justify-content:space-between;gap:12px}

    .cam-box{display:flex;justify-content:center;align-items:center;margin:6px auto 10px}
    #btnCamera{
      width:200px;height:140px;border:2px dashed #5e7bb8;border-radius:20px;
      background:rgba(255,255,255,.03);cursor:pointer;display:flex;align-items:center;justify-content:center
    }
    #btnCamera svg{width:40px;height:40px;stroke:#9fc0ff;opacity:.9}

    .pill{border-radius:14px;background:var(--chip);color:var(--muted);padding:10px 16px;cursor:pointer;border:1px solid var(--chip-b)}
    .danger{background:#4d2020;border-color:#6a2a2a}

    /* texto de instruções pequeno */
    .hint{opacity:.9;text-align:center;margin:0 6px 14px;font-size:.95rem}

    .status{min-height:24px;margin:8px 0}

    /* histórico mobile */
    #mobileHistoryList .history-item{background:#121b2f;border:1px solid var(--line);border-radius:14px;padding:8px 12px;margin-bottom:10px}
    .history-item-time{opacity:.75;font-size:.8rem;margin-bottom:2px}
    .history-item-text{font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    #desktopView{display:none}
    @media(min-width:900px){#mobileView{display:none}#desktopView{display:block}}
    table{width:100%;border-collapse:collapse}
    thead th{background:#0e1a33;color:#bcd3ff;padding:10px;text-align:left}
    tbody td{border-top:1px solid #213055;padding:10px;vertical-align:top}
    .ocr-text{white-space:normal;overflow-wrap:anywhere;line-height:1.4}
    .btn{background:var(--chip);border:1px solid var(--chip-b);color:var(--muted);padding:8px 12px;border-radius:10px;cursor:pointer}
    .btn-icon{cursor:pointer;border:none;background:none;font-size:16px}

    #toast{position:fixed;left:50%;transform:translateX(-50%);bottom:24px;background:#111a2e;border:1px solid var(--chip-b);color:#dfeaff;padding:10px 14px;border-radius:10px;opacity:0;transition:opacity .2s}
    #toast.show{opacity:1}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>EXPRESSGLASS</h1>
      <span class="badge" id="viewBadge">Mobile</span>
    </header>

    <!-- MOBILE -->
    <section id="mobileView" class="card">
      <div class="card-inner">
        <div class="row-between" style="margin-bottom:8px;">
          <span style="opacity:.85">Receção material</span>
          <button class="pill" id="helpBtn">Instruções</button>
        </div>

        <div class="cam-box">
          <button id="btnCamera" title="Tirar foto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M3 7h4l2-3h6l2 3h4v13H3z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <input id="cameraInput" type="file" accept="image/*" capture="environment" style="display:none" />
        </div>

        <!-- só instruções, sem título grande -->
        <p class="hint">Tira uma foto à <b>etiqueta</b> do material. Inclui a <b>descrição</b> e o <b>código</b> se possível.</p>

        <div id="mobileStatus" class="status"></div>

        <div class="row-between">
          <div class="section-title">📋 Últimas Capturas</div>
          <button id="historyClearBtn" class="pill danger">Limpar</button>
        </div>
        <div id="mobileHistoryList"></div>
      </div>
    </section>

    <!-- DESKTOP -->
    <section id="desktopView" class="card">
      <div class="card-inner">
        <div class="row-between" style="margin-bottom:10px;">
          <div class="section-title" style="margin:0">Express OCR</div>
          <div style="display:flex;gap:8px">
            <button class="btn" id="btnUpload">Carregar imagem</button>
            <input id="fileInput" type="file" accept="image/*" style="display:none" />
            <button class="btn" id="btnExport">Exportar CSV</button>
            <button class="btn" id="btnClear">Limpar Tabela</button>
            <button class="pill" id="helpBtnDesktop">Instruções</button>
          </div>
        </div>

        <div id="desktopStatus" class="status"></div>
        <table id="resultsTable">
          <thead></thead>
          <tbody id="resultsBody"></tbody>
        </table>
      </div>
    </section>
  </div>

  <div id="toast" role="status" aria-live="polite"></div>
  <script src="app.js"></script>
</body>
</html>