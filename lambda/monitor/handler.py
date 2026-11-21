# Hirfati monitor Lambda
# Runs on a schedule inside the VPC, connects to MySQL on EC2 B (read-only user),
# counts new activity in the last WINDOW_MINUTES and sends a notification.
# Without SNS_TOPIC_ARN it only writes to CloudWatch Logs.
import json
import logging
import os

import boto3
import pymysql

log = logging.getLogger()
log.setLevel(logging.INFO)

TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
WINDOW = int(os.environ.get("WINDOW_MINUTES", "5"))
sns = boto3.client("sns") if TOPIC_ARN else None

CHECKS = {
    "complaints": ("شكاوى جديدة", "SELECT COUNT(*) AS n FROM complaints WHERE created_at >= NOW() - INTERVAL %s MINUTE"),
    "requests": ("طلبات عروض أسعار جديدة", "SELECT COUNT(*) AS n FROM requests WHERE created_at >= NOW() - INTERVAL %s MINUTE"),
    "offers": ("عروض أسعار أرسلها الحرفيون", "SELECT COUNT(*) AS n FROM offers WHERE created_at >= NOW() - INTERVAL %s MINUTE"),
}


def notify(subject, message):
    log.info("NOTIFY | %s | %s", subject, message)
    if sns:
        sns.publish(TopicArn=TOPIC_ARN, Subject=subject[:100], Message=message)


def handler(event, context):
    host = os.environ["DB_HOST"]
    try:
        conn = pymysql.connect(
            host=host,
            port=int(os.environ.get("DB_PORT", "3306")),
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            database=os.environ["DB_NAME"],
            charset="utf8mb4",
            connect_timeout=5,
            cursorclass=pymysql.cursors.DictCursor,
        )
    except pymysql.MySQLError as e:
        notify("Hirfati ALERT: database unreachable",
               f"تعذر على Lambda الاتصال بقاعدة البيانات على {host}: {e}")
        return {"db": "down"}

    counts = {}
    try:
        with conn.cursor() as cur:
            for key, (_, sql) in CHECKS.items():
                cur.execute(sql, (WINDOW,))
                counts[key] = cur.fetchone()["n"]
    finally:
        conn.close()

    log.info(json.dumps({"db": "up", **counts}))
    if any(counts.values()):
        lines = [f"- {CHECKS[k][0]}: {v}" for k, v in counts.items() if v]
        notify("Hirfati: new activity",
               f"نشاط جديد على منصة حِرفتي خلال آخر {WINDOW} دقائق:\n" + "\n".join(lines))
    return {"db": "up", **counts}
