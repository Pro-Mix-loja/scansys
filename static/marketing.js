document.addEventListener('DOMContentLoaded', () => {
    const marketingForm = document.getElementById('marketing-form');
    if (marketingForm) {
        marketingForm.addEventListener('submit', handleFormSubmit);
    }

    // Lógica para alternar entre os tipos de QR Code
    document.querySelectorAll('input[name="qr-type"]').forEach(radio => {
        radio.addEventListener('change', toggleQrTypeSections);
    });

    // Lógica para o formulário de captura de leads
    const leadCaptureToggle = document.getElementById('lead-capture-toggle');
    if(leadCaptureToggle) {
        leadCaptureToggle.addEventListener('change', () => {
            document.getElementById('lead-capture-config').classList.toggle('hidden', !leadCaptureToggle.checked);
        });
    }

    // Botão para adicionar mais links na Página de Links
    const addLinkBtn = document.getElementById('add-link-btn');
    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', () => addLinkEntry());
    }

    // Inicializa a página
    toggleQrTypeSections();
});

function toggleQrTypeSections() {
    const selectedType = document.querySelector('input[name="qr-type"]:checked').value;
    const redirectSection = document.getElementById('redirect-section');
    const linkpageSection = document.getElementById('linkpage-section');
    const destinationUrlInput = document.getElementById('destinationUrl');

    if (selectedType === 'redirect') {
        redirectSection.classList.remove('hidden');
        linkpageSection.classList.add('hidden');
        destinationUrlInput.required = true;
    } else { // linkpage
        redirectSection.classList.add('hidden');
        linkpageSection.classList.remove('hidden');
        destinationUrlInput.required = false;
        // Adiciona um campo de link se não houver nenhum
        if (document.querySelectorAll('#links-container .link-entry').length === 0) {
            addLinkEntry();
        }
    }
}

function addLinkEntry(title = '', url = '') {
    const container = document.getElementById('links-container');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'link-entry';
    entryDiv.innerHTML = `
        <div class="field-group"><input type="text" class="link-title" placeholder="Título do Link" value="${title}" required></div>
        <div class="field-group"><input type="url" class="link-url" placeholder="https://..." value="${url}" required></div>
        <button type="button" class="remove-link-btn">-</button>
    `;
    container.appendChild(entryDiv);

    entryDiv.querySelector('.remove-link-btn').addEventListener('click', () => {
        entryDiv.remove();
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'A gerar...';

    const responseArea = document.getElementById('response-area');
    responseArea.classList.add('hidden');

    const token = await window.getAuthToken();
    if (!token) {
        alert("Sessão inválida. Por favor, faça login novamente.");
        submitButton.disabled = false;
        submitButton.textContent = 'Gerar QR Code';
        return;
    }

    const type = document.querySelector('input[name="qr-type"]:checked').value;
    const title = document.getElementById('title').value;
    const payload = { type, title };

    if (type === 'redirect') {
        payload.destinationUrl = document.getElementById('destinationUrl').value;
    } else { // linkpage
        const links = [];
        document.querySelectorAll('#links-container .link-entry').forEach(entry => {
            const linkTitle = entry.querySelector('.link-title').value;
            const linkUrl = entry.querySelector('.link-url').value;
            if (linkTitle && linkUrl) {
                links.push({ title: linkTitle, url: linkUrl });
            }
        });
        if (links.length === 0) {
            alert('Adicione pelo menos um link para a Página de Links.');
            submitButton.disabled = false;
            submitButton.textContent = 'Gerar QR Code';
            return;
        }
        payload.links = links;

        const leadCaptureEnabled = document.getElementById('lead-capture-toggle').checked;
        payload.leadCapture = {
            enabled: leadCaptureEnabled,
            title: document.getElementById('lead-capture-title').value || 'Deixe seu contacto',
            buttonText: document.getElementById('lead-capture-button-text').value || 'Enviar'
        };
    }

    try {
        const response = await fetch('/api/marketing/qr/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        responseArea.classList.remove('hidden');
        if (data.success) {
            responseArea.style.backgroundColor = 'var(--cor-sucesso)';
            responseArea.innerHTML = `<h3>QR Code Gerado!</h3>
                <p>O seu link é: <a href="${data.qrCodeUrl}" target="_blank">${data.qrCodeUrl}</a></p>
                <div id="qrcode-result" style="background: white; padding: 10px; display: inline-block; margin-top: 10px;"></div>`;
            new QRCode(document.getElementById("qrcode-result"), data.qrCodeUrl);
            
            // CORREÇÃO: Obter o formulário diretamente pelo ID antes de o limpar.
            document.getElementById('marketing-form').reset();
            
            toggleQrTypeSections();
        } else {
            throw new Error(data.error || 'Não foi possível criar o QR Code.');
        }

    } catch (error) {
        console.error('Erro na comunicação com a API:', error);
        responseArea.classList.remove('hidden');
        responseArea.style.backgroundColor = 'var(--cor-erro)';
        responseArea.innerHTML = `<h3>Erro!</h3><p>${error.message}</p>`;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Gerar QR Code';
    }
}