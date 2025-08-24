// Declara as variáveis de elementos num escopo global para que todas as funções as possam aceder
const eventSelector = document.getElementById('eventSelector');
const ticketTypeSelector = document.getElementById('ticketTypeSelector');
const quantityInput = document.getElementById('quantity');
const pricePaidInput = document.getElementById('pricePaid');
const vendaForm = document.getElementById('venda-form');
const responseArea = document.getElementById('response-area');
const paymentMethodSelector = document.getElementById('paymentMethod');
let eventsData = []; // Variável global para os dados dos eventos

// A chamada inicial para loadEventsForPDV() é feita pelo auth.js
document.addEventListener('DOMContentLoaded', () => {
    // Apenas configura os listeners dos elementos do formulário
    eventSelector.addEventListener('change', () => updateTicketTypes(eventSelector.value));
    ticketTypeSelector.addEventListener('change', updateTotalPrice);
    quantityInput.addEventListener('input', updateTotalPrice);
    vendaForm.addEventListener('submit', submitSale);
});

async function loadEventsForPDV() {
    const token = await window.getAuthToken();
    if (!token) return;

    fetch('/api/events', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(response => response.json())
        .then(data => {
            eventsData = data;
            eventSelector.innerHTML = '<option value="">-- Selecione um evento --</option>';
            if (data && data.length > 0) {
                data.forEach(event => {
                    const option = document.createElement('option');
                    option.value = event.eventId;
                    option.textContent = event.eventName;
                    eventSelector.appendChild(option);
                });
                const eventIdFromUrl = new URLSearchParams(window.location.search).get('eventId');
                if (eventIdFromUrl) {
                    eventSelector.value = eventIdFromUrl;
                    eventSelector.dispatchEvent(new Event('change'));
                }
            } else {
                eventSelector.innerHTML = '<option value="">Nenhum evento cadastrado</option>';
            }
        })
        .catch(error => console.error("Erro ao carregar eventos:", error));
}

function updateTicketTypes(selectedEventId) {
    ticketTypeSelector.innerHTML = '<option value="">-- Selecione o tipo --</option>';
    ticketTypeSelector.disabled = true;
    updateTotalPrice();

    if (selectedEventId) {
        const selectedEvent = eventsData.find(event => event.eventId === selectedEventId);
        if (selectedEvent && selectedEvent.ticketTypes) {
            const activeTickets = selectedEvent.ticketTypes.filter(ticket => ticket.active);
            if (activeTickets.length > 0) {
                activeTickets.forEach(ticketType => {
                    const option = document.createElement('option');
                    option.value = ticketType.name;
                    option.textContent = `${ticketType.name} (R$ ${ticketType.price.toFixed(2)})`;
                    option.dataset.price = ticketType.price;
                    ticketTypeSelector.appendChild(option);
                });
                ticketTypeSelector.disabled = false;
            } else {
                ticketTypeSelector.innerHTML = '<option value="">Nenhum ingresso à venda</option>';
            }
        }
    }
}

function updateTotalPrice() {
    const selectedOption = ticketTypeSelector.options[ticketTypeSelector.selectedIndex];
    const quantity = parseInt(quantityInput.value, 10);
    if (selectedOption && selectedOption.dataset.price && quantity > 0) {
        const unitPrice = parseFloat(selectedOption.dataset.price);
        pricePaidInput.value = (unitPrice * quantity).toFixed(2);
    } else {
        pricePaidInput.value = '';
    }
}

async function submitSale(event) {
    event.preventDefault();
    const token = await window.getAuthToken();
    const selectedEventId = eventSelector.value;
    const ticketTypeName = ticketTypeSelector.value;
    const buyerName = document.getElementById('buyerName').value;
    const quantity = parseInt(quantityInput.value, 10);
    const paymentMethod = paymentMethodSelector.value;

    if (!selectedEventId || !buyerName.trim() || !ticketTypeName || !(quantity > 0) || !paymentMethod) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }

    const selectedEvent = eventsData.find(event => event.eventId === selectedEventId);
    const selectedTicketType = selectedEvent.ticketTypes.find(t => t.name === ticketTypeName);
    
    const ticketPromises = [];
    for (let i = 0; i < quantity; i++) {
        const ticketData = {
            eventId: selectedEventId, eventName: selectedEvent.eventName,
            buyerName: quantity > 1 ? `${buyerName} (${i + 1}/${quantity})` : buyerName,
            ticketType: ticketTypeName, pricePaid: selectedTicketType.price,
            paymentMethod: paymentMethod
        };
        const promise = fetch('/api/event/ticket/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(ticketData),
        }).then(response => response.json());
        ticketPromises.push(promise);
    }

    try {
        const results = await Promise.all(ticketPromises);
        responseArea.classList.remove('hidden');
        responseArea.style.backgroundColor = 'var(--cor-sucesso)';
        const successResults = results.filter(r => r.success);
        const failedCount = quantity - successResults.length;
        let responseHTML = `<h3>${successResults.length} de ${quantity} Ingresso(s) Gerado(s) com Sucesso!</h3>`;
        if (failedCount > 0) {
            responseHTML += `<p>${failedCount} ingresso(s) falharam.</p>`;
        }
        
        const linksContainer = document.createElement('div');
        linksContainer.className = 'modal-actions';
        linksContainer.style.cssText = 'margin-top: 15px; justify-content: center; flex-wrap: wrap;';
        
        successResults.forEach((result, index) => {
            const downloadLink = document.createElement('a');
            downloadLink.href = result.pdfUrl;
            downloadLink.className = 'action-btn';
            downloadLink.style.margin = '5px';
            downloadLink.textContent = `Baixar Ingresso ${index + 1}`;
            downloadLink.target = '_blank';
            linksContainer.appendChild(downloadLink);
        });

        if(successResults.length > 0) {
            const shareBtn = document.createElement('button');
            shareBtn.className = 'action-btn';
            shareBtn.style.margin = '5px';
            shareBtn.textContent = 'Compartilhar';
            shareBtn.onclick = () => {
                const firstPdfUrl = successResults[0].pdfUrl;
                shareTicket(firstPdfUrl, selectedEvent.eventName, buyerName);
            };
            linksContainer.appendChild(shareBtn);
        }
        
        responseArea.innerHTML = responseHTML;
        responseArea.appendChild(linksContainer);

        vendaForm.reset();
        ticketTypeSelector.innerHTML = '<option value="">Selecione um evento primeiro</option>';
        ticketTypeSelector.disabled = true;
        eventSelector.value = "";
        pricePaidInput.value = "";

    } catch (error) {
        console.error('Erro na comunicação com a API:', error);
        responseArea.classList.remove('hidden');
        responseArea.style.backgroundColor = 'var(--cor-erro)';
        responseArea.innerHTML = `<h3>Erro de Conexão!</h3><p>Não foi possível conectar ao servidor.</p>`;
    }
}

function shareTicket(pdfUrl, eventName, buyerName) {
    const shareData = {
        title: `Ingresso para ${eventName}`,
        text: `Olá, ${buyerName}! Aqui está o seu ingresso para o evento ${eventName}.`,
        url: pdfUrl,
    };
    if (navigator.share) {
        navigator.share(shareData);
    } else {
        navigator.clipboard.writeText(pdfUrl).then(() => {
            alert('Link do ingresso copiado para a área de transferência!');
        });
    }
}
