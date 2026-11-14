"""الاتصال بقاعدة بيانات MySQL ودوال مساعدة لتنفيذ الاستعلامات."""
import pymysql
from flask import current_app, g


def get_db():
    """اتصال واحد لكل طلب HTTP، يُغلق تلقائياً في نهايته."""
    if 'db' not in g:
        cfg = current_app.config
        g.db = pymysql.connect(
            host=cfg['DB_HOST'], port=cfg['DB_PORT'],
            user=cfg['DB_USER'], password=cfg['DB_PASSWORD'],
            database=cfg['DB_NAME'], charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor, autocommit=False,
        )
    return g.db


def close_db(error=None):
    db = g.pop('db', None)
    if db is not None:
        if error is not None:
            db.rollback()
        db.close()


def query(sql, args=(), one=False):
    """استعلام قراءة: يعيد قائمة صفوف أو صفاً واحداً."""
    with get_db().cursor() as cur:
        cur.execute(sql, args)
        rows = cur.fetchall()
    if one:
        return rows[0] if rows else None
    return list(rows)


def execute(sql, args=()):
    """استعلام كتابة: يعيد (رقم آخر صف مُضاف، عدد الصفوف المتأثرة). الحفظ يتم بـ commit()."""
    with get_db().cursor() as cur:
        affected = cur.execute(sql, args)
        return cur.lastrowid, affected


def commit():
    get_db().commit()


def rollback():
    get_db().rollback()
