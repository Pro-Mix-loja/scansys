// 1. Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBV-ZhnMYRadkfXCGMeEEWTu7hHlEmQ7RU",
    authDomain: "scan-sys-dob.firebaseapp.com",
    projectId: "scan-sys-dob",
    storageBucket: "scan-sys-dob.appspot.com",
    messagingSenderId: "223596465304",
    appId: "1:223596465304:web:ff38d95a93d39300b394ed"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 2. O Guardião de Autenticação Global
auth.onAuthStateChanged(user => {
    const currentPage = window.location.pathname;
    const isLoginPage = currentPage === '/login' || currentPage.endsWith('login.html');
    const isAdminPage = currentPage.startsWith('/admin');

    if (user) {
        // Utilizador está autenticado
        user.getIdTokenResult(true).then(idTokenResult => {
            const claims = idTokenResult.claims;
            
            window.currentUser = user;
            window.userClaims = claims;
            window.getAuthToken = () => user.getIdToken();

            localStorage.setItem('userClaims', JSON.stringify(claims));

            if (isLoginPage) {
                if (claims.role === 'admin') {
                    window.location.href = '/admin/events';
                } else {
                    window.location.href = '/admin/tickets';
                }
            } else {
                // Lógica de permissão
                if (currentPage.includes('/admin/users') && claims.role !== 'admin') {
                    alert('Acesso negado. Apenas administradores.');
                    window.location.href = '/admin/tickets';
                    return;
                }
                
                // Torna a página visível e configura o menu
                document.body.style.visibility = 'visible';
                setupUserMenu();

                // CHAMA A FUNÇÃO DE CARREGAMENTO DA PÁGINA ESPECÍFICA
                if (currentPage.endsWith('/admin/events') && typeof loadEvents === 'function') {
                    loadEvents();
                } else if (currentPage.endsWith('/admin/dashboard') && typeof loadQRCodes === 'function') {
                    loadQRCodes();
                } else if (currentPage.endsWith('/admin/leads') && typeof loadLeads === 'function') {
                    loadLeads();
                } else if (currentPage.endsWith('/admin/tickets') && typeof loadEventsForPDV === 'function') {
                    loadEventsForPDV();
                } else if (currentPage.includes('/admin/events/report') && typeof loadTicketReport === 'function') {
                    const pathParts = window.location.pathname.split('/');
                    const eventId = pathParts[pathParts.length - 1];
                    loadTicketReport(eventId);
                } else if (currentPage.endsWith('/admin/users') && typeof loadUsers === 'function') {
                    loadUsers();
                } else if (currentPage.endsWith('/admin/events/create') && typeof initializeEventCreationPage === 'function'){
                    initializeEventCreationPage();
                } else if (currentPage.endsWith('/admin/marketing/create') && typeof initializeMarketingCreationPage === 'function'){
                    initializeMarketingCreationPage();
                }
            }
        });
    } else {
        // Utilizador não está autenticado
        localStorage.removeItem('userClaims');
        if (isAdminPage) {
            window.location.href = '/login';
        } else {
            // Se estiver numa página pública (landing, validator, login), apenas a torna visível
            document.body.style.visibility = 'visible';
        }
    }
});

// 3. Lógica do Formulário de Login
if (document.getElementById('login-form')) {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        errorMessage.classList.add('hidden');

        auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                console.error("Erro de login:", error);
                errorMessage.textContent = 'Email ou palavra-passe inválidos.';
                errorMessage.classList.remove('hidden');
            });
    });
}

// 4. Lógica do Menu do Utilizador
function setupUserMenu() {
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');

    if (window.currentUser && userDisplayName) {
        userDisplayName.textContent = window.currentUser.displayName || window.currentUser.email;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            auth.signOut().then(() => {
                localStorage.clear();
                window.location.href = '/login';
            });
        });
    }
}

// 5. Esconde o corpo da página por defeito para evitar "flash" de conteúdo
document.body.style.visibility = 'hidden';
