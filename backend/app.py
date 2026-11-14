"""نقطة تشغيل تطبيق حِرفتي (Flask)."""
from datetime import date, datetime
from decimal import Decimal

import pymysql
from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider

from config import Config
from database import close_db
from routes import bp


class JSONProvider(DefaultJSONProvider):
    """تحويل التواريخ والأرقام العشرية القادمة من MySQL إلى صيغة مناسبة للواجهة."""
    ensure_ascii = False

    @staticmethod
    def default(o):
        if isinstance(o, datetime):
            return o.strftime('%Y-%m-%d')
        if isinstance(o, date):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        return DefaultJSONProvider.default(o)


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    app.json = JSONProvider(app)
    app.teardown_appcontext(close_db)
    app.register_blueprint(bp)

    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'المسار غير موجود.'}), 404
        return '<h1 dir="rtl">الصفحة غير موجودة</h1>', 404

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


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=Config.DEBUG)
