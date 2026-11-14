"""نظام دفع تجريبي (محاكاة) لاشتراك Pro — لأغراض المشروع الجامعي فقط.

- لا يوجد اتصال بأي بوابة دفع خارجية، ولا يتم تحصيل أي مبلغ حقيقي.
- يتم التحقق من شكل بيانات البطاقة فقط (عدد الأرقام، تاريخ الانتهاء، رمز CVV).
- بيانات البطاقة تُستخدم للتحقق لحظياً ثم تُهمل: لا تُخزَّن في قاعدة البيانات ولا تُكتب في السجلات.
- عند نجاح «الدفع» يُنشأ رقم عملية تجريبي (SIM-...) يُحفظ مع الاشتراك بدلاً من أي بيانات بطاقة.
"""
import re
import secrets
from datetime import date

PRO_PRICE_USD = 10


class PaymentError(Exception):
    """خطأ برسالة عربية مناسبة لعرضها للحرفي."""


def validate_card(cardholder_name, card_number, expiry, cvv):
    """يرفع PaymentError برسالة توضح الخطأ إذا كانت البيانات ناقصة أو غير صحيحة."""
    name = ' '.join(str(cardholder_name or '').split())
    number = re.sub(r'[\s-]', '', str(card_number or ''))
    expiry = str(expiry or '').strip()
    cvv = str(cvv or '').strip()

    if not name or not number or not expiry or not cvv:
        raise PaymentError('يرجى تعبئة جميع بيانات البطاقة.')
    if len(name) < 3 or re.search(r'\d', name):
        raise PaymentError('اسم صاحب البطاقة غير صحيح.')
    if not re.fullmatch(r'\d{16}', number):
        raise PaymentError('رقم البطاقة يجب أن يتكون من 16 رقماً.')

    match = re.fullmatch(r'(\d{2})\s*/\s*(\d{2})', expiry)
    if not match or not 1 <= int(match.group(1)) <= 12:
        raise PaymentError('تاريخ انتهاء البطاقة يجب أن يكون بالصيغة MM/YY.')
    month, year = int(match.group(1)), 2000 + int(match.group(2))
    today = date.today()
    if (year, month) < (today.year, today.month):
        raise PaymentError('البطاقة منتهية الصلاحية.')
    if year > today.year + 20:
        raise PaymentError('تاريخ انتهاء البطاقة غير صحيح.')

    if not re.fullmatch(r'\d{3}', cvv):
        raise PaymentError('رمز CVV يجب أن يتكون من 3 أرقام.')


def charge_pro_subscription(card):
    """«خصم» تجريبي لاشتراك Pro الشهري: يتحقق من البطاقة ويعيد رقم عملية تجريبي."""
    validate_card(card.get('cardholder_name'), card.get('card_number'), card.get('expiry'), card.get('cvv'))
    return 'SIM-' + secrets.token_hex(6).upper()
