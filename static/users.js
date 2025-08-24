// A chamada inicial é feita pelo auth.js
document.addEventListener('DOMContentLoaded', () => {
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', handleCreateUser);
    }
});

async function loadUsers() {
    const usersTableBody = document.getElementById('users-table-body');
    const token = await window.getAuthToken();
    if (!token) return;

    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar utilizadores.');
        const users = await response.json();

        usersTableBody.innerHTML = '';
        if (users && users.length > 0) {
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.displayName}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                `;
                usersTableBody.appendChild(tr);
            });
        } else {
            usersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Nenhum utilizador encontrado.</td></tr>';
        }
    } catch (error) {
        console.error('Erro ao carregar utilizadores:', error);
        usersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--cor-erro);">Erro ao carregar utilizadores.</td></tr>';
    }
}

async function handleCreateUser(event) {
    event.preventDefault();
    const token = await window.getAuthToken();
    if (!token) {
        alert('Sessão inválida. Por favor, faça login novamente.');
        return;
    }

    const payload = {
        displayName: document.getElementById('displayName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        role: document.getElementById('role').value,
    };

    const responseArea = document.getElementById('response-area');

    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        responseArea.classList.remove('hidden');
        if (response.ok && data.success) {
            responseArea.style.backgroundColor = 'var(--cor-sucesso)';
            responseArea.innerHTML = `<p>${data.message}</p>`;
            document.getElementById('create-user-form').reset();
            loadUsers(); // Recarrega a lista
        } else {
            responseArea.style.backgroundColor = 'var(--cor-erro)';
            responseArea.innerHTML = `<p>${data.error || 'Não foi possível criar o utilizador.'}</p>`;
        }
    } catch (error) {
        console.error('Erro de comunicação:', error);
        responseArea.classList.remove('hidden');
        responseArea.style.backgroundColor = 'var(--cor-erro)';
        responseArea.innerHTML = `<p>Erro de conexão com o servidor.</p>`;
    }
}
