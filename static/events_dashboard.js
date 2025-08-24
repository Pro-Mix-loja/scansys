document.addEventListener('DOMContentLoaded', function() {
    const editModal = document.getElementById('edit-event-modal');
    const cancelBtn = document.getElementById('cancel-event-edit-btn');
    const addTicketTypeBtn = document.getElementById('edit-add-ticket-type-btn');
    const addComboBtn = document.getElementById('edit-add-combo-btn');
    const editForm = document.getElementById('edit-event-form');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => editModal.classList.add('hidden'));
    }
    if (addTicketTypeBtn) {
        addTicketTypeBtn.addEventListener('click', () => addTicketTypeEntryToModal());
    }
    if (addComboBtn) {
        addComboBtn.addEventListener('click', () => addComboEntryToModal());
    }
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveEventChanges();
        });
    }
});

async function loadEvents() {
    const apiUrl = '/api/events';
    const tableBody = document.getElementById('events-table-body');
    
    try {
        const token = await window.getAuthToken();
        const response = await fetch(apiUrl, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (response.status === 401) { 
            window.location.href = '/'; 
            return; 
        }
        if (!response.ok) throw new Error('Falha ao carregar eventos.');

        const data = await response.json();
        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum evento encontrado. Crie um novo!</td></tr>';
            return;
        }

        data.forEach(event => {
            const tr = document.createElement('tr');
            const ticketTypesHtml = event.ticketTypes.map(t => {
                const statusClass = t.active ? 'status-active' : 'status-inactive';
                return `<span class="ticket-type-tag ${statusClass}">${t.name}</span>`;
            }).join(' ');
            tr.innerHTML = `
                <td>${event.eventName}</td>
                <td>${new Date(event.eventDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${ticketTypesHtml}</td>
                <td style="text-align: center;">
                    <a href="/admin/tickets?eventId=${event.eventId}" class="action-icon" title="Vender Convites"><i class="fas fa-ticket-alt"></i></a>
                    <a href="/admin/events/report/${event.eventId}" class="action-icon" title="Relatório de Vendas" style="background-color: #17a2b8;"><i class="fas fa-chart-bar"></i></a>
                    <a href="#" class="action-icon action-icon-edit" title="Editar Evento" onclick="event.preventDefault(); editEvent('${event.eventId}')"><i class="fas fa-pencil-alt"></i></a>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--cor-erro);">Erro ao carregar os dados.</td></tr>';
    }
}

async function editEvent(eventId) {
    const apiUrl = `/api/events/${eventId}`;
    try {
        const token = await window.getAuthToken();
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Evento não encontrado.');
        const data = await response.json();
        
        document.getElementById('edit-eventId').value = data.eventId;
        document.getElementById('edit-eventName').value = data.eventName;
        document.getElementById('edit-eventLocation').value = data.eventLocation || '';
        document.getElementById('edit-eventDate').value = data.eventDate;
        document.getElementById('edit-eventTime').value = data.eventTime || '';
        document.getElementById('edit-organizerName').value = data.organizerName || '';
        document.getElementById('edit-supportContact').value = data.supportContact || '';
        document.getElementById('edit-eventDetails').value = data.eventDetails || ''; // NOVO

        const ticketContainer = document.getElementById('edit-ticket-types-container');
        ticketContainer.innerHTML = '';
        data.ticketTypes.forEach(t => addTicketTypeEntryToModal(t.name, t.price, t.active));

        const comboContainer = document.getElementById('edit-combos-container');
        comboContainer.innerHTML = '';
        if (data.combos) {
            data.combos.forEach(c => addComboEntryToModal(c.name, c.price, c.quantity));
        }

        document.getElementById('edit-event-modal').classList.remove('hidden');
    } catch (error) {
        alert('Erro ao buscar dados do evento: ' + error.message);
    }
}

function addComboEntryToModal(name = '', price = '', quantity = '') {
    const container = document.getElementById('edit-combos-container');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'link-entry';
    entryDiv.innerHTML = `
        <div class="field-group" style="flex-grow: 2;"><input type="text" class="combo-name" placeholder="Nome do Combo" value="${name}" required></div>
        <div class="field-group"><input type="number" class="combo-price" placeholder="Preço" step="0.01" value="${price}" required></div>
        <div class="field-group"><input type="number" class="combo-quantity" placeholder="Nº de Convites" min="1" value="${quantity}" required></div>
        <button type="button" class="remove-link-btn">-</button>
    `;
    container.appendChild(entryDiv);
    entryDiv.querySelector('.remove-link-btn').addEventListener('click', () => entryDiv.remove());
}

function addTicketTypeEntryToModal(name = '', price = '', active = true) {
    const container = document.getElementById('edit-ticket-types-container');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'link-entry';
    const isChecked = active ? 'checked' : '';
    entryDiv.innerHTML = `
        <div class="field-group"><input type="text" class="ticket-type-name" placeholder="Nome" value="${name}" required></div>
        <div class="field-group"><input type="number" class="ticket-type-price" placeholder="Preço" step="0.01" value="${price}" required></div>
        <label class="qr-type-selector" style="margin-bottom: 0;"><input type="checkbox" class="ticket-type-active" ${isChecked}> Ativo</label>
        <button type="button" class="remove-link-btn">-</button>
    `;
    container.appendChild(entryDiv);
    entryDiv.querySelector('.remove-link-btn').addEventListener('click', () => entryDiv.remove());
}

async function saveEventChanges() {
    const eventId = document.getElementById('edit-eventId').value;
    const ticketTypes = [];
    document.querySelectorAll('#edit-ticket-types-container .link-entry').forEach(entry => {
        const name = entry.querySelector('.ticket-type-name').value;
        const price = parseFloat(entry.querySelector('.ticket-type-price').value);
        const active = entry.querySelector('.ticket-type-active').checked;
        if (name && !isNaN(price)) {
            ticketTypes.push({ name, price, active });
        }
    });

    const combos = [];
    document.querySelectorAll('#edit-combos-container .link-entry').forEach(entry => {
        const name = entry.querySelector('.combo-name').value;
        const price = parseFloat(entry.querySelector('.combo-price').value);
        const quantity = parseInt(entry.querySelector('.combo-quantity').value, 10);
        if (name && !isNaN(price) && !isNaN(quantity) && quantity > 0) {
            combos.push({ name, price, quantity, active: true });
        }
    });

    if (ticketTypes.length === 0) {
        alert('O evento deve ter pelo menos um tipo de convite.');
        return;
    }

    const payload = {
        eventName: document.getElementById('edit-eventName').value,
        eventLocation: document.getElementById('edit-eventLocation').value,
        eventDate: document.getElementById('edit-eventDate').value,
        eventTime: document.getElementById('edit-eventTime').value,
        organizerName: document.getElementById('edit-organizerName').value,
        supportContact: document.getElementById('edit-supportContact').value,
        eventDetails: document.getElementById('edit-eventDetails').value, // NOVO
        ticketTypes: ticketTypes,
        combos: combos
    };

    const apiUrl = `/api/events/update/${eventId}`;
    try {
        const token = await window.getAuthToken();
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            alert('Evento atualizado com sucesso!');
            document.getElementById('edit-event-modal').classList.add('hidden');
            loadEvents();
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        alert('Erro ao salvar alterações: ' + error.message);
    }
}