# ملف الاتصال بقاعدة البيانات ودوال تنفيذ الاستعلامات
# المكتبة الأولى تتصل بخادم قاعدة البيانات وتنفذ أوامر الاستعلام
# نستورد من فلاسك التطبيق الحالي لقراءة الإعدادات
# ونستورد مخزناً مؤقتاً خاصاً بكل طلب يبقى حتى نهاية الطلب فقط
import pymysql
from flask import current_app, g


# تعيد هذه الدالة اتصالاً بقاعدة البيانات
# تفتح اتصالاً واحداً لكل طلب وتحفظه في المخزن المؤقت
# إذا كان الاتصال مفتوحاً مسبقاً في نفس الطلب تعيده دون فتح اتصال جديد
def get_db():
    if 'db' not in g:
        cfg = current_app.config
        # فتح الاتصال باستخدام القيم الموجودة في الإعدادات
        # الترميز المستخدم يدعم اللغة العربية بشكل كامل
        # كل صف يرجع على شكل قاموس فنصل إلى القيمة باسم العمود
        # الحفظ التلقائي معطل فلا تحفظ التعديلات إلا عند طلب الحفظ صراحة
        # هذا يسمح بتنفيذ عدة عمليات معاً كوحدة واحدة
        g.db = pymysql.connect(
            host=cfg['DB_HOST'], port=cfg['DB_PORT'],
            user=cfg['DB_USER'], password=cfg['DB_PASSWORD'],
            database=cfg['DB_NAME'], charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor, autocommit=False,
        )
    return g.db


# تعمل هذه الدالة تلقائياً في نهاية كل طلب
# تخرج الاتصال من المخزن المؤقت ثم تغلقه
# إذا حدث خطأ أثناء الطلب تتراجع عن التعديلات غير المحفوظة
def close_db(error=None):
    db = g.pop('db', None)
    if db is not None:
        if error is not None:
            db.rollback()
        db.close()


# تنفذ هذه الدالة استعلامات القراءة
# تستقبل نص الاستعلام والقيم التي توضع مكان العلامات داخله
# تمرير القيم بشكل منفصل يحمي من هجمات حقن أوامر قاعدة البيانات
# تعيد قائمة بكل الصفوف أو صفاً واحداً فقط عند طلب ذلك
def query(sql, args=(), one=False):
    # تفتح مؤشراً لتنفيذ الاستعلام ويغلق تلقائياً عند الانتهاء حتى لو حدث خطأ
    with get_db().cursor() as cur:
        cur.execute(sql, args)
        rows = cur.fetchall()
    if one:
        return rows[0] if rows else None
    return list(rows)


# تنفذ هذه الدالة أوامر الإضافة والتعديل والحذف
# تعيد رقم آخر صف تمت إضافته وعدد الصفوف التي تأثرت
# لا تحفظ التعديلات بنفسها بل يجب استدعاء دالة الحفظ بعدها
def execute(sql, args=()):
    with get_db().cursor() as cur:
        affected = cur.execute(sql, args)
        return cur.lastrowid, affected


# تحفظ كل التعديلات التي تمت في هذا الطلب بشكل نهائي
def commit():
    get_db().commit()


# تلغي كل التعديلات التي لم يتم حفظها بعد
def rollback():
    get_db().rollback()
