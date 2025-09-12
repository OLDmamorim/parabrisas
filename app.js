function renderTable() {
  if (!resultsBody) return;

  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToShow.length === 0) {
    const searchField = document.getElementById('searchField');
    const isSearching = searchField && searchField.value.trim();
    const message = isSearching
      ? 'Nenhum registo encontrado para esta procura'
      : 'Nenhum registo encontrado';
    resultsBody.innerHTML =
      `<tr><td colspan="6" style="text-align:center; padding:20px;">${message}</td></tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, index) => {
    const originalIndex = RESULTS.findIndex(r => r.id === row.id);

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${row.timestamp}</td>
        <td>${row.vehicle || '—'}</td>
        <td style="font-weight: bold; color: #007acc;">${row.eurocode}</td>
        <td>${row.brand || '—'}</td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button onclick="openEditOcrModal(RESULTS[${originalIndex}])"
                    style="padding: 4px 8px; background: none; color: #666; border: none; cursor: pointer; border-radius: 3px;"
                    title="Editar texto OCR"
                    onmouseover="this.style.background='rgba(0,0,0,0.05)'; this.style.color='#333'" 
                    onmouseout="this.style.background='none'; this.style.color='#666'">
              ✏️ Editar
            </button>
            <button onclick="deleteRow(${row.id})"
                    style="padding: 4px 8px; background: none; color: #dc3545; border: none; cursor: pointer; border-radius: 3px;"
                    title="Eliminar registo"
                    onmouseover="this.style.background='rgba(220,53,69,0.1)'" 
                    onmouseout="this.style.background='none'">
              🗑️ Apagar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}