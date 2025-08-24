// A chamada inicial para loadQRCodes() é feita pelo auth.js após o login.
document.addEventListener('DOMContentLoaded', function() {
    // Apenas configura os listeners dos botões do modal de edição
    const editModal = document.getElementById('edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const editForm = document.getElementById('edit-form');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            editModal.classList.add('hidden');
        });
    }
    if (editForm) {
        editForm.addEventListener('submit', (event) => {
            event.preventDefault();
            saveQRCodeChanges();
        });
    }
});

/**
 * Carrega a lista de QR Codes de marketing e preenche a tabela.
 */
async function loadQRCodes() {
    const apiUrl = '/api/marketing/qrs';
    const tableBody = document.getElementById('qrs-table-body');

    try {
        const token = await window.getAuthToken();
        if (!token) {
            console.warn("Utilizador não autenticado, a redirecionar...");
            window.location.href = '/login';
            return;
        }

        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!response.ok) throw new Error('Falha ao carregar QR Codes.');

        const data = await response.json();
        tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum QR Code encontrado. Crie um novo!</td></tr>';
            return;
        }

        data.forEach(qr => {
            const tr = document.createElement('tr');
            // O destino pode variar dependendo do tipo de QR Code
            const destination = qr.type === 'redirect' ? qr.destinationUrl : 'Página de Links';
            const redirectUrl = `https://scansys.onrender.com/r/${qr.shortId}`;

            tr.innerHTML = `
                <td>${qr.title}</td>
                <td><a href="${redirectUrl}" target="_blank">${destination}</a></td>
                <td>${qr.scanCount}</td>
                <td style="text-align: center;">
                    <a href="${redirectUrl}" class="action-icon" title="Abrir Link" target="_blank"><i class="fas fa-external-link-alt"></i></a>
                    <a href="#" class="action-icon action-icon-edit" title="Editar QR Code" onclick="event.preventDefault(); editQRCode('${qr.shortId}')"><i class="fas fa-pencil-alt"></i></a>
                    <a href="#" class="action-icon action-icon-delete" title="Excluir QR Code" onclick="event.preventDefault(); deleteQRCode('${qr.shortId}', '${qr.title}')"><i class="fas fa-trash-alt"></i></a>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro ao buscar QR Codes:', error);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--cor-erro);">Erro ao carregar os dados.</td></tr>';
    }
}

/**
 * Abre o modal para editar um QR Code específico.
 */
async function editQRCode(shortId) {
    // A edição só é permitida para QR Codes de redirecionamento simples, conforme o modal.
    const apiUrl = `/api/marketing/qr/${shortId}`;
    try {
        const token = await window.getAuthToken();
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('QR Code não encontrado.');

        const data = await response.json();

        if (data.type !== 'redirect') {
            alert('A edição rápida está disponível apenas para QR Codes de Redirecionamento Simples.');
            return;
        }

        document.getElementById('edit-shortId').value = data.shortId;
        document.getElementById('edit-title').value = data.title;
        document.getElementById('edit-destinationUrl').value = data.destinationUrl;
        document.getElementById('edit-modal').classList.remove('hidden');

    } catch (error) {
        alert('Erro ao buscar dados do QR Code: ' + error.message);
    }
}

/**
 * Salva as alterações feitas no modal de edição.
 */
async function saveQRCodeChanges() {
    const shortId = document.getElementById('edit-shortId').value;
    const payload = {
        title: document.getElementById('edit-title').value,
        destinationUrl: document.getElementById('edit-destinationUrl').value,
    };

    const apiUrl = `/api/marketing/qr/update/${shortId}`;
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
            alert('QR Code atualizado com sucesso!');
            document.getElementById('edit-modal').classList.add('hidden');
            loadQRCodes(); // Recarrega a lista
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        alert('Erro ao salvar alterações: ' + error.message);
    }
}

/**
 * Exclui um QR Code após confirmação.
 */
async function deleteQRCode(shortId, title) {
    if (!confirm(`Tem a certeza de que quer excluir o QR Code "${title}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    const apiUrl = `/api/marketing/qr/delete/${shortId}`;
    try {
        const token = await window.getAuthToken();
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            alert('QR Code excluído com sucesso!');
            loadQRCodes(); // Recarrega a lista
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        alert('Erro ao excluir o QR Code: ' + error.message);
    }
}