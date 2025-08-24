document.addEventListener('DOMContentLoaded', () => {
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

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // Verifica se o utilizador já está autenticado
    auth.onAuthStateChanged(user => {
        if (user) {
            user.getIdTokenResult().then(idTokenResult => {
                const claims = idTokenResult.claims;
                if (claims.role === 'admin') {
                    window.location.href = '/admin/events';
                } else {
                    window.location.href = '/admin/tickets';
                }
            });
        }
    });

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // O onAuthStateChanged irá tratar do redirecionamento
            })
            .catch((error) => {
                console.error("Erro de login:", error);
                errorMessage.textContent = 'Email ou palavra-passe inválidos.';
                errorMessage.classList.remove('hidden');
            });
    });
});
