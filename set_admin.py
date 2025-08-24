import firebase_admin
from firebase_admin import credentials, auth

# --- Configuração do Firebase Admin ---
# Este script assume que está na mesma pasta que o seu serviceAccountKey.json
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

# --- AÇÃO NECESSÁRIA ---
# Substitua o texto abaixo pelo UID do utilizador que você copiou do Firebase
uid = "JrrTqg5gALNhw4UuOkO4EZpZUiS2" 

try:
    # Define a permissão (custom claim) de 'admin' para o utilizador especificado
    auth.set_custom_user_claims(uid, {'role': 'admin'})
    
    # Verifica se a permissão foi definida corretamente
    user = auth.get_user(uid)
    print(f"Sucesso! O utilizador: {user.email} agora tem a função de '{user.custom_claims['role']}'.")
    print("Pode agora fazer login no ScanSys como administrador.")

except Exception as e:
    print(f"Ocorreu um erro: {e}")
    print("Verifique se o UID está correto e se o ficheiro serviceAccountKey.json está na pasta.")

