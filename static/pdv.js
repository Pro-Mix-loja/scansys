/**
 * Adiciona um zero à esquerda de um número se ele for menor que 10.
 * @param {number} num O número a ser formatado.
 * @returns {string} O número formatado com dois dígitos.
 */
function padNumber(num) {
    return num.toString().padStart(2, '0');
}

/**
 * Aplica uma máscara de telefone (xx) xxxxx-xxxx ao campo de input.
 * @param {HTMLInputElement} input O campo de input do telefone.
 */
function applyPhoneMask(input) {
    input.addEventListener('input', () => {
        let value = input.value.replace(/\D/g, '');
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
        input.value = value;
    });
}

/**
 * Formata um número de telefone para o padrão internacional do WhatsApp (Ex: 5511999999999).
 * @param {string} phone O número de telefone com máscara.
 * @returns {string} O número de telefone limpo e com código do país.
 */
function formatPhoneNumberForWhatsApp(phone) {
    if (!phone) return '';
    return '55' + phone.replace(/\D/g, '');
}

document.addEventListener('DOMContentLoaded', function() {
    const sellTicketForm = document.getElementById('sell-ticket-form');
    if (sellTicketForm) {
        sellTicketForm.addEventListener('submit', handleTicketSale);
    }
    
    const ticketTypeSelect = document.getElementById('ticket-type');
    if(ticketTypeSelect) {
        ticketTypeSelect.addEventListener('change', handleTicketTypeChange);
    }

    const phoneInput = document.getElementById('buyerPhone');
    if (phoneInput) {
        applyPhoneMask(phoneInput);
    }
    
    const newSaleBtn = document.getElementById('new-sale-btn');
    if(newSaleBtn){
        newSaleBtn.addEventListener('click', () => {
            document.getElementById('sale-result-area').classList.add('hidden');
            document.getElementById('sell-ticket-form').classList.remove('hidden');
            sellTicketForm.reset();
            updateTicketTypeDropdown({ticketTypes:[], combos:[]});
            document.getElementById('event-select').value = "";
            handleTicketTypeChange();
        });
    }
});

async function loadEventsForPDV() {
    const apiUrl = '/api/events';
    const eventSelect = document.getElementById('event-select');
    try {
        const token = await window.getAuthToken();
        if (!token) throw new Error("Token de autenticação não encontrado.");

        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
        
        const events = await response.json();

        eventSelect.innerHTML = '<option value="">Selecione um Evento</option>';
        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.eventId;
            option.textContent = event.eventName;
            option.dataset.eventData = JSON.stringify(event);
            eventSelect.appendChild(option);
        });

        eventSelect.addEventListener('change', () => {
            const selectedOption = eventSelect.options[eventSelect.selectedIndex];
            if (selectedOption.value) {
                const eventData = JSON.parse(selectedOption.dataset.eventData);
                updateTicketTypeDropdown(eventData);
            } else {
                updateTicketTypeDropdown({ticketTypes:[], combos:[]});
            }
             handleTicketTypeChange();
        });
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        alert('Não foi possível carregar os eventos. Verifique a consola.');
    }
}

function updateTicketTypeDropdown(eventData) {
    const ticketTypeSelect = document.getElementById('ticket-type');
    ticketTypeSelect.innerHTML = '<option value="">Selecione o Tipo ou Combo</option>';
    
    const ticketGroup = document.createElement('optgroup');
    ticketGroup.label = 'Convites';
    if(eventData.ticketTypes) {
        eventData.ticketTypes.forEach(type => {
            if (type.active) {
                const option = document.createElement('option');
                option.value = type.price;
                option.textContent = `${type.name} - R$ ${type.price.toFixed(2)}`;
                option.dataset.name = type.name;
                option.dataset.type = 'ticket';
                ticketGroup.appendChild(option);
            }
        });
    }
    ticketTypeSelect.appendChild(ticketGroup);

    if (eventData.combos && eventData.combos.length > 0) {
        const comboGroup = document.createElement('optgroup');
        comboGroup.label = 'Combos';
        eventData.combos.forEach(combo => {
            const option = document.createElement('option');
            option.value = combo.price;
            option.textContent = `${combo.name} (${combo.quantity} convites) - R$ ${combo.price.toFixed(2)}`;
            option.dataset.name = combo.name;
            option.dataset.type = 'combo';
            option.dataset.quantity = combo.quantity;
            comboGroup.appendChild(option);
        });
        ticketTypeSelect.appendChild(comboGroup);
    }
}

function handleTicketTypeChange() {
    const ticketTypeSelect = document.getElementById('ticket-type');
    const quantityInput = document.getElementById('ticket-quantity');
    const selectedOption = ticketTypeSelect.options[ticketTypeSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.dataset.type) {
        quantityInput.disabled = true;
        quantityInput.value = 1;
        return;
    }

    if (selectedOption.dataset.type === 'combo') {
        quantityInput.value = 1;
        quantityInput.disabled = true;
    } else {
        quantityInput.disabled = false;
    }
}

async function handleTicketSale(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'A gerar...';

    try {
        const token = await window.getAuthToken();
        if (!token) throw new Error("Sessão expirada. Faça login novamente.");

        const eventSelect = document.getElementById('event-select');
        const selectedEventOption = eventSelect.options[eventSelect.selectedIndex];
        const ticketTypeSelect = document.getElementById('ticket-type');
        const selectedTicketOption = ticketTypeSelect.options[ticketTypeSelect.selectedIndex];
        
        let loopCount = 0;
        const isCombo = selectedTicketOption.dataset.type === 'combo';
        
        if (isCombo) {
            loopCount = parseInt(selectedTicketOption.dataset.quantity, 10);
        } else {
            loopCount = parseInt(document.getElementById('ticket-quantity').value, 10);
        }

        if (isNaN(loopCount) || loopCount <= 0) {
            throw new Error("Quantidade de convites inválida.");
        }
        
        const generatedTicketsContainer = document.getElementById('generated-tickets-container');
        generatedTicketsContainer.innerHTML = '';

        for (let i = 0; i < loopCount; i++) {
            let controlNumber = '';
            if (isCombo && loopCount > 1) {
                controlNumber = `${padNumber(i + 1)}/${padNumber(loopCount)}`;
            } else if (!isCombo && loopCount > 1) {
                controlNumber = `${i + 1}`;
            }

            const payload = {
                eventId: selectedEventOption.value,
                eventName: selectedEventOption.textContent,
                buyerName: document.getElementById('buyerName').value,
                buyerPhone: document.getElementById('buyerPhone').value,
                ticketType: selectedTicketOption.dataset.name,
                pricePaid: parseFloat(selectedTicketOption.value),
                paymentMethod: document.getElementById('payment-method').value,
                // ALTERAÇÃO: Adiciona o número de controle ao payload para ser salvo no banco de dados
                controlNumber: controlNumber 
            };
            
            const response = await fetch('/api/event/ticket/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || `Erro ao gerar convite ${i + 1}`);
            
            displayGeneratedTicket(result, payload, controlNumber);
        }

        document.getElementById('sell-ticket-form').classList.add('hidden');
        document.getElementById('sale-result-area').classList.remove('hidden');

    } catch (error) {
        alert(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Gerar Convite(s)';
    }
}

function displayGeneratedTicket(result, payload, controlNumber) {
    const container = document.getElementById('generated-tickets-container');
    const ticketDiv = document.createElement('div');
    ticketDiv.className = 'ticket-result-entry';

    const phoneNumber = formatPhoneNumberForWhatsApp(payload.buyerPhone);
    const message = `Olá, ${payload.buyerName}! Seu convite para o evento *${payload.eventName}* foi gerado com sucesso.\n\nClique no link abaixo para ver e salvar seu convite em PDF:\n\n${result.pdfUrl}\n\nGuarde este link com segurança!`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    const controlHtml = controlNumber ? `<p><strong>Controle:</strong> ${controlNumber}</p>` : '';

    ticketDiv.innerHTML = `
        <div class="ticket-info">
            <p><strong>Comprador:</strong> ${payload.buyerName}</p>
            <p><strong>Tipo:</strong> ${payload.ticketType}</p>
            ${controlHtml} 
            <p><strong>ID:</strong> ${result.ticketId}</p>
            <div class="ticket-actions">
                <a href="${result.pdfUrl}" target="_blank" class="action-btn pdf-btn">
                    <i class="fas fa-file-pdf"></i> Abrir PDF
                </a>
                <a href="${whatsappUrl}" target="_blank" class="action-btn whatsapp-btn">
                    <i class="fab fa-whatsapp"></i> Enviar via WhatsApp
                </a>
            </div>
        </div>
    `;
    
    container.appendChild(ticketDiv);
}