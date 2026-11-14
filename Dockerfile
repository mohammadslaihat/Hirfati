# حِرفتي (HIRFATI) — صورة تطبيق Flask
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# تثبيت المكتبات أولاً للاستفادة من التخزين المؤقت عند إعادة البناء
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# ملفات الواجهة الخلفية والواجهة الأمامية (Flask يخدم صفحات frontend)
COPY backend/ backend/
COPY frontend/ frontend/

# التشغيل بمستخدم عادي بدلاً من root
RUN useradd --create-home --uid 1000 hirfati
USER hirfati

WORKDIR /app/backend
EXPOSE 5000

# خادم إنتاج (gunicorn) بدلاً من خادم التطوير الخاص بـ Flask
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--access-logfile", "-", "app:app"]
