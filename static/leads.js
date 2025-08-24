// A chamada inicial é feita pelo auth.js
document.addEventListener('DOMContentLoaded', function() {
    // Apenas prepara a página, o carregamento é acionado pelo auth.js
});

async function loadLeads() {
    const apiUrl = '/api/leads';
    const tableBody = document.getElementById('leads-table-body');
    const token = await window.getAuthToken();

    if (!token) return;

    fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(response => {
            if (response.status === 401) { window.location.href = '/'; return; }
            return response.json();
        })
        .then(data => {
            tableBody.innerHTML = '';
            if (!data || data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum lead capturado ainda.</td></tr>';
                return;
            }
            data.forEach(lead => {
                const tr = document.createElement('tr');
                const date = lead.timestamp ? new Date(lead.timestamp._seconds * 1000) : new Date();
                tr.innerHTML = `
                    <td>${date.toLocaleString('pt-BR')}</td>
                    <td>${lead.name}</td>
                    <td>${lead.email}</td>
                    <td>${lead.phone || '---'}</td>
                    <td>${lead.city || '---'}</td>
                    <td>${lead.sourceQrId}</td>
                `;
                tableBody.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Erro ao buscar leads:', error);
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cor-erro);">Erro ao carregar os dados.</td></tr>';
        });
}
