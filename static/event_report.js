// A chamada inicial para loadTicketReport() é feita pelo auth.js
document.addEventListener('DOMContentLoaded', function() {
    // Apenas prepara a página, o carregamento é acionado pelo auth.js
});

async function loadTicketReport(eventId) {
    if (!eventId) {
        document.getElementById('report-title').textContent = 'Erro: ID do Evento não encontrado.';
        return;
    }

    const exportBtn = document.getElementById('export-csv-btn');
    if(exportBtn) {
        exportBtn.addEventListener('click', () => {
            window.location.href = `/api/events/${eventId}/tickets/export`;
        });
    }

    await loadEventDetails(eventId);
    
    const apiUrl = `/api/events/${eventId}/tickets`;
    const tableBody = document.getElementById('report-table-body');
    const totalTicketsSpan = document.getElementById('total-tickets');
    const totalRevenueSpan = document.getElementById('total-revenue');
    const token = await window.getAuthToken();

    try {
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao carregar relatório.');
        const data = await response.json();

        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum bilhete vendido para este evento.</td></tr>';
            totalTicketsSpan.textContent = '0';
            totalRevenueSpan.textContent = '0.00';
            return;
        }

        let totalRevenue = 0;
        data.forEach(ticket => {
            const tr = document.createElement('tr');
            const purchaseDate = ticket.purchaseDate && ticket.purchaseDate._seconds ? new Date(ticket.purchaseDate._seconds * 1000) : new Date();
            
            let statusClass = 'status-inactive';
            let statusText = 'Check-in';
            if (ticket.status === 'VALIDO') {
                statusClass = 'status-active';
                statusText = 'Válido';
            } else if (ticket.status === 'EXCLUIDO' || ticket.isDeleted) {
                statusClass = 'status-deleted';
                statusText = 'Excluído';
            }
            
            const pdfUrl = `/api/event/ticket/${ticket.ticketId}/pdf`;
            let actionsHtml = `<a href="${pdfUrl}" class="action-icon" title="Reemitir PDF" target="_blank"><i class="fas fa-file-pdf"></i></a>`;
            
            if (window.userClaims && window.userClaims.role === 'admin') {
                actionsHtml += `<a href="#" class="action-icon action-icon-delete" title="Excluir Bilhete" onclick="event.preventDefault(); deleteTicket('${ticket.ticketId}', '${eventId}')"><i class="fas fa-trash-alt"></i></a>`;
            }

            tr.innerHTML = `
                <td>${purchaseDate.toLocaleString('pt-BR')}</td>
                <td>${ticket.buyerName}</td>
                <td>${ticket.ticketType}</td>
                <td>${ticket.paymentMethod || '---'}</td>
                <td>${ticket.soldBy || '---'}</td>
                <td><span class="ticket-type-tag ${statusClass}">${statusText}</span></td>
                <td style="text-align: center;">${actionsHtml}</td>
            `;
            tableBody.appendChild(tr);
            if (ticket.status !== 'EXCLUIDO' && !ticket.isDeleted) {
                totalRevenue += ticket.pricePaid;
            }
        });

        totalTicketsSpan.textContent = data.filter(t => t.status !== 'EXCLUIDO' && !t.isDeleted).length;
        totalRevenueSpan.textContent = totalRevenue.toFixed(2);

    } catch (error) {
        console.error('Erro ao buscar relatório de bilhetes:', error);
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--cor-erro);">Erro ao carregar o relatório.</td></tr>';
    }
}

async function loadEventDetails(eventId) {
    const token = await window.getAuthToken();
    fetch(`/api/events/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(response => response.json())
        .then(data => {
            if (data && data.eventName) {
                document.getElementById('report-title').textContent = `Relatório de Vendas: ${data.eventName}`;
            }
        })
        .catch(error => console.error('Erro ao buscar detalhes do evento:', error));
}

async function deleteTicket(ticketId, eventId) {
    if (!confirm(`Tem a certeza de que quer excluir o bilhete ${ticketId}? Esta ação irá invalidá-lo para o check-in.`)) {
        return;
    }

    const apiUrl = `/api/event/ticket/delete/${ticketId}`;
    const token = await window.getAuthToken();

    try {
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            alert('Bilhete excluído com sucesso!');
            loadTicketReport(eventId); // Recarrega o relatório
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        alert('Erro ao excluir o bilhete: ' + error.message);
    }
}
