// ===================================================================
// ARQUIVO DE CONFIGURAÇÃO DO SCANSYS VALIDATOR
// Versão: 1.1 - Corrigido erro de declaração duplicada
// ===================================================================

// Configuração do Firebase com as credenciais do projeto ScanSys DOB.
const firebaseConfig = {
    apiKey: "AIzaSyBV-ZhnMYRadkfXCGMeEEWTu7hHlEmQ7RU",
    authDomain: "scan-sys-dob.firebaseapp.com",
    projectId: "scan-sys-dob",
    storageBucket: "scan-sys-dob.appspot.com",
    messagingSenderId: "223596465304",
    appId: "1:223596465304:web:ff38d95a93d39300b394ed"
};

// --- Não precisa alterar nada abaixo desta linha ---

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Elementos do DOM
const readerSection = document.getElementById('reader-section');
const resultSection = document.getElementById('result-section');
const resultMessage = document.getElementById('result-message');
const ticketHolderName = document.getElementById('ticket-holder-name');
const scanNextButton = document.getElementById('scan-next-button');

let html5QrcodeScanner;

// Função chamada quando um QR Code é lido com sucesso
function onScanSuccess(decodedText, decodedResult) {
    // Para o scanner para evitar múltiplas leituras
    // Usamos a constante Html5QrcodeScannerState que a própria biblioteca nos dá
    if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrcodeScanner.pause();
    }
    validateTicket(decodedText);
}

// Função para validar o ingresso no Firestore
async function validateTicket(ticketId) {
    showResultScreen(); // Mostra a tela de resultado imediatamente

    const ticketRef = db.collection('eventTickets').doc(ticketId.trim());

    try {
        const doc = await ticketRef.get();

        if (!doc.exists) {
            setResultStatus('error', 'Ingresso Inválido', 'Este código não foi encontrado.');
        } else {
            const ticketData = doc.data();
            switch (ticketData.status) {
                case 'VALIDO':
                    await ticketRef.update({
                        status: 'CHECK_IN_REALIZADO',
                        checkInTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    setResultStatus('success', 'Entrada Liberada', ticketData.buyerName);
                    break;
                case 'CHECK_IN_REALIZADO':
                    const checkinTime = ticketData.checkInTimestamp ? new Date(ticketData.checkInTimestamp.seconds * 1000).toLocaleTimeString('pt-BR') : 'N/A';
                    setResultStatus('warning', 'Ingresso já Utilizado', `Check-in às ${checkinTime}`);
                    break;
                case 'CANCELADO':
                     setResultStatus('error', 'Ingresso Cancelado', ticketData.buyerName);
                    break;
                default:
                    setResultStatus('error', 'Status Desconhecido', 'Contate o suporte.');
            }
        }
    } catch (error) {
        console.error("Erro ao validar ingresso:", error);
        setResultStatus('error', 'Erro no Sistema', 'Verifique a conexão.');
    }
}

// Funções auxiliares para controlar a UI
function showResultScreen() {
    readerSection.style.display = 'none';
    resultSection.classList.remove('hidden');
}

function hideResultScreenAndRestartScanner() {
    resultSection.classList.add('hidden');
    readerSection.style.display = 'block';
    if (html5QrcodeScanner && html5QrcodeScanner.getState() !== Html5QrcodeScannerState.SCANNING) {
        html5QrcodeScanner.resume();
    }
}

function setResultStatus(status, message, holderName) {
    resultSection.className = 'result-section'; // Limpa classes antigas
    resultSection.classList.add(`${status}-bg`);
    resultMessage.innerText = message;
    ticketHolderName.innerText = holderName || '';
}

// Event Listeners
scanNextButton.addEventListener('click', hideResultScreenAndRestartScanner);

// Inicializa o Scanner quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", 
        { 
            fps: 10, 
            qrbox: { width: 250, height: 250 } 
        },
        /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess);
});