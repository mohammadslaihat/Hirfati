# ملف المسارات
# كل مسار هو رابط ونوع طلب ودالة تعمل عند وصول هذا الطلب
# طلب القراءة لجلب البيانات وطلب الإرسال للإنشاء وطلب التعديل لتحديث البيانات
# النوع الأول مسارات صفحات الموقع مع منع فتح صفحات نوع حساب آخر
# النوع الثاني مسارات واجهة البيانات التي تستقبل وترسل بيانات بصيغة جيسون
# وتستدعيها ملفات السكربت في المتصفح
import re
from datetime import date, datetime
# أداة تحافظ على اسم الدالة الأصلية عند تغليفها بدالة حماية
from functools import wraps

# نستورد من فلاسك أدوات بناء المسارات وإرسال الردود والتحويل بين الصفحات
# وقراءة الطلب الوارد وإرسال الملفات والجلسة
# الجلسة تحفظ في المتصفح موقعة بالمفتاح السري
# ونخزن فيها رقم المستخدم ونوع حسابه بعد تسجيل الدخول
from flask import Blueprint, jsonify, redirect, request, send_from_directory, session
# الدالة الأولى تقارن كلمة المرور المدخلة مع النسخة المشفرة دون فك التشفير
# الدالة الثانية تشفر كلمة المرور قبل حفظها باتجاه واحد مع قيمة عشوائية
from werkzeug.security import check_password_hash, generate_password_hash

import models
import payment
from config import FRONTEND_DIR, GOVERNORATES

# إنشاء مجموعة المسارات التي يسجلها التطبيق الرئيسي
# كل مسار في هذا الملف يضاف إلى هذه المجموعة
bp = Blueprint('main', __name__)

# نمط رقم الهاتف الأردني
# يبدأ برمز الأردن 962 ثم الرقم 7 ثم 7 أو 8 أو 9 ثم سبعة أرقام
PHONE_RE = re.compile(r'^\+9627[789]\d{7}$')
# نمط بسيط للبريد الإلكتروني يتحقق من وجود اسم ثم علامة البريد ثم نطاق فيه نقطة
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
# الصفحة الرئيسية لكل نوع حساب ويرسل إليها المستخدم بعد تسجيل الدخول
ROLE_HOME = {
    'customer': '/customer/home.html',
    'craftsman': '/craftsman/profile.html',
    'admin': '/admin/requests.html',
}
# المجلدات المحمية في الواجهة الأمامية
# صفحات كل مجلد لا تفتح إلا لنوع الحساب الذي يحمل نفس الاسم
ROLE_FOLDERS = ('customer', 'craftsman', 'admin')
# حالات الشكوى المسموحة وهي جديدة وقيد المعالجة وتمت المعالجة
COMPLAINT_STATUSES = ('new', 'processing', 'resolved')


# قسم الدوال المساعدة
# ترجع رد خطأ بصيغة جيسون يحتوي رسالة عربية مع رمز الحالة
# رمز الحالة الافتراضي 400 ويعني أن الطلب غير صحيح
# السكربت في الواجهة يقرأ الرسالة ويعرضها للمستخدم
def error(message, code=400):
    return jsonify({'error': message}), code


# تقرأ البيانات المرسلة مع الطلب بصيغة جيسون
# لا ترفع خطأ إذا كانت البيانات غير صحيحة
# وتعيد قاموساً فارغاً إذا لم تكن البيانات قاموساً حتى نقرأ منها بأمان
def get_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


# تقرأ حقلاً نصياً بأمان
# إذا كان نصاً تحذف المسافات من طرفيه وتقصه إلى الطول الأقصى
# وإذا لم يكن نصاً تعيد نصاً فارغاً
def get_text(data, key, max_len=255):
    value = data.get(key)
    return value.strip()[:max_len] if isinstance(value, str) else ''


# تحول القيمة إلى عدد صحيح
# إذا فشل التحويل تعيد لا شيء بدلاً من إيقاف البرنامج بخطأ
def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# تعيد رقم المستخدم المسجل دخوله من الجلسة
def current_user_id():
    return session['user_id']


# دالة حماية توضع فوق دوال المسارات
# تتحقق أن المستخدم سجل دخوله وأن نوع حسابه من الأنواع المسموحة
# إذا لم تحدد أنواع يكفي أن يكون المستخدم مسجلاً دخوله
# البنية ثلاث دوال متداخلة
# الأولى تستقبل الأنواع المسموحة والثانية تستقبل دالة المسار
# والثالثة تعمل عند كل طلب فتفحص الجلسة ثم تستدعي دالة المسار إذا كان مسموحاً
def api_login_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            # المستخدم لم يسجل دخوله فنرجع الرمز 401
            if 'user_id' not in session:
                return error('يجب تسجيل الدخول أولاً.', 401)
            # المستخدم مسجل لكن نوع حسابه غير مسموح فنرجع الرمز 403
            # مثال ذلك عميل يحاول فتح بيانات الأدمن
            if roles and session.get('role') not in roles:
                return error('ليس لديك صلاحية للوصول إلى هذه البيانات.', 403)
            return view(*args, **kwargs)
        return wrapper
    return decorator


# تتحقق من الاسم ورقم الهاتف
# الاسم ثلاثة أحرف على الأقل والهاتف أردني
# تعيد رسالة الخطأ الأولى أو نصاً فارغاً إذا كانت البيانات صحيحة
def validate_basic_fields(data):
    if len(get_text(data, 'name', 100)) < 3:
        return 'يرجى إدخال الاسم الكامل.'
    if not PHONE_RE.match(get_text(data, 'phone', 20)):
        return 'رقم الهاتف يجب أن يكون أردنياً بالصيغة +9627XXXXXXXX.'
    return ''


# تحدد مهنة الحرفي وتعيد رقم الخدمة مع رسالة خطأ أو نص فارغ
# إذا اختار خدمات أخرى نأخذ الاسم الذي كتبه وننشئ الخدمة إن لم تكن موجودة
# وإلا يجب أن يكون الرقم لخدمة أساسية موجودة
def resolve_profession(data):
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


# سنوات الخبرة يجب أن تكون عدداً صحيحاً بين 0 و 60
# تعيد القيمة مع رسالة الخطأ أو نص فارغ
def validate_experience(data):
    experience = to_int(data.get('experience'))
    if experience is None or not 0 <= experience <= 60:
        return None, 'يرجى إدخال سنوات الخبرة بشكل صحيح.'
    return experience, ''


# قسم صفحات الواجهة الأمامية
# الصفحة الرئيسية للموقع ترسل صفحة البداية
@bp.route('/')
def index_page():
    return send_from_directory(FRONTEND_DIR, 'index.html')


# روابط مختصرة للوحة الأدمن تحول إلى صفحة إدارة الطلبات
@bp.route('/admin')
@bp.route('/admin/dashboard')
def admin_dashboard():
    return redirect('/admin/requests.html')


# مسار عام لكل ملفات الواجهة الأمامية من صفحات وتنسيق وسكربتات
# يلتقط المسار كاملاً مع المجلدات
@bp.route('/<path:filename>')
def frontend_file(filename):
    # أول جزء من المسار هو اسم المجلد
    # إذا كان مجلداً محمياً ونوع حساب المستخدم مختلف نحوله إلى صفحة تسجيل الدخول
    # هذه حماية على مستوى الخادم فلا يمكن فتح صفحات الأدمن بكتابة الرابط مباشرة
    folder = filename.split('/', 1)[0]
    if folder in ROLE_FOLDERS and session.get('role') != folder:
        return redirect('/login.html')
    # ترسل الدالة الملف وتمنع الخروج من مجلد الواجهة الأمامية
    # ونمنع المتصفح من حفظ نسخة مؤقتة من الصفحات حتى لا تظهر صفحة قديمة بعد تسجيل الخروج
    response = send_from_directory(FRONTEND_DIR, filename)
    if filename.endswith('.html'):
        response.headers['Cache-Control'] = 'no-store'
    return response


# قسم الحسابات وتسجيل الدخول
# مسار إنشاء حساب جديد لعميل أو حرفي
# يستقبل البيانات من نموذج إنشاء الحساب
@bp.post('/api/register')
def register():
    data = get_body()
    role = data.get('role')
    if role not in ('customer', 'craftsman'):
        return error('نوع الحساب غير صحيح.')

    # سلسلة تحقق يفحص فيها كل شرط فقط إذا لم يظهر خطأ قبله
    # حتى نعرض للمستخدم أول خطأ فقط
    # البريد يتحول إلى أحرف صغيرة حتى لا يتكرر الحساب بسبب حالة الأحرف
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

    # تشفير كلمة المرور فقاعدة البيانات تحفظ النسخة المشفرة فقط
    password_hash = generate_password_hash(password)

    # العميل ينشأ حسابه مباشرة
    # الحرفي نتحقق من خبرته ومهنته أولاً ثم ننشئ حسابه
    # ثم نرسله إلى صفحة اختيار نوع الاشتراك
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
        redirect_to = '/craftsman/subscription.html'

    # تسجيل الدخول تلقائياً بعد إنشاء الحساب
    # نمسح أي جلسة قديمة ثم نحفظ رقم المستخدم ونوع حسابه
    # ونرجع الرمز 201 ومعناه تم الإنشاء مع الصفحة التالية
    session.clear()
    session['user_id'] = user_id
    session['role'] = role
    return jsonify({'redirect': redirect_to}), 201


# مسار تسجيل الدخول
# نبحث عن المستخدم بالبريد ثم نقارن كلمة المرور مع النسخة المشفرة
# نعرض نفس الرسالة إذا كان البريد أو كلمة المرور خطأ حتى لا نكشف البريدات المسجلة
# عند النجاح نحفظ رقم المستخدم ونوع حسابه في الجلسة
# ونرجع الصفحة الرئيسية الخاصة بنوع حسابه
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


# مسار تسجيل الخروج ويمسح الجلسة بالكامل
@bp.post('/api/logout')
def logout():
    session.clear()
    return jsonify({'ok': True})


# مسار بيانات المستخدم الحالي
# تستخدمه الواجهة لعرض الاسم في الشريط العلوي ومعرفة نوع الحساب
# إذا حذف المستخدم من قاعدة البيانات نمسح جلسته ونرجع الرمز 401
@bp.get('/api/me')
@api_login_required()
def me():
    user = models.get_user(current_user_id())
    if not user:
        session.clear()
        return error('يجب تسجيل الدخول أولاً.', 401)
    return jsonify(user)


# قسم الخدمات والحرفيين للعميل
# مسار قائمة الخدمات الأساسية والخدمات الأخرى
# متاح دون تسجيل دخول لأن صفحة إنشاء الحساب تحتاج قائمة المهن
@bp.get('/api/services')
def services():
    return jsonify({'main': models.main_services(), 'other': models.other_services_with_craftsmen()})


# مسار قائمة الحرفيين للعميل مع الفلاتر القادمة في الرابط
# نتحقق من كل فلتر قبل استخدامه
# رقم الخدمة يجب أن يكون رقماً أو جميع الخدمات الأخرى
# والمحافظة يجب أن تكون من المحافظات الاثنتي عشرة وإلا نتجاهل الفلتر
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


# مسار ملف حرفي واحد ورقم الحرفي جزء من الرابط ويجب أن يكون رقماً
@bp.get('/api/craftsmen/<int:craftsman_id>')
@api_login_required('customer')
def craftsman_details(craftsman_id):
    craftsman = models.get_craftsman(craftsman_id)
    if not craftsman:
        return error('لم يتم العثور على الحرفي.', 404)
    return jsonify(craftsman)


# قسم طلبات العميل
# مسار إرسال طلب عرض سعر من العميل إلى حرفي
# نتحقق من وجود الحرفي وطول الوصف والمحافظة والمنطقة
# ثم نكون الموقع من اسم المحافظة والمنطقة وننشئ الطلب
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


# مسار طلبات العميل الحالي فقط
# رقم العميل يؤخذ من الجلسة فلا يستطيع رؤية طلبات غيره
@bp.get('/api/customer/requests')
@api_login_required('customer')
def customer_requests():
    return jsonify(models.list_requests(customer_id=current_user_id()))


# مسار قبول العميل لعرض السعر
# دالة الرد على العرض تتحقق أن الطلب له وأن فيه عرضاً ينتظر الرد
@bp.post('/api/customer/requests/<int:request_id>/accept-offer')
@api_login_required('customer')
def accept_offer(request_id):
    if not models.respond_to_offer(request_id, current_user_id(), accept=True):
        return error('لا يمكن تنفيذ هذا الإجراء على هذا الطلب.')
    return jsonify({'ok': True})


# مسار رفض العميل لعرض السعر
@bp.post('/api/customer/requests/<int:request_id>/reject-offer')
@api_login_required('customer')
def reject_offer(request_id):
    if not models.respond_to_offer(request_id, current_user_id(), accept=False):
        return error('لا يمكن تنفيذ هذا الإجراء على هذا الطلب.')
    return jsonify({'ok': True})


# مسار تقييم الحرفي بعد اكتمال الطلب
# عدد النجوم من 1 إلى 5 والتعليق اختياري بحد أقصى 500 حرف
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


# قسم ملف الحرفي وطلباته
# تعيد بيانات ملف الحرفي كاملة مع اشتراكه الحالي
def craftsman_profile_data(user_id):
    profile = models.get_craftsman(user_id)
    profile['subscription'] = models.current_subscription(user_id)
    return profile


# مسار قراءة الحرفي لملفه الشخصي
@bp.get('/api/craftsman/profile')
@api_login_required('craftsman')
def get_craftsman_profile():
    return jsonify(craftsman_profile_data(current_user_id()))


# مسار تعديل الحرفي لملفه الشخصي
# نتحقق من كل حقل بالترتيب ونرجع أول خطأ
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
    # مناطق العمل يجب أن تكون قائمة
    # ثم نحتفظ فقط بالرموز الموجودة فعلاً في قائمة المحافظات
    work_areas = data.get('work_areas') if isinstance(data.get('work_areas'), list) else []
    work_areas = [g for g in GOVERNORATES if g in work_areas]
    if not work_areas:
        return error('يرجى اختيار منطقة عمل واحدة على الأقل.')

    # الخدمات الإضافية أرقام خدمات أساسية وأسماء خدمات أخرى
    # بحد أقصى عشر خدمات وكل اسم مئة حرف
    main_ids = data.get('main_services') if isinstance(data.get('main_services'), list) else []
    other_names = data.get('other_services') if isinstance(data.get('other_services'), list) else []
    other_names = [' '.join(n.split())[:100] for n in other_names if isinstance(n, str) and n.strip()][:10]
    if any(len(n) < 2 for n in other_names):
        return error('اسم الخدمة الإضافية يجب أن يكون حرفين على الأقل.')

    profession_id, message = resolve_profession(data)
    if message:
        return error(message)

    # نبني قائمة أرقام الخدمات النهائية دون تكرار
    # المهنة الأساسية أولاً ثم الخدمات الأساسية الصحيحة
    # ثم الخدمات الأخرى وننشئها إن لم تكن موجودة
    service_ids = [profession_id]
    for sid in main_ids:
        service = models.get_service(to_int(sid))
        if service and service['category'] == 'main' and service['id'] not in service_ids:
            service_ids.append(service['id'])
    for name in other_names:
        sid = models.get_or_create_other_service(name)
        if sid not in service_ids:
            service_ids.append(sid)

    # نحفظ التعديلات ثم نرجع الملف بعد التحديث لتعرضه الواجهة مباشرة
    models.update_craftsman_profile(user_id, {
        'name': get_text(data, 'name', 100), 'phone': get_text(data, 'phone', 20),
        'profession_id': profession_id, 'experience': experience, 'governorate': governorate,
        'work_areas': work_areas, 'bio': get_text(data, 'bio', 1000), 'service_ids': service_ids,
    })
    return jsonify(craftsman_profile_data(user_id))


# قسم اشتراك برو للحرفي مع نظام الدفع التجريبي
# تعيد حالة اشتراك الحرفي وهل اشترك في برو سابقاً وسعر الاشتراك
# نحدث الاشتراكات المنتهية أولاً حتى لا تظهر دورة منتهية على أنها فعالة
def subscription_status(user_id):
    models.refresh_expired_subscriptions()
    return {
        'subscription': models.current_subscription(user_id),
        'had_pro': models.has_had_pro(user_id),
        'price_usd': payment.PRO_PRICE_USD,
    }


# مسار قراءة الحرفي لحالة اشتراكه
@bp.get('/api/craftsman/subscription')
@api_login_required('craftsman')
def get_subscription():
    return jsonify(subscription_status(current_user_id()))


# مسار الدفع التجريبي وتفعيل اشتراك برو
# بيانات البطاقة لا تحفظ ولا تسجل ويحفظ مع الاشتراك رقم العملية التجريبي فقط
@bp.post('/api/craftsman/subscription/pay')
@api_login_required('craftsman')
def subscription_pay():
    user_id = current_user_id()
    # نمنع الدفع مرة ثانية إذا كان اشتراك برو فعالاً بالفعل
    if models.current_subscription(user_id)['subscription_type'] == 'pro':
        return error('أنت مشترك في Pro بالفعل.')
    # إذا كانت بيانات البطاقة خاطئة يخرج خطأ الدفع فنلتقطه ونرجع رسالته للحرفي
    # إذا نجح الدفع نحصل على رقم العملية ثم نفعل الاشتراك
    try:
        transaction_id = payment.charge_pro_subscription(get_body())
    except payment.PaymentError as e:
        return error(str(e))
    models.activate_pro(user_id, transaction_id)
    # نرجع رسالة النجاح مع حالة الاشتراك الجديدة في نفس الرد
    return jsonify({'message': 'Payment Successful! Your Pro Premium subscription is now active.',
                    **subscription_status(user_id)})


# مسار إلغاء اشتراك برو
# تسجل الدورة الحالية كملغاة مع تاريخ الإلغاء ويعود الحساب إلى المجاني فوراً
@bp.post('/api/craftsman/subscription/cancel')
@api_login_required('craftsman')
def subscription_cancel():
    user_id = current_user_id()
    if not models.cancel_pro(user_id):
        return error('لا يوجد اشتراك Pro لإلغائه.')
    return jsonify(subscription_status(user_id))


# مسار الطلبات الواردة للحرفي الحالي فقط
@bp.get('/api/craftsman/requests')
@api_login_required('craftsman')
def craftsman_requests():
    return jsonify(models.list_requests(craftsman_id=current_user_id()))


# مسار رفض الحرفي لطلب
# يجب كتابة سبب الرفض بثلاثة أحرف على الأقل
@bp.post('/api/craftsman/requests/<int:request_id>/reject')
@api_login_required('craftsman')
def reject_request(request_id):
    reason = get_text(get_body(), 'reason', 255)
    if len(reason) < 3:
        return error('يرجى كتابة سبب الرفض.')
    if not models.reject_request(request_id, current_user_id(), reason):
        return error('لا يمكن رفض هذا الطلب.')
    return jsonify({'ok': True})


# مسار إرسال الحرفي لعرض السعر
# التكلفة رقم موجب حتى مئة ألف
# ومدة التنفيذ نص وموعد التنفيذ تاريخ لا يكون في الماضي
@bp.post('/api/craftsman/requests/<int:request_id>/offer')
@api_login_required('craftsman')
def send_offer(request_id):
    data = get_body()
    try:
        # نحول السعر إلى رقم عشري وإذا فشل التحويل نجعله صفراً فيرفض في الشرط التالي
        price = float(data.get('price'))
    except (TypeError, ValueError):
        price = 0
    execution_time = get_text(data, 'execution_time', 100)
    try:
        # نحول نص التاريخ إلى تاريخ حسب صيغة السنة ثم الشهر ثم اليوم
        # إذا كانت الصيغة خاطئة يصبح التاريخ لا شيء
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


# مسار تحديد الطلب كمكتمل بعد أن يقبل العميل العرض
@bp.post('/api/craftsman/requests/<int:request_id>/complete')
@api_login_required('craftsman')
def complete_request(request_id):
    if not models.complete_request(request_id, current_user_id()):
        return error('لا يمكن تحديد هذا الطلب كمكتمل.')
    return jsonify({'ok': True})


# قسم الشكاوى
# مسار تقديم شكوى وهو متاح للعميل والحرفي
# تفاصيل الشكوى عشرة أحرف على الأقل ورقم الطلب اختياري
# إذا كان الطلب المحدد لا يخص المستخدم نرجع رسالة خطأ
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


# قسم لوحة تحكم الأدمن
# كل مسارات هذا القسم محمية فلا يصل إليها إلا الأدمن
# مسار جميع الطلبات في الموقع
@bp.get('/api/admin/requests')
@api_login_required('admin')
def admin_requests():
    return jsonify(models.list_requests())


# مسار جميع الشكاوى
@bp.get('/api/admin/complaints')
@api_login_required('admin')
def admin_complaints():
    return jsonify(models.list_complaints())


# مسار تغيير حالة شكوى
# يجب أن تكون الحالة الجديدة من الحالات المسموحة
@bp.put('/api/admin/complaints/<int:complaint_id>')
@api_login_required('admin')
def admin_update_complaint(complaint_id):
    status = get_body().get('status')
    if status not in COMPLAINT_STATUSES:
        return error('حالة الشكوى غير صحيحة.')
    if not models.update_complaint_status(complaint_id, status):
        return error('لم يتم العثور على الشكوى.', 404)
    return jsonify({'ok': True})


# مسار قائمة المستخدمين
# يرجع الحرفيين إذا طلبهم الرابط وإلا يرجع العملاء
@bp.get('/api/admin/users')
@api_login_required('admin')
def admin_users():
    if request.args.get('role') == 'craftsman':
        return jsonify(models.list_all_craftsmen_for_admin())
    return jsonify(models.list_customers())


# مسار تفاصيل مستخدم واحد
# إذا كان حرفياً نضيف إليه بيانات ملفه المهني
@bp.get('/api/admin/users/<int:user_id>')
@api_login_required('admin')
def admin_user_details(user_id):
    user = models.get_user(user_id)
    if not user:
        return error('لم يتم العثور على المستخدم.', 404)
    if user['role'] == 'craftsman':
        user.update(models.get_craftsman(user_id))
    return jsonify(user)


# مسار جدول مراقبة الاشتراكات
@bp.get('/api/admin/subscriptions')
@api_login_required('admin')
def admin_subscriptions():
    return jsonify(models.subscriptions_overview())


# مسار سجل اشتراكات حرفي واحد
# يرجع الرمز 404 إذا لم يكن الرقم لحرفي
@bp.get('/api/admin/subscriptions/<int:craftsman_id>')
@api_login_required('admin')
def admin_subscription_history(craftsman_id):
    history = models.subscription_history(craftsman_id)
    if not history:
        return error('لم يتم العثور على الحرفي.', 404)
    return jsonify(history)
