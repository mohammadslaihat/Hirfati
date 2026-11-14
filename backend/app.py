# الملف الرئيسي لتشغيل تطبيق حرفتي
# أنواع التاريخ والأرقام العشرية القادمة من قاعدة البيانات
# نحتاجها لأن صيغة جيسون لا تعرف كيف تحولها بنفسها
from datetime import date, datetime
from decimal import Decimal

import pymysql
from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider

# نستورد من ملفات المشروع الإعدادات ودالة إغلاق الاتصال ومجموعة المسارات
from config import Config
from database import close_db
from routes import bp


# هذا الكلاس مسؤول عن تحويل البيانات إلى صيغة جيسون قبل إرسالها للمتصفح
# يرث من المحول الافتراضي في فلاسك ويضيف تحويل التواريخ والأرقام العشرية
class JSONProvider(DefaultJSONProvider):
    # يبقي الحروف العربية كما هي داخل الرد بدلاً من تحويلها إلى رموز
    ensure_ascii = False

    # تعمل هذه الدالة تلقائياً مع كل قيمة لا يعرف المحول تحويلها
    # التاريخ مع الوقت يتحول إلى نص يحتوي السنة والشهر واليوم
    # التاريخ وحده يتحول إلى نص بالصيغة القياسية
    # الرقم العشري يتحول إلى رقم عادي
    # نفحص التاريخ مع الوقت أولاً لأنه نوع فرعي من التاريخ
    @staticmethod
    def default(o):
        if isinstance(o, datetime):
            return o.strftime('%Y-%m-%d')
        if isinstance(o, date):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        return DefaultJSONProvider.default(o)


# تنشئ هذه الدالة التطبيق الرئيسي باستخدام إطار فلاسك
# تجهز إعدادات التطبيق وتربط جميع المسارات المطلوبة
# تعيد التطبيق بعد الانتهاء من تجهيزه ليصبح جاهزاً للتشغيل
# نلغي مجلد الملفات الثابتة الافتراضي لأن المسارات ترسل ملفات الواجهة مع فحص الصلاحيات
def create_app():
    app = Flask(__name__, static_folder=None)
    # تحميل الإعدادات من كلاس الإعدادات
    # ثم استخدام محول جيسون الخاص بنا
    # ثم تسجيل دالة إغلاق الاتصال لتعمل بعد كل طلب
    # ثم تسجيل جميع مسارات الموقع
    app.config.from_object(Config)
    app.json = JSONProvider(app)
    app.teardown_appcontext(close_db)
    app.register_blueprint(bp)

    # يعالج خطأ الصفحة غير الموجودة
    # طلبات واجهة البيانات ترجع رسالة بصيغة جيسون لأن السكربت يتوقع ذلك
    # باقي الطلبات ترجع صفحة بسيطة فيها رسالة عربية
    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'المسار غير موجود.'}), 404
        return '<h1 dir="rtl">الصفحة غير موجودة</h1>', 404

    # يعالج أي خطأ قادم من قاعدة البيانات في أي مسار
    # الرقم الأول في الخطأ يحدد نوعه
    # الرقم 1045 يعني أن اسم المستخدم أو كلمة المرور غير صحيحة
    # الرقم 1049 يعني أن قاعدة البيانات غير موجودة
    # الرقم 2003 يعني أن الخادم لا يمكن الوصول إليه
    # يكتب السبب للمطور في سجل الخادم
    # ويرجع للمستخدم رسالة عربية عامة دون كشف التفاصيل التقنية
    @app.errorhandler(pymysql.MySQLError)
    def database_error(e):
        code = e.args[0] if e.args else None
        hints = {
            1045: 'MySQL refused the login: check DB_USER / DB_PASSWORD in the .env file, then restart the app.',
            1049: 'Database hirfati_db not found: run database/schema.sql and database/seed.sql first.',
            2003: 'Cannot reach MySQL: make sure the MySQL server is running and DB_HOST / DB_PORT are correct.',
        }
        if code in hints:
            app.logger.error('Database connection problem (%s): %s', code, hints[code])
        else:
            app.logger.exception('Database error')
        return jsonify({'error': 'حدث خطأ في قاعدة البيانات، يرجى المحاولة لاحقاً.'}), 500

    return app


# إنشاء التطبيق عند تحميل الملف
# خادم التشغيل داخل دوكر يستخدم هذا المتغير مباشرة
app = create_app()

# هذا الجزء يعمل فقط عند تشغيل الملف مباشرة دون دوكر
# يستقبل الخادم الاتصالات على المنفذ 5000
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=Config.DEBUG)
