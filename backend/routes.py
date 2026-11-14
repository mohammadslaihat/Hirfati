"""مسارات الموقع: صفحات الواجهة الأمامية (محمية حسب نوع الحساب) وواجهة API بصيغة JSON."""
import re
from datetime import date, datetime
from functools import wraps

from flask import Blueprint, jsonify, redirect, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

import models
import payment
from config import FRONTEND_DIR, GOVERNORATES

bp = Blueprint('main', __name__)

PHONE_RE = re.compile(r'^\+9627[789]\d{7}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
ROLE_HOME = {
    'customer': '/customer/home.html',
    'craftsman': '/craftsman/profile.html',
    'admin': '/admin/requests.html',
}
ROLE_FOLDERS = ('customer', 'craftsman', 'admin')
COMPLAINT_STATUSES = ('new', 'processing', 'resolved')


# =========================================================
# دوال مساعدة
# =========================================================

def error(message, code=400):
    return jsonify({'error': message}), code


def get_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def get_text(data, key, max_len=255):
    value = data.get(key)
    return value.strip()[:max_len] if isinstance(value, str) else ''


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def current_user_id():
    return session['user_id']


def api_login_required(*roles):
    """حماية مسارات API: تسجيل الدخول مطلوب، ونوع الحساب يجب أن يكون ضمن roles."""
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            if 'user_id' not in session:
                return error('يجب تسجيل الدخول أولاً.', 401)
            if roles and session.get('role') not in roles:
                return error('ليس لديك صلاحية للوصول إلى هذه البيانات.', 403)
            return view(*args, **kwargs)
        return wrapper
    return decorator


def validate_basic_fields(data):
    """التحقق من الاسم والهاتف. يعيد رسالة خطأ أو نصاً فارغاً."""
    if len(get_text(data, 'name', 100)) < 3:
        return 'يرجى إدخال الاسم الكامل.'
    if not PHONE_RE.match(get_text(data, 'phone', 20)):
        return 'رقم الهاتف يجب أن يكون أردنياً بالصيغة +9627XXXXXXXX.'
    return ''


def resolve_profession(data):
    """المهنة: رقم مهنة أساسية، أو 'other' مع كتابة اسم الخدمة. يعيد (رقم الخدمة، رسالة خطأ)."""
    profession = data.get('profession')
    if profession == 'other':
        name = ' '.join(get_text(data, 'other_service', 100).split())
        if len(name) < 2:
            return None, 'يرجى كتابة اسم الخدمة التي تقدمها.'
        return models.get_or_create_other_service(name), ''
    service = models.get_service(to_int(profession))
    if not service or service['category'] != 'main':
        return None, 'يرجى اختيار المهنة.'
    return service['id'], ''


def validate_experience(data):
    experience = to_int(data.get('experience'))
    if experience is None or not 0 <= experience <= 60:
        return None, 'يرجى إدخال سنوات الخبرة بشكل صحيح.'
    return experience, ''


# =========================================================
# صفحات الواجهة الأمامية
# =========================================================

@bp.route('/')
def index_page():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@bp.route('/admin')
@bp.route('/admin/dashboard')
def admin_dashboard():
    return redirect('/admin/requests.html')


@bp.route('/<path:filename>')
def frontend_file(filename):
    """صفحات customer/ و craftsman/ و admin/ لا تُرسل إلا لصاحب نوع الحساب المناسب."""
    folder = filename.split('/', 1)[0]
    if folder in ROLE_FOLDERS and session.get('role') != folder:
        return redirect('/login.html')
    response = send_from_directory(FRONTEND_DIR, filename)
    if filename.endswith('.html'):
        response.headers['Cache-Control'] = 'no-store'
    return response


# =========================================================
# الحسابات وتسجيل الدخول
# =========================================================

@bp.post('/api/register')
def register():
    data = get_body()
    role = data.get('role')
    if role not in ('customer', 'craftsman'):
        return error('نوع الحساب غير صحيح.')

    message = validate_basic_fields(data)
    name, phone = get_text(data, 'name', 100), get_text(data, 'phone', 20)
    email = get_text(data, 'email', 150).lower()
    password = data.get('password') if isinstance(data.get('password'), str) else ''
    governorate = get_text(data, 'governorate', 20)

    if not message and not EMAIL_RE.match(email):
        message = 'يرجى إدخال بريد إلكتروني صحيح.'
    if not message and governorate not in GOVERNORATES:
        message = 'يرجى اختيار المحافظة.'
    if not message and len(password) < 6:
        message = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'
    if not message and models.email_exists(email):
        message = 'هذا البريد الإلكتروني مسجل مسبقاً.'
    if message:
        return error(message)

    password_hash = generate_password_hash(password)

    if role == 'customer':
        user_id = models.create_customer(name, email, phone, password_hash, governorate)
        redirect_to = ROLE_HOME['customer']
    else:
        experience, message = validate_experience(data)
        if message:
            return error(message)
        profession_id, message = resolve_profession(data)
        if message:
            return error(message)
        user_id = models.create_craftsman(name, email, phone, password_hash, governorate,
                                          profession_id, experience)
        redirect_to = '/craftsman/subscription.html'  # الخطوة التالية: اختيار نوع الاشتراك

    session.clear()
    session['user_id'] = user_id
    session['role'] = role
    return jsonify({'redirect': redirect_to}), 201


@bp.post('/api/login')
def login():
    data = get_body()
    user = models.get_user_by_email(get_text(data, 'email', 150).lower())
    password = data.get('password') if isinstance(data.get('password'), str) else ''
    if not user or not check_password_hash(user['password'], password):
        return error('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
    session.clear()
    session['user_id'] = user['id']
    session['role'] = user['role']
    return jsonify({'redirect': ROLE_HOME[user['role']]})


@bp.post('/api/logout')
def logout():
    session.clear()
    return jsonify({'ok': True})


@bp.get('/api/me')
@api_login_required()
def me():
    user = models.get_user(current_user_id())
    if not user:
        session.clear()
        return error('يجب تسجيل الدخول أولاً.', 401)
    return jsonify(user)


# =========================================================
# الخدمات والحرفيون (العميل)
# =========================================================

@bp.get('/api/services')
def services():
    """متاح بدون تسجيل دخول لأن صفحة إنشاء الحساب تحتاج قائمة المهن."""
    return jsonify({'main': models.main_services(), 'other': models.other_services_with_craftsmen()})


@bp.get('/api/craftsmen')
@api_login_required('customer')
def craftsmen():
    service = request.args.get('service') or None
    if service and service != 'other':
        service = to_int(service)
        if service is None:
            return jsonify([])
    governorate = request.args.get('gov') or None
    if governorate and governorate not in GOVERNORATES:
        governorate = None
    featured = request.args.get('featured') == '1'
    return jsonify(models.list_craftsmen(service, governorate, featured))


@bp.get('/api/craftsmen/<int:craftsman_id>')
@api_login_required('customer')
def craftsman_details(craftsman_id):
    craftsman = models.get_craftsman(craftsman_id)
    if not craftsman:
        return error('لم يتم العثور على الحرفي.', 404)
    return jsonify(craftsman)


# =========================================================
# طلبات العميل
# =========================================================

@bp.post('/api/requests')
@api_login_required('customer')
def create_request():
    data = get_body()
    craftsman = models.get_craftsman(to_int(data.get('craftsman_id')) or 0)
    if not craftsman:
        return error('لم يتم العثور على الحرفي.', 404)
    description = get_text(data, 'description', 2000)
    governorate = get_text(data, 'governorate', 20)
    address = get_text(data, 'address', 100)
    if len(description) < 10:
        return error('يرجى كتابة وصف واضح للمشكلة أو الخدمة (10 أحرف على الأقل).')
    if governorate not in GOVERNORATES:
        return error('يرجى اختيار المحافظة.')
    if not address:
        return error('يرجى كتابة المنطقة أو الحي.')
    location = f'{GOVERNORATES[governorate]} - {address}'
    request_id = models.create_request(current_user_id(), craftsman, description, location)
    return jsonify({'id': request_id}), 201


@bp.get('/api/customer/requests')
@api_login_required('customer')
def customer_requests():
    return jsonify(models.list_requests(customer_id=current_user_id()))


@bp.post('/api/customer/requests/<int:request_id>/accept-offer')
@api_login_required('customer')
def accept_offer(request_id):
    if not models.respond_to_offer(request_id, current_user_id(), accept=True):
        return error('لا يمكن تنفيذ هذا الإجراء على هذا الطلب.')
    return jsonify({'ok': True})


@bp.post('/api/customer/requests/<int:request_id>/reject-offer')
@api_login_required('customer')
def reject_offer(request_id):
    if not models.respond_to_offer(request_id, current_user_id(), accept=False):
        return error('لا يمكن تنفيذ هذا الإجراء على هذا الطلب.')
    return jsonify({'ok': True})


@bp.post('/api/customer/requests/<int:request_id>/review')
@api_login_required('customer')
def review_request(request_id):
    data = get_body()
    rating = to_int(data.get('rating'))
    if rating is None or not 1 <= rating <= 5:
        return error('يرجى اختيار عدد النجوم.')
    if not models.add_review(request_id, current_user_id(), rating, get_text(data, 'comment', 500)):
        return error('لا يمكن تقييم هذا الطلب.')
    return jsonify({'ok': True}), 201


# =========================================================
# الحرفي: الملف الشخصي والطلبات
# =========================================================

def craftsman_profile_data(user_id):
    profile = models.get_craftsman(user_id)
    profile['subscription'] = models.current_subscription(user_id)
    return profile


@bp.get('/api/craftsman/profile')
@api_login_required('craftsman')
def get_craftsman_profile():
    return jsonify(craftsman_profile_data(current_user_id()))


@bp.put('/api/craftsman/profile')
@api_login_required('craftsman')
def update_craftsman_profile():
    data = get_body()
    user_id = current_user_id()

    message = validate_basic_fields(data)
    if message:
        return error(message)
    experience, message = validate_experience(data)
    if message:
        return error(message)
    governorate = get_text(data, 'governorate', 20)
    if governorate not in GOVERNORATES:
        return error('يرجى اختيار المحافظة.')
    work_areas = data.get('work_areas') if isinstance(data.get('work_areas'), list) else []
    work_areas = [g for g in GOVERNORATES if g in work_areas]
    if not work_areas:
        return error('يرجى اختيار منطقة عمل واحدة على الأقل.')

    main_ids = data.get('main_services') if isinstance(data.get('main_services'), list) else []
    other_names = data.get('other_services') if isinstance(data.get('other_services'), list) else []
    other_names = [' '.join(n.split())[:100] for n in other_names if isinstance(n, str) and n.strip()][:10]
    if any(len(n) < 2 for n in other_names):
        return error('اسم الخدمة الإضافية يجب أن يكون حرفين على الأقل.')

    profession_id, message = resolve_profession(data)
    if message:
        return error(message)

    service_ids = [profession_id]
    for sid in main_ids:
        service = models.get_service(to_int(sid))
        if service and service['category'] == 'main' and service['id'] not in service_ids:
            service_ids.append(service['id'])
    for name in other_names:
        sid = models.get_or_create_other_service(name)
        if sid not in service_ids:
            service_ids.append(sid)

    models.update_craftsman_profile(user_id, {
        'name': get_text(data, 'name', 100), 'phone': get_text(data, 'phone', 20),
        'profession_id': profession_id, 'experience': experience, 'governorate': governorate,
        'work_areas': work_areas, 'bio': get_text(data, 'bio', 1000), 'service_ids': service_ids,
    })
    return jsonify(craftsman_profile_data(user_id))


# =========================================================
# الحرفي: اشتراك Pro (نظام دفع تجريبي داخل المشروع)
# =========================================================

def subscription_status(user_id):
    models.refresh_expired_subscriptions()
    return {
        'subscription': models.current_subscription(user_id),
        'had_pro': models.has_had_pro(user_id),
        'price_usd': payment.PRO_PRICE_USD,
    }


@bp.get('/api/craftsman/subscription')
@api_login_required('craftsman')
def get_subscription():
    return jsonify(subscription_status(current_user_id()))


@bp.post('/api/craftsman/subscription/pay')
@api_login_required('craftsman')
def subscription_pay():
    """الدفع التجريبي: التحقق من بيانات البطاقة ثم تفعيل Pro في قاعدة البيانات.
    بيانات البطاقة لا تُحفظ ولا تُسجَّل، ويُحفظ مع الاشتراك رقم عملية تجريبي فقط."""
    user_id = current_user_id()
    if models.current_subscription(user_id)['subscription_type'] == 'pro':
        return error('أنت مشترك في Pro بالفعل.')
    try:
        transaction_id = payment.charge_pro_subscription(get_body())
    except payment.PaymentError as e:
        return error(str(e))
    models.activate_pro(user_id, transaction_id)
    return jsonify({'message': 'Payment Successful! Your Pro Premium subscription is now active.',
                    **subscription_status(user_id)})


@bp.post('/api/craftsman/subscription/cancel')
@api_login_required('craftsman')
def subscription_cancel():
    """إلغاء Pro: تُسجَّل الدورة الحالية «ملغى» مع تاريخ الإلغاء، ويعود الحساب إلى Basic فوراً."""
    user_id = current_user_id()
    if not models.cancel_pro(user_id):
        return error('لا يوجد اشتراك Pro لإلغائه.')
    return jsonify(subscription_status(user_id))


@bp.get('/api/craftsman/requests')
@api_login_required('craftsman')
def craftsman_requests():
    return jsonify(models.list_requests(craftsman_id=current_user_id()))


@bp.post('/api/craftsman/requests/<int:request_id>/reject')
@api_login_required('craftsman')
def reject_request(request_id):
    reason = get_text(get_body(), 'reason', 255)
    if len(reason) < 3:
        return error('يرجى كتابة سبب الرفض.')
    if not models.reject_request(request_id, current_user_id(), reason):
        return error('لا يمكن رفض هذا الطلب.')
    return jsonify({'ok': True})


@bp.post('/api/craftsman/requests/<int:request_id>/offer')
@api_login_required('craftsman')
def send_offer(request_id):
    data = get_body()
    try:
        price = float(data.get('price'))
    except (TypeError, ValueError):
        price = 0
    execution_time = get_text(data, 'execution_time', 100)
    try:
        execution_date = datetime.strptime(get_text(data, 'execution_date', 10), '%Y-%m-%d').date()
    except ValueError:
        execution_date = None
    if not 0 < price <= 100000:
        return error('يرجى إدخال تكلفة الخدمة.')
    if not execution_time:
        return error('يرجى إدخال مدة تنفيذ الخدمة.')
    if not execution_date:
        return error('يرجى اختيار موعد التنفيذ.')
    if execution_date < date.today():
        return error('موعد التنفيذ يجب ألا يكون في الماضي.')
    if not models.send_offer(request_id, current_user_id(), price, execution_time, execution_date):
        return error('لا يمكن إرسال عرض سعر لهذا الطلب.')
    return jsonify({'ok': True}), 201


@bp.post('/api/craftsman/requests/<int:request_id>/complete')
@api_login_required('craftsman')
def complete_request(request_id):
    if not models.complete_request(request_id, current_user_id()):
        return error('لا يمكن تحديد هذا الطلب كمكتمل.')
    return jsonify({'ok': True})


# =========================================================
# الشكاوى (العميل والحرفي)
# =========================================================

@bp.post('/api/complaints')
@api_login_required('customer', 'craftsman')
def create_complaint():
    data = get_body()
    details = get_text(data, 'details', 2000)
    if len(details) < 10:
        return error('يرجى كتابة تفاصيل الشكوى (10 أحرف على الأقل).')
    request_id = to_int(data.get('request_id'))
    complaint_id = models.create_complaint(current_user_id(), request_id, details)
    if complaint_id is None:
        return error('الطلب المحدد غير صحيح.')
    return jsonify({'id': complaint_id}), 201


# =========================================================
# لوحة تحكم الأدمن
# =========================================================

@bp.get('/api/admin/requests')
@api_login_required('admin')
def admin_requests():
    return jsonify(models.list_requests())


@bp.get('/api/admin/complaints')
@api_login_required('admin')
def admin_complaints():
    return jsonify(models.list_complaints())


@bp.put('/api/admin/complaints/<int:complaint_id>')
@api_login_required('admin')
def admin_update_complaint(complaint_id):
    status = get_body().get('status')
    if status not in COMPLAINT_STATUSES:
        return error('حالة الشكوى غير صحيحة.')
    if not models.update_complaint_status(complaint_id, status):
        return error('لم يتم العثور على الشكوى.', 404)
    return jsonify({'ok': True})


@bp.get('/api/admin/users')
@api_login_required('admin')
def admin_users():
    if request.args.get('role') == 'craftsman':
        return jsonify(models.list_all_craftsmen_for_admin())
    return jsonify(models.list_customers())


@bp.get('/api/admin/users/<int:user_id>')
@api_login_required('admin')
def admin_user_details(user_id):
    user = models.get_user(user_id)
    if not user:
        return error('لم يتم العثور على المستخدم.', 404)
    if user['role'] == 'craftsman':
        user.update(models.get_craftsman(user_id))
    return jsonify(user)


@bp.get('/api/admin/subscriptions')
@api_login_required('admin')
def admin_subscriptions():
    return jsonify(models.subscriptions_overview())


@bp.get('/api/admin/subscriptions/<int:craftsman_id>')
@api_login_required('admin')
def admin_subscription_history(craftsman_id):
    history = models.subscription_history(craftsman_id)
    if not history:
        return error('لم يتم العثور على الحرفي.', 404)
    return jsonify(history)
