/* =========================================================
   حِرفتي — نموذج الدفع التجريبي لاشتراك Pro
   ---------------------------------------------------------
   نظام محاكاة للدفع لأغراض المشروع الجامعي: لا توجد بوابة دفع
   خارجية ولا يتم خصم أي مبلغ. يتم التحقق من شكل البيانات هنا
   ثم في الخادم، ولا تُحفظ بيانات البطاقة في قاعدة البيانات.
   ========================================================= */

const PaymentForm = {
  init() {
    const number = $('#card-number');
    const expiry = $('#card-expiry');
    const cvv = $('#card-cvv');

    number.addEventListener('input', () => {
      const digits = number.value.replace(/\D/g, '').slice(0, 16);
      number.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    });
    expiry.addEventListener('input', () => {
      const digits = expiry.value.replace(/\D/g, '').slice(0, 4);
      expiry.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    });
    cvv.addEventListener('input', () => { cvv.value = cvv.value.replace(/\D/g, '').slice(0, 3); });
  },

  read() {
    return {
      cardholder_name: $('#card-name').value.trim(),
      card_number: $('#card-number').value.replace(/\s/g, ''),
      expiry: $('#card-expiry').value.trim(),
      cvv: $('#card-cvv').value.trim()
    };
  },

  /* يعيد رسالة خطأ أو نصاً فارغاً (نفس قواعد التحقق في الخادم) */
  validate(card) {
    if (!card.cardholder_name || !card.card_number || !card.expiry || !card.cvv) return 'يرجى تعبئة جميع بيانات البطاقة.';
    if (card.cardholder_name.length < 3 || /\d/.test(card.cardholder_name)) return 'اسم صاحب البطاقة غير صحيح.';
    if (!/^\d{16}$/.test(card.card_number)) return 'رقم البطاقة يجب أن يتكون من 16 رقماً.';
    const m = card.expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return 'تاريخ انتهاء البطاقة يجب أن يكون بالصيغة MM/YY.';
    const now = new Date();
    const year = 2000 + Number(m[2]);
    const month = Number(m[1]);
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'البطاقة منتهية الصلاحية.';
    if (year > now.getFullYear() + 20) return 'تاريخ انتهاء البطاقة غير صحيح.';
    if (!/^\d{3}$/.test(card.cvv)) return 'رمز CVV يجب أن يتكون من 3 أرقام.';
    return '';
  },

  /* مسح الحقول بعد الاستخدام حتى لا تبقى بيانات البطاقة في الصفحة */
  clear() {
    ['#card-name', '#card-number', '#card-expiry', '#card-cvv'].forEach(sel => { $(sel).value = ''; });
  }
};
