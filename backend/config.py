"""إعدادات التطبيق — تُقرأ من متغيرات البيئة أو من ملف .env في جذر المشروع."""
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(PROJECT_DIR, 'frontend')

load_dotenv(os.path.join(PROJECT_DIR, '.env'))


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'change-this-secret-key')
    DEBUG = os.getenv('FLASK_DEBUG', '0') == '1'

    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', '3306'))
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'hirfati_db')


    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'


# محافظات الأردن الاثنتا عشرة (الرمز: الاسم)
GOVERNORATES = {
    'irbid': 'إربد', 'jerash': 'جرش', 'ajloun': 'عجلون', 'mafraq': 'المفرق',
    'amman': 'عمّان', 'zarqa': 'الزرقاء', 'balqa': 'البلقاء', 'madaba': 'مادبا',
    'karak': 'الكرك', 'maan': 'معان', 'tafila': 'الطفيلة', 'aqaba': 'العقبة',
}
