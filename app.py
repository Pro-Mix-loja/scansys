import firebase_admin
from firebase_admin import credentials, firestore, auth
from flask import Flask, request, jsonify, send_from_directory, redirect, render_template, Response, g
from flask_cors import CORS
import string
import random
import qrcode
import io
import base64
from weasyprint import HTML
import csv
from functools import wraps
from datetime import datetime
import os
import json

# --- Configuração do Firebase Admin (Adaptado para Produção) ---
try:
    # Para desenvolvimento local, lê o ficheiro
    cred = credentials.Certificate("serviceAccountKey.json")
except FileNotFoundError:
    # Para produção (Render, Heroku, etc.), lê a variável de ambiente
    service_account_info = json.loads(os.environ.get('SERVICE_ACCOUNT_JSON'))
    cred = credentials.Certificate(service_account_info)

firebase_admin.initialize_app(cred)
db = firestore.client()

# --- Inicialização do Flask ---
app = Flask(__name__, static_folder='static', static_url_path='', template_folder='templates')
CORS(app)

# ===================================================================
# FUNÇÕES AUXILIARES E DECORADOR DE AUTENTICAÇÃO
# ===================================================================
def generate_short_id(length=7):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for i in range(length))

def check_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Token de autorização em falta."}), 401
        try:
            token = token.split("Bearer ")[1]
            decoded_token = auth.verify_id_token(token)
            g.user = decoded_token # Usa g para guardar o utilizador
        except Exception as e:
            return jsonify({"error": "Token inválido ou expirado."}), 401
        return f(*args, **kwargs)
    return decorated

# ===================================================================
# ROTAS DA API - GESTÃO DE UTILIZADORES
# ===================================================================
@app.route('/api/users/create', methods=['POST'])
@check_token
def create_user():
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Apenas administradores podem criar utilizadores."}), 403
    try:
        data = request.get_json()
        email = data['email']
        password = data['password']
        display_name = data['displayName']
        role = data.get('role', 'vendedor')
        user = auth.create_user(email=email, password=password, display_name=display_name)
        auth.set_custom_user_claims(user.uid, {'role': role})
        return jsonify({"success": True, "message": f"Utilizador {email} criado com sucesso."}), 201
    except Exception as e:
        return jsonify({"error": f"Erro ao criar utilizador: {e}"}), 500

@app.route('/api/users', methods=['GET'])
@check_token
def get_users():
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        users_list = []
        for user in auth.list_users().iterate_all():
            users_list.append({
                'uid': user.uid, 'email': user.email, 'displayName': user.display_name,
                'role': user.custom_claims.get('role', 'vendedor') if user.custom_claims else 'vendedor'
            })
        return jsonify(users_list), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar utilizadores: {e}"}), 500

# ===================================================================
# ROTAS DA API - MÓDULO DE EVENTOS
# ===================================================================
@app.route('/api/events/create', methods=['POST'])
@check_token
def create_event():
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        data = request.get_json()
        required_fields = ['eventName', 'eventLocation', 'eventDate', 'eventTime', 'ticketTypes']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Dados do evento incompletos."}), 400
        
        event_id = ''.join(filter(str.isalnum, data['eventName'])).upper() + '_' + generate_short_id(4)
        event_data = {
            'eventId': event_id,
            'eventName': data['eventName'],
            'eventLocation': data['eventLocation'],
            'eventDate': data['eventDate'],
            'eventTime': data['eventTime'],
            'organizerName': data.get('organizerName'),
            'supportContact': data.get('supportContact'),
            'eventDetails': data.get('eventDetails', ''),
            'ticketTypes': data['ticketTypes'],
            'combos': data.get('combos', []),
            'createdAt': firestore.SERVER_TIMESTAMP
        }
        db.collection('events').document(event_id).set(event_data)
        return jsonify({"success": True, "message": "Evento criado com sucesso!", "eventId": event_id}), 201
    except Exception as e:
        return jsonify({"error": f"Erro ao criar evento: {e}"}), 500

@app.route('/api/events', methods=['GET'])
@check_token
def get_events():
    try:
        events_ref = db.collection('events').order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
        events_list = [event.to_dict() for event in events_ref]
        return jsonify(events_list), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar eventos: {e}"}), 500

@app.route('/api/events/<event_id>', methods=['GET'])
@check_token
def get_single_event(event_id):
    try:
        doc = db.collection('events').document(event_id).get()
        if doc.exists:
            return jsonify(doc.to_dict()), 200
        else:
            return jsonify({"error": "Evento não encontrado."}), 404
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar evento: {e}"}), 500

@app.route('/api/events/update/<event_id>', methods=['PUT'])
@check_token
def update_event(event_id):
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        data = request.get_json()
        required_fields = ['eventName', 'eventLocation', 'eventDate', 'eventTime', 'ticketTypes']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Dados do evento incompletos para atualização."}), 400
        
        update_data = {
            'eventName': data['eventName'],
            'eventLocation': data['eventLocation'],
            'eventDate': data['eventDate'],
            'eventTime': data['eventTime'],
            'organizerName': data.get('organizerName'),
            'supportContact': data.get('supportContact'),
            'eventDetails': data.get('eventDetails', ''),
            'ticketTypes': data['ticketTypes'],
            'combos': data.get('combos', [])
        }
        db.collection('events').document(event_id).update(update_data)
        return jsonify({"success": True, "message": "Evento atualizado com sucesso."}), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao atualizar evento: {e}"}), 500

@app.route('/api/event/ticket/create', methods=['POST'])
@check_token
def create_ticket():
    try:
        data = request.get_json()
        required_fields = ['eventId', 'eventName', 'buyerName', 'ticketType', 'pricePaid', 'paymentMethod']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Dados incompletos."}), 400
        
        doc_ref = db.collection('eventTickets').document()
        ticket_id = doc_ref.id
        
        control_number = data.get('controlNumber', '')

        ticket_data = {
            'ticketId': ticket_id,
            'eventId': data['eventId'],
            'eventName': data['eventName'],
            'buyerName': data['buyerName'],
            'buyerPhone': data.get('buyerPhone'),
            'ticketType': data['ticketType'],
            'pricePaid': data['pricePaid'],
            'paymentMethod': data['paymentMethod'],
            'soldBy': g.user.get('name', g.user.get('email')),
            'purchaseDate': firestore.SERVER_TIMESTAMP,
            'status': 'VALIDO',
            'checkInTimestamp': None,
            'scannedBy': None,
            'isDeleted': False,
            'controlNumber': control_number
        }
        doc_ref.set(ticket_data)
        
        pdf_url = request.host_url + f"api/event/ticket/{ticket_id}/pdf"
        return jsonify({ "success": True, "ticketId": ticket_id, "pdfUrl": pdf_url }), 201
    except Exception as e:
        return jsonify({"error": f"Erro interno no servidor: {e}"}), 500

@app.route('/api/event/ticket/delete/<ticket_id>', methods=['DELETE'])
@check_token
def delete_ticket(ticket_id):
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        db.collection('eventTickets').document(ticket_id).update({'status': 'EXCLUIDO', 'isDeleted': True})
        return jsonify({"success": True, "message": "Convite excluído com sucesso."}), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao excluir convite: {e}"}), 500

@app.route('/api/event/ticket/scan', methods=['POST'])
@check_token
def scan_ticket():
    try:
        data = request.get_json()
        ticket_id = data.get('ticketId')
        if not ticket_id:
            return jsonify({"error": "ID do convite em falta."}), 400
        ticket_ref = db.collection('eventTickets').document(ticket_id)
        ticket_doc = ticket_ref.get()
        if not ticket_doc.exists:
            return jsonify({"status": "error", "message": "Convite Inválido"}), 200
        ticket_data = ticket_doc.to_dict()
        if ticket_data.get('isDeleted'):
            return jsonify({"status": "error", "message": "Convite Excluído"}), 200
        if ticket_data.get('status') == 'CHECK_IN_REALIZADO':
            checkin_time = ticket_data.get('checkInTimestamp').strftime('%H:%M:%S') if ticket_data.get('checkInTimestamp') else ''
            scanned_by = ticket_data.get('scannedBy', 'Desconhecido')
            return jsonify({"status": "warning", "message": f"Convite Já Utilizado às {checkin_time} por {scanned_by}"}), 200
        ticket_ref.update({
            'status': 'CHECK_IN_REALIZADO', 'checkInTimestamp': firestore.SERVER_TIMESTAMP,
            'scannedBy': g.user.get('name', g.user.get('email'))
        })
        return jsonify({"status": "success", "message": "Entrada Liberada", "buyerName": ticket_data.get('buyerName')}), 200
    except Exception as e:
        return jsonify({"error": f"Erro no sistema: {e}"}), 500

@app.route('/api/event/ticket/<ticket_id>/pdf')
def generate_ticket_pdf(ticket_id):
    try:
        ticket_doc = db.collection('eventTickets').document(ticket_id).get()
        if not ticket_doc.exists: return "Convite não encontrado", 404
        ticket_data = ticket_doc.to_dict()
        event_doc = db.collection('events').document(ticket_data['eventId']).get()
        event_data = event_doc.to_dict() if event_doc.exists else {}
        if event_data.get('eventDate'):
            date_obj = datetime.strptime(event_data['eventDate'], '%Y-%m-%d')
            event_data['eventDateFormatted'] = date_obj.strftime('%d/%m/%Y')
        qr = qrcode.QRCode(version=1, box_size=4, border=2)
        qr.add_data(ticket_id)
        qr.make(fit=True)
        img = qr.make_image(fill='black', back_color='white')
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        qr_code_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        html_out = render_template('ticket.html', ticket=ticket_data, event=event_data, qr_code_b64=qr_code_b64)
        pdf = HTML(string=html_out).write_pdf()
        return Response(pdf, mimetype='application/pdf', headers={'Content-Disposition': f'attachment; filename=convite_{ticket_id}.pdf'})
    except Exception as e:
        print(f"Erro ao gerar PDF: {e}")
        return "Erro ao gerar PDF", 500

@app.route('/api/events/<event_id>/tickets', methods=['GET'])
@check_token
def get_event_tickets(event_id):
    try:
        tickets_ref = db.collection('eventTickets').where('eventId', '==', event_id).stream()
        tickets_list = [t.to_dict() for t in tickets_ref]
        tickets_list.sort(key=lambda x: x.get('purchaseDate'), reverse=True)
        return jsonify(tickets_list), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar convites do evento: {e}"}), 500

@app.route('/api/events/<event_id>/tickets/export')
@check_token
def export_event_tickets_csv(event_id):
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        event_doc = db.collection('events').document(event_id).get()
        event_name = event_doc.to_dict().get('eventName', 'evento') if event_doc.exists else 'evento'
        filename = f"relatorio_vendas_{event_name.replace(' ', '_')}.csv"
        tickets_ref = db.collection('eventTickets').where('eventId', '==', event_id).stream()
        def generate_csv():
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Data Venda', 'Comprador', 'Telefone', 'Tipo Convite', 'Preco', 'Metodo Pagamento', 'Vendido Por', 'Estado', 'Data CheckIn', 'Validado Por'])
            tickets_list = sorted([t.to_dict() for t in tickets_ref], key=lambda x: x.get('purchaseDate'), reverse=False)
            for ticket_data in tickets_list:
                purchase_date = ticket_data.get('purchaseDate').strftime('%d/%m/%Y %H:%M:%S') if ticket_data.get('purchaseDate') else ''
                checkin_date = ticket_data.get('checkInTimestamp').strftime('%d/%m/%Y %H:%M:%S') if ticket_data.get('checkInTimestamp') else ''
                writer.writerow([
                    purchase_date, ticket_data.get('buyerName', ''), ticket_data.get('buyerPhone', ''),
                    ticket_data.get('ticketType', ''), str(ticket_data.get('pricePaid', 0)).replace('.',','), 
                    ticket_data.get('paymentMethod', ''), ticket_data.get('soldBy', ''), 
                    ticket_data.get('status', ''), checkin_date, ticket_data.get('scannedBy', '')
                ])
            output.seek(0)
            return output.getvalue()
        csv_data = generate_csv().encode('utf-8-sig')
        return Response(csv_data, mimetype='text/csv', headers={"Content-Disposition": f"attachment; filename={filename}"})
    except Exception as e:
        print(f"Erro ao gerar CSV: {e}")
        return f"Erro ao gerar CSV: {e}", 500

# ===================================================================
# ROTAS DA API - MÓDULO DE MARKETING
# ===================================================================
@app.route('/api/marketing/qr/create', methods=['POST'])
@check_token
def create_marketing_qr():
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        data = request.get_json()
        qr_type = data.get('type')
        if not qr_type: return jsonify({"error": "O tipo de QR Code é obrigatório."}), 400
        short_id = generate_short_id()
        qr_data = {
            'shortId': short_id, 'title': data.get('title', 'Página de Links'),
            'createdAt': firestore.SERVER_TIMESTAMP, 'scanCount': 0, 'type': qr_type,
            'leadCapture': data.get('leadCapture', {'enabled': False})
        }
        if qr_type == 'redirect':
            if 'destinationUrl' not in data or not data['destinationUrl']: return jsonify({"error": "URL de destino é obrigatória para o tipo 'redirect'."}), 400
            qr_data['destinationUrl'] = data['destinationUrl']
        elif qr_type == 'linkpage':
            if 'links' not in data or not isinstance(data['links'], list) or len(data['links']) == 0: return jsonify({"error": "Uma lista com pelo menos um link é obrigatória para o tipo 'linkpage'."}), 400
            qr_data['links'] = data['links']
        else: return jsonify({"error": "Tipo de QR Code inválido."}), 400
        db.collection('marketingQRs').document(short_id).set(qr_data)
        base_url = request.host_url + 'r/' + short_id
        return jsonify({ "success": True, "message": "QR Code criado com sucesso!", "shortId": short_id, "qrCodeUrl": base_url }), 201
    except Exception as e:
        return jsonify({"error": f"Erro interno no servidor: {e}"}), 500

@app.route('/api/leads/register', methods=['POST'])
def register_lead():
    try:
        data = request.get_json()
        required_fields = ['name', 'email', 'sourceQrId']
        if not all(field in data for field in required_fields): return jsonify({"error": "Dados incompletos."}), 400
        lead_data = {
            'name': data['name'], 'email': data['email'], 'phone': data.get('phone'),
            'city': data.get('city'), 'sourceQrId': data['sourceQrId'],
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        db.collection('leads').add(lead_data)
        return jsonify({"success": True, "message": "Cadastro realizado com sucesso!"}), 201
    except Exception as e:
        return jsonify({"error": f"Erro ao registrar lead: {e}"}), 500

@app.route('/api/leads', methods=['GET'])
@check_token
def get_leads():
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        leads_ref = db.collection('leads').order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
        leads_list = [lead.to_dict() for lead in leads_ref]
        return jsonify(leads_list), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar leads: {e}"}), 500

@app.route('/api/marketing/qrs', methods=['GET'])
@check_token
def get_marketing_qrs():
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        qrs_ref = db.collection('marketingQRs').order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
        qrs_list = [qr.to_dict() for qr in qrs_ref]
        return jsonify(qrs_list), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar QR Codes: {e}"}), 500

@app.route('/api/marketing/qr/<short_id>', methods=['GET'])
@check_token
def get_single_marketing_qr(short_id):
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        doc = db.collection('marketingQRs').document(short_id).get()
        if doc.exists:
            return jsonify(doc.to_dict()), 200
        else:
            return jsonify({"error": "QR Code não encontrado."}), 404
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar QR Code: {e}"}), 500

@app.route('/api/marketing/qr/update/<short_id>', methods=['PUT'])
@check_token
def update_marketing_qr(short_id):
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        data = request.get_json()
        if not data or 'title' not in data or 'destinationUrl' not in data: return jsonify({"error": "Dados incompletos."}), 400
        db.collection('marketingQRs').document(short_id).update({
            'title': data['title'], 'destinationUrl': data['destinationUrl']
        })
        return jsonify({"success": True, "message": "QR Code atualizado com sucesso."}), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao atualizar QR Code: {e}"}), 500

@app.route('/api/marketing/qr/delete/<short_id>', methods=['DELETE'])
@check_token
def delete_marketing_qr(short_id):
    if g.user.get('role') != 'admin':
        return jsonify({"error": "Acesso não autorizado."}), 403
    try:
        db.collection('marketingQRs').document(short_id).delete()
        return jsonify({"success": True, "message": f"QR Code {short_id} excluído com sucesso."}), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao excluir QR Code: {e}"}), 500

@app.route('/r/<short_id>')
def redirect_and_track(short_id):
    try:
        doc_ref = db.collection('marketingQRs').document(short_id)
        doc = doc_ref.get()
        if not doc.exists: return "URL não encontrada.", 404
        doc_ref.update({'scanCount': firestore.Increment(1)})
        qr_data = doc.to_dict()
        if qr_data.get('type') == 'linkpage':
            lead_capture_config = qr_data.get('leadCapture', {'enabled': False})
            return render_template('linkpage.html', qr_data=qr_data, lead_capture=lead_capture_config)
        else:
            destination_url = qr_data.get('destinationUrl')
            if not destination_url.startswith(('http://', 'https://')):
                destination_url = 'http://' + destination_url
            return redirect(destination_url, code=302)
    except Exception as e:
        return f"Ocorreu um erro: {e}", 500

# ===================================================================
# ROTAS PARA SERVIR O FRONTEND
# ===================================================================
@app.route('/')
def root():
    return send_from_directory('admin_frontend', 'landing.html')
@app.route('/login')
def login_page():
    return send_from_directory('static', 'login.html')
@app.route('/validator')
def validator_app():
    return send_from_directory('static', 'index.html')
@app.route('/admin')
def admin_app():
    return redirect('/login')
@app.route('/admin/users')
def admin_users_app():
    return send_from_directory('admin_frontend', 'users.html')
@app.route('/admin/dashboard')
def admin_dashboard_app():
    return send_from_directory('admin_frontend', 'dashboard.html')
@app.route('/admin/leads')
def admin_leads_app():
    return send_from_directory('admin_frontend', 'leads.html')
@app.route('/admin/marketing/create')
def admin_marketing_create_app():
    return send_from_directory('admin_frontend', 'marketing.html')
@app.route('/admin/events')
def admin_events_dashboard_app():
    return send_from_directory('admin_frontend', 'events_dashboard.html')
@app.route('/admin/events/create')
def admin_events_create_app():
    return send_from_directory('admin_frontend', 'events_create.html')
@app.route('/admin/events/report/<event_id>')
def admin_event_report_app(event_id):
    return send_from_directory('admin_frontend', 'event_report.html')
@app.route('/admin/tickets')
def admin_tickets_app():
    return send_from_directory('admin_frontend', 'index.html')
@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# ===================================================================
# PONTO DE PARTIDA DO SERVIDOR
# ===================================================================
if __name__ == '__main__':
    # Em produção, o Gunicorn irá gerir a aplicação.
    # O bloco abaixo é principalmente para desenvolvimento local.
    if 'RENDER' in os.environ:
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)