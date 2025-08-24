document.addEventListener('DOMContentLoaded', () => {
    const addTicketTypeBtn = document.getElementById('add-ticket-type-btn');
    const addComboBtn = document.getElementById('add-combo-btn');
    const eventForm = document.getElementById('event-form');

    if (addTicketTypeBtn) {
        addTicketTypeBtn.addEventListener('click', addTicketTypeEntry);
    }
    if (addComboBtn) {
        addComboBtn.addEventListener('click', addComboEntry);
    }
    if (eventForm) {
        eventForm.addEventListener('submit', handleFormSubmit);
    }
});

function initializeEventCreationPage() {
    addTicketTypeEntry();
}

function addComboEntry() {
    const combosContainer = document.getElementById('combos-container');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'link-entry';
    
    entryDiv.innerHTML = `
        <div class="field-group" style="flex-grow: 2;">
            <input type="text" class="combo-name" placeholder="Nome do Combo (Ex: Combo Casal)" required>
        </div>
        <div class="field-group">
            <input type="number" class="combo-price" placeholder="Preço Total" step="0.01" required>
        </div>
        <div class="field-group">
            <input type="number" class="combo-quantity" placeholder="Nº de Convites" min="1" required>
        </div>
        <button type="button" class="remove-link-btn">-</button>
    `;
    combosContainer.appendChild(entryDiv);

    entryDiv.querySelector('.remove-link-btn').addEventListener('click', () => {
        entryDiv.remove();
    });
}

function addTicketTypeEntry() {
    const ticketTypesContainer = document.getElementById('ticket-types-container');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'link-entry';
    
    entryDiv.innerHTML = `
        <div class="field-group">
            <input type="text" class="ticket-type-name" placeholder="Nome (Ex: Pista)" required>
        </div>
        <div class="field-group">
            <input type="number" class="ticket-type-price" placeholder="Preço (Ex: 150.00)" step="0.01" required>
        </div>
        <label class="qr-type-selector" style="margin-bottom: 0;">
            <input type="checkbox" class="ticket-type-active" checked> Vendas Ativas
        </label>
        <button type="button" class="remove-link-btn">-</button>
    `;
    ticketTypesContainer.appendChild(entryDiv);

    entryDiv.querySelector('.remove-link-btn').addEventListener('click', () => {
        entryDiv.remove();
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const token = await window.getAuthToken();
    if (!token) {
        alert("Sessão inválida. Por favor, faça login novamente.");
        return;
    }
    
    const ticketTypes = [];
    document.querySelectorAll('#ticket-types-container .link-entry').forEach(entry => {
        const name = entry.querySelector('.ticket-type-name').value;
        const price = parseFloat(entry.querySelector('.ticket-type-price').value);
        const active = entry.querySelector('.ticket-type-active').checked;
        if (name && !isNaN(price)) {
            ticketTypes.push({ name, price, active });
        }
    });

    const combos = [];
    document.querySelectorAll('#combos-container .link-entry').forEach(entry => {
        const name = entry.querySelector('.combo-name').value;
        const price = parseFloat(entry.querySelector('.combo-price').value);
        const quantity = parseInt(entry.querySelector('.combo-quantity').value, 10);
        if (name && !isNaN(price) && !isNaN(quantity) && quantity > 0) {
            combos.push({ name, price, quantity, active: true });
        }
    });

    if (ticketTypes.length === 0) {
        alert('Adicione pelo menos um tipo de convite.');
        return;
    }

    const payload = {
        eventName: document.getElementById('eventName').value,
        eventLocation: document.getElementById('eventLocation').value,
        eventDate: document.getElementById('eventDate').value,
        eventTime: document.getElementById('eventTime').value,
        organizerName: document.getElementById('organizerName').value,
        supportContact: document.getElementById('supportContact').value,
        eventDetails: document.getElementById('eventDetails').value, // NOVO
        ticketTypes: ticketTypes,
        combos: combos
    };

    try {
        const response = await fetch('/api/events/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        const responseArea = document.getElementById('response-area');
        responseArea.classList.remove('hidden');
        if (data.success) {
            responseArea.style.backgroundColor = 'var(--cor-sucesso)';
            responseArea.innerHTML = `<h3>Sucesso!</h3><p>Evento '${payload.eventName}' criado com ID: ${data.eventId}</p>`;
            document.getElementById('event-form').reset();
            document.getElementById('ticket-types-container').innerHTML = '';
            document.getElementById('combos-container').innerHTML = '';
            addTicketTypeEntry();
        } else {
            responseArea.style.backgroundColor = 'var(--cor-erro)';
            responseArea.innerHTML = `<h3>Erro!</h3><p>${data.error || 'Não foi possível criar o evento.'}</p>`;
        }
    } catch (error) {
        console.error('Erro de comunicação:', error);
        const responseArea = document.getElementById('response-area');
        responseArea.classList.remove('hidden');
        responseArea.style.backgroundColor = 'var(--cor-erro)';
        responseArea.innerHTML = `<h3>Erro de Conexão!</h3><p>Não foi possível conectar ao servidor.</p>`;
    }
}