"""استعلامات قاعدة البيانات لكل أقسام الموقع (الحسابات، الحرفيون، الطلبات، الشكاوى، الاشتراكات)."""
import calendar
from datetime import date, datetime

from database import query, execute, commit, rollback


# =========================================================
# الخدمات
# =========================================================

def get_service(service_id):
    return query('SELECT id, name, category FROM services WHERE id = %s', (service_id,), one=True)


def main_services():
    return query("SELECT id, name, category FROM services WHERE category = 'main' ORDER BY id")


def other_services_with_craftsmen():
    """خدمات أخرى التي أضافها الحرفيون ويوجد حرفي واحد على الأقل يقدمها."""
    return query("""
        SELECT DISTINCT s.id, s.name, s.category
        FROM services s
        JOIN craftsman_services cs ON cs.service_id = s.id
        WHERE s.category = 'other'
        ORDER BY s.name
    """)


def get_or_create_other_service(name):
    """يعيد رقم الخدمة بالاسم المكتوب، وينشئها ضمن «خدمات أخرى» إذا لم تكن موجودة."""
    name = ' '.join(name.split())
    row = query('SELECT id FROM services WHERE name = %s', (name,), one=True)
    if row:
        return row['id']
    new_id, _ = execute("INSERT INTO services (name, category) VALUES (%s, 'other')", (name,))
    return new_id


# =========================================================
# الحسابات
# =========================================================

def get_user_by_email(email):
    return query('SELECT * FROM users WHERE email = %s', (email,), one=True)


def email_exists(email):
    return query('SELECT id FROM users WHERE email = %s', (email,), one=True) is not None


def get_user(user_id):
    user = query("""
        SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
               COALESCE(p.governorate, u.governorate) AS governorate
        FROM users u
        LEFT JOIN craftsman_profiles p ON p.user_id = u.id
        WHERE u.id = %s
    """, (user_id,), one=True)
    return user


def create_customer(name, email, phone, password_hash, governorate):
    user_id, _ = execute(
        "INSERT INTO users (name, email, password, phone, role, governorate) VALUES (%s, %s, %s, %s, 'customer', %s)",
        (name, email, password_hash, phone, governorate))
    commit()
    return user_id


def create_craftsman(name, email, phone, password_hash, governorate, profession_id, experience):
    """الحرفي الجديد يبدأ باشتراك Basic، ثم يختار نوع الاشتراك في الخطوة التالية."""
    user_id, _ = execute(
        "INSERT INTO users (name, email, password, phone, role) VALUES (%s, %s, %s, %s, 'craftsman')",
        (name, email, password_hash, phone))
    execute("""
        INSERT INTO craftsman_profiles (user_id, profession_id, experience_years, governorate, work_areas, bio)
        VALUES (%s, %s, %s, %s, %s, NULL)
    """, (user_id, profession_id, experience, governorate, governorate))
    execute('INSERT INTO craftsman_services (craftsman_id, service_id) VALUES (%s, %s)', (user_id, profession_id))
    _open_basic(user_id, date.today())
    commit()
    return user_id


# =========================================================
# الاشتراكات
# كل دورة اشتراك Pro صف مستقل في جدول subscriptions، ولا يُكتب فوق الدورات السابقة:
#   active = فعال | cancelled = ملغى (مع تاريخ الإلغاء cancelled_at) | expired = منتهي (انتهى شهره)
# التواريخ تُحسب في الخادم (Python) بتوقيت الجهاز، وليس بتوقيت MySQL.
# =========================================================

def add_one_month(d):
    """إضافة شهر تقويمي واحد (31/01 -> 28 أو 29/02)."""
    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def _open_basic(craftsman_id, today):
    execute("""INSERT INTO subscriptions (craftsman_id, subscription_type, start_date, end_date, status)
               VALUES (%s, 'basic', %s, NULL, 'active')""", (craftsman_id, today))
    execute("UPDATE craftsman_profiles SET subscription_type = 'basic' WHERE user_id = %s", (craftsman_id,))


def activate_pro(craftsman_id, transaction_id):
    """دورة اشتراك Pro جديدة: تبدأ اليوم وتنتهي بعد شهر تقويمي واحد (للاشتراك الأول ولإعادة الاشتراك)."""
    today = date.today()
    execute("""UPDATE subscriptions SET status = 'cancelled', end_date = %s
               WHERE craftsman_id = %s AND subscription_type = 'basic' AND status = 'active'""", (today, craftsman_id))
    execute("""INSERT INTO subscriptions
                 (craftsman_id, subscription_type, start_date, end_date, status, gateway_subscription_id)
               VALUES (%s, 'pro', %s, %s, 'active', %s)""",
            (craftsman_id, today, add_one_month(today), transaction_id))
    execute("UPDATE craftsman_profiles SET subscription_type = 'pro' WHERE user_id = %s", (craftsman_id,))
    commit()


def cancel_pro(craftsman_id):
    """إلغاء دورة Pro الحالية: حالتها «ملغى» مع تسجيل وقت الإلغاء، والعودة إلى Basic فوراً."""
    now = datetime.now().replace(microsecond=0)
    _, changed = execute("""UPDATE subscriptions SET status = 'cancelled', cancelled_at = %s
                            WHERE craftsman_id = %s AND subscription_type = 'pro' AND status = 'active'""",
                         (now, craftsman_id))
    if not changed:
        rollback()
        return False
    _open_basic(craftsman_id, now.date())
    commit()
    return True


def has_had_pro(craftsman_id):
    return query("SELECT id FROM subscriptions WHERE craftsman_id = %s AND subscription_type = 'pro' LIMIT 1",
                 (craftsman_id,), one=True) is not None


def refresh_expired_subscriptions():
    """دورة Pro التي مرّ تاريخ انتهائها تصبح «منتهي» ويعود الحرفي إلى Basic."""
    today = date.today()
    expired = query("""SELECT id, craftsman_id FROM subscriptions
                       WHERE status = 'active' AND subscription_type = 'pro' AND end_date < %s""", (today,))
    for sub in expired:
        execute("UPDATE subscriptions SET status = 'expired' WHERE id = %s", (sub['id'],))
        _open_basic(sub['craftsman_id'], today)
    if expired:
        commit()


def current_subscription(craftsman_id):
    return query("""SELECT subscription_type, start_date, end_date, status FROM subscriptions
                    WHERE craftsman_id = %s AND status = 'active' ORDER BY id DESC LIMIT 1""",
                 (craftsman_id,), one=True)


def _fmt_datetime(value):
    return value.strftime('%Y-%m-%d %H:%M') if value else None


def subscriptions_overview():
    """لوحة الأدمن: صف لكل حرفي مع آخر دورة Pro له (أو اشتراكه Basic إن لم يشترك في Pro أبداً)."""
    refresh_expired_subscriptions()
    rows = query("""
        SELECT u.id AS craftsman_id, u.name, u.email, s.name AS profession, p.subscription_type AS current_type,
               lp.start_date AS pro_start, lp.end_date AS pro_end, lp.status AS pro_status, lp.cancelled_at,
               cur.start_date AS current_start,
               (SELECT COUNT(*) FROM subscriptions x WHERE x.craftsman_id = u.id AND x.subscription_type = 'pro') AS pro_cycles
        FROM users u
        JOIN craftsman_profiles p ON p.user_id = u.id
        JOIN services s ON s.id = p.profession_id
        LEFT JOIN subscriptions lp ON lp.id = (
            SELECT x.id FROM subscriptions x WHERE x.craftsman_id = u.id AND x.subscription_type = 'pro'
            ORDER BY x.start_date DESC, x.id DESC LIMIT 1)
        LEFT JOIN subscriptions cur ON cur.id = (
            SELECT x.id FROM subscriptions x WHERE x.craftsman_id = u.id AND x.status = 'active'
            ORDER BY x.id DESC LIMIT 1)
        WHERE u.role = 'craftsman'
    """)
    result = []
    for r in rows:
        has_pro = r['pro_cycles'] > 0
        result.append({
            'craftsman_id': r['craftsman_id'], 'name': r['name'], 'email': r['email'], 'profession': r['profession'],
            'current_type': r['current_type'], 'has_pro': has_pro, 'pro_cycles': r['pro_cycles'],
            'start_date': r['pro_start'] if has_pro else r['current_start'],
            'end_date': r['pro_end'] if has_pro else None,
            'status': r['pro_status'] if has_pro else 'active',
            'cancelled_at': _fmt_datetime(r['cancelled_at']) if has_pro else None,
        })
    order = {'active': 0, 'cancelled': 1, 'expired': 2}
    result.sort(key=lambda x: (not x['has_pro'], order.get(x['status'], 3),
                               -(x['start_date'].toordinal() if x['start_date'] else 0)))
    return result


def subscription_history(craftsman_id):
    """سجل كل دورات Pro للحرفي بالترتيب: الاشتراك الأول ثم كل إعادة اشتراك، مع تواريخ الانتهاء والإلغاء."""
    refresh_expired_subscriptions()
    craftsman = query("""SELECT u.id, u.name, u.email, u.phone, s.name AS profession, p.subscription_type AS current_type
                         FROM users u JOIN craftsman_profiles p ON p.user_id = u.id
                         JOIN services s ON s.id = p.profession_id
                         WHERE u.id = %s AND u.role = 'craftsman'""", (craftsman_id,), one=True)
    if not craftsman:
        return None
    cycles = query("""SELECT start_date, end_date, status, cancelled_at, gateway_subscription_id AS transaction_id
                      FROM subscriptions WHERE craftsman_id = %s AND subscription_type = 'pro'
                      ORDER BY start_date, id""", (craftsman_id,))
    for i, c in enumerate(cycles):
        c['cycle'] = i + 1
        c['kind'] = 'first' if i == 0 else 'resubscribe'
        c['cancelled_at'] = _fmt_datetime(c['cancelled_at'])
    craftsman['current'] = current_subscription(craftsman_id)
    craftsman['cycles'] = cycles
    return craftsman


# =========================================================
# الحرفيون
# =========================================================

CRAFTSMAN_SELECT = """
    SELECT u.id, u.name, u.phone, u.email, u.created_at,
           p.profession_id, s.name AS profession, s.category AS profession_category,
           p.experience_years, p.governorate, p.work_areas, p.bio, p.subscription_type,
           (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.craftsman_id = u.id) AS rating
    FROM users u
    JOIN craftsman_profiles p ON p.user_id = u.id
    JOIN services s ON s.id = p.profession_id
    WHERE u.role = 'craftsman'
"""


def _format_craftsman(row):
    row['work_areas'] = [a for a in (row['work_areas'] or '').split(',') if a]
    row['rating'] = float(row['rating']) if row['rating'] is not None else None
    return row


def list_craftsmen(service=None, governorate=None, featured=False):
    """service: رقم خدمة أو 'other' لكل الخدمات الأخرى. الحرفي Pro يظهر أولاً ثم حسب التقييم."""
    refresh_expired_subscriptions()
    sql, args = CRAFTSMAN_SELECT, []
    if service == 'other':
        sql += """ AND u.id IN (SELECT cs.craftsman_id FROM craftsman_services cs
                               JOIN services sv ON sv.id = cs.service_id WHERE sv.category = 'other')"""
    elif service:
        sql += ' AND u.id IN (SELECT craftsman_id FROM craftsman_services WHERE service_id = %s)'
        args.append(service)
    if governorate:
        sql += ' AND (p.governorate = %s OR FIND_IN_SET(%s, p.work_areas))'
        args += [governorate, governorate]
    if featured:
        sql += """ AND p.subscription_type = 'pro'
                   AND EXISTS (SELECT 1 FROM subscriptions sb WHERE sb.craftsman_id = u.id AND sb.subscription_type = 'pro'
                               AND sb.status = 'active' AND sb.end_date >= %s)"""
        args.append(date.today())
    sql += " ORDER BY p.subscription_type = 'pro' DESC, rating DESC, u.name"
    return [_format_craftsman(r) for r in query(sql, args)]


def get_craftsman(craftsman_id):
    refresh_expired_subscriptions()
    row = query(CRAFTSMAN_SELECT + ' AND u.id = %s', (craftsman_id,), one=True)
    if not row:
        return None
    row = _format_craftsman(row)
    row['services'] = query("""
        SELECT s.id, s.name, s.category FROM craftsman_services cs
        JOIN services s ON s.id = cs.service_id
        WHERE cs.craftsman_id = %s ORDER BY s.category, s.id
    """, (craftsman_id,))
    row['reviews'] = query("""
        SELECT r.rating, r.comment, r.created_at, u.name AS customer_name
        FROM reviews r JOIN users u ON u.id = r.customer_id
        WHERE r.craftsman_id = %s ORDER BY r.created_at DESC, r.id DESC
    """, (craftsman_id,))
    return row


def list_all_craftsmen_for_admin():
    return [_format_craftsman(r) for r in query(CRAFTSMAN_SELECT + ' ORDER BY u.created_at DESC, u.id DESC')]


def update_craftsman_profile(user_id, data):
    """data: name, phone, profession_id, experience, governorate, work_areas, bio, service_ids"""
    execute('UPDATE users SET name = %s, phone = %s WHERE id = %s', (data['name'], data['phone'], user_id))
    execute("""UPDATE craftsman_profiles
               SET profession_id = %s, experience_years = %s, governorate = %s, work_areas = %s, bio = %s
               WHERE user_id = %s""",
            (data['profession_id'], data['experience'], data['governorate'],
             ','.join(data['work_areas']), data['bio'] or None, user_id))
    execute('DELETE FROM craftsman_services WHERE craftsman_id = %s', (user_id,))
    for service_id in data['service_ids']:
        execute('INSERT INTO craftsman_services (craftsman_id, service_id) VALUES (%s, %s)', (user_id, service_id))
    commit()


# =========================================================
# الطلبات وعروض الأسعار والتقييمات
# =========================================================

REQUEST_SELECT = """
    SELECT r.id, r.customer_id, r.craftsman_id, r.service_id, s.name AS service_name,
           r.description, r.location, r.status, r.reject_reason, r.created_at,
           c.name AS customer_name, k.name AS craftsman_name,
           o.price, o.execution_time, o.execution_date, o.status AS offer_status,
           EXISTS (SELECT 1 FROM reviews rv WHERE rv.request_id = r.id) AS reviewed
    FROM requests r
    JOIN users c ON c.id = r.customer_id
    JOIN users k ON k.id = r.craftsman_id
    JOIN services s ON s.id = r.service_id
    LEFT JOIN offers o ON o.request_id = r.id
"""


def _format_request(row):
    price = row.pop('price')
    offer = {
        'price': float(price) if price is not None else None,
        'execution_time': row.pop('execution_time'),
        'execution_date': row.pop('execution_date'),
        'status': row.pop('offer_status'),
    }
    row['offer'] = offer if price is not None else None
    row['reviewed'] = bool(row['reviewed'])
    return row


def list_requests(customer_id=None, craftsman_id=None):
    sql, args = REQUEST_SELECT, []
    if customer_id:
        sql += ' WHERE r.customer_id = %s'
        args.append(customer_id)
    elif craftsman_id:
        sql += ' WHERE r.craftsman_id = %s'
        args.append(craftsman_id)
    sql += ' ORDER BY r.created_at DESC, r.id DESC'
    return [_format_request(r) for r in query(sql, args)]


def create_request(customer_id, craftsman, description, location):
    request_id, _ = execute("""
        INSERT INTO requests (customer_id, craftsman_id, service_id, description, location)
        VALUES (%s, %s, %s, %s, %s)
    """, (customer_id, craftsman['id'], craftsman['profession_id'], description, location))
    commit()
    return request_id


def reject_request(request_id, craftsman_id, reason):
    _, changed = execute("""UPDATE requests SET status = 'rejected', reject_reason = %s
                            WHERE id = %s AND craftsman_id = %s AND status = 'pending'""",
                         (reason, request_id, craftsman_id))
    commit()
    return changed == 1


def send_offer(request_id, craftsman_id, price, execution_time, execution_date):
    _, changed = execute("""UPDATE requests SET status = 'quoted'
                            WHERE id = %s AND craftsman_id = %s AND status = 'pending'""",
                         (request_id, craftsman_id))
    if changed != 1:
        rollback()
        return False
    execute("""INSERT INTO offers (request_id, price, execution_time, execution_date)
               VALUES (%s, %s, %s, %s)""", (request_id, price, execution_time, execution_date))
    commit()
    return True


def respond_to_offer(request_id, customer_id, accept):
    new_status = 'in_progress' if accept else 'quote_rejected'
    _, changed = execute("""UPDATE requests SET status = %s
                            WHERE id = %s AND customer_id = %s AND status = 'quoted'""",
                         (new_status, request_id, customer_id))
    if changed != 1:
        rollback()
        return False
    execute('UPDATE offers SET status = %s WHERE request_id = %s',
            ('accepted' if accept else 'rejected', request_id))
    commit()
    return True


def complete_request(request_id, craftsman_id):
    _, changed = execute("""UPDATE requests SET status = 'completed'
                            WHERE id = %s AND craftsman_id = %s AND status = 'in_progress'""",
                         (request_id, craftsman_id))
    commit()
    return changed == 1


def add_review(request_id, customer_id, rating, comment):
    req = query("""SELECT craftsman_id FROM requests
                   WHERE id = %s AND customer_id = %s AND status = 'completed'""",
                (request_id, customer_id), one=True)
    if not req or query('SELECT id FROM reviews WHERE request_id = %s', (request_id,), one=True):
        return False
    execute("""INSERT INTO reviews (customer_id, craftsman_id, request_id, rating, comment)
               VALUES (%s, %s, %s, %s, %s)""",
            (customer_id, req['craftsman_id'], request_id, rating, comment or None))
    commit()
    return True


# =========================================================
# الشكاوى
# =========================================================

def create_complaint(user_id, request_id, details):
    """إذا تم اختيار طلب، يكون المشتكى عليه هو الطرف الآخر في الطلب. يعيد None إذا كان الطلب لا يخص المستخدم."""
    accused_id = None
    if request_id:
        req = query("""SELECT customer_id, craftsman_id FROM requests
                       WHERE id = %s AND (customer_id = %s OR craftsman_id = %s)""",
                    (request_id, user_id, user_id), one=True)
        if not req:
            return None
        accused_id = req['craftsman_id'] if req['customer_id'] == user_id else req['customer_id']
    complaint_id, _ = execute("""INSERT INTO complaints (complainant_id, accused_id, complaint_details)
                                 VALUES (%s, %s, %s)""", (user_id, accused_id, details))
    commit()
    return complaint_id


def list_complaints():
    return query("""
        SELECT cp.id, cp.complaint_details, cp.status, cp.created_at,
               a.id AS complainant_id, a.name AS complainant_name, a.role AS complainant_role, a.phone AS complainant_phone,
               b.id AS accused_id, b.name AS accused_name, b.role AS accused_role, b.phone AS accused_phone
        FROM complaints cp
        JOIN users a ON a.id = cp.complainant_id
        LEFT JOIN users b ON b.id = cp.accused_id
        ORDER BY cp.created_at DESC, cp.id DESC
    """)


def update_complaint_status(complaint_id, status):
    if not query('SELECT id FROM complaints WHERE id = %s', (complaint_id,), one=True):
        return False
    execute('UPDATE complaints SET status = %s WHERE id = %s', (status, complaint_id))
    commit()
    return True


# =========================================================
# المستخدمون (الأدمن)
# =========================================================

def list_customers():
    return query("""SELECT id, name, email, phone, governorate, created_at FROM users
                    WHERE role = 'customer' ORDER BY created_at DESC, id DESC""")
