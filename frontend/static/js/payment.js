// ملف نموذج الدفع التجريبي لاشتراك برو
// لا توجد بوابة دفع خارجية ولا يتم خصم أي مبلغ
// يتم التحقق من شكل البيانات هنا ثم في الخادم
// ولا تحفظ بيانات البطاقة في قاعدة البيانات
// هذا الكائن يجمع دوال نموذج الدفع ويستخدمه ملف صفحات الحرفي
const PaymentForm = {
  // تنسق الحقول تلقائياً أثناء الكتابة مع كل حرف يكتبه المستخدم
  init() {
    const number = $('#card-number');
    const expiry = $('#card-expiry');
    const cvv = $('#card-cvv');

    // رقم البطاقة نحذف منه كل ما ليس رقماً ونأخذ أول ستة عشر رقماً
    // ثم نضيف مسافة بعد كل أربعة أرقام
    number.addEventListener('input', () => {
      const digits = number.value.replace(/\D/g, '').slice(0, 16);
      number.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    });
    // تاريخ الانتهاء أربعة أرقام كحد أقصى
    // ونضيف الخط المائل تلقائياً بعد رقمي الشهر
    expiry.addEventListener('input', () => {
      const digits = expiry.value.replace(/\D/g, '').slice(0, 4);
      expiry.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    });
    // رمز الأمان أرقام فقط وبحد أقصى ثلاثة
    cvv.addEventListener('input', () => { cvv.value = cvv.value.replace(/\D/g, '').slice(0, 3); });
  },

  // تقرأ قيم الحقول في كائن بنفس أسماء الحقول التي يتوقعها الخادم
  // وتحذف المسافات من رقم البطاقة
  read() {
    return {
      cardholder_name: $('#card-name').value.trim(),
      card_number: $('#card-number').value.replace(/\s/g, ''),
      expiry: $('#card-expiry').value.trim(),
      cvv: $('#card-cvv').value.trim()
    };
  },

  // تتحقق من البيانات في المتصفح لعرض الخطأ فوراً قبل الإرسال
  // وتعيد رسالة الخطأ أو نصاً فارغاً
  // الخادم يكرر نفس الفحوصات
  validate(card) {
    if (!card.cardholder_name || !card.card_number || !card.expiry || !card.cvv) return 'يرجى تعبئة جميع بيانات البطاقة.';
    if (card.cardholder_name.length < 3 || /\d/.test(card.cardholder_name)) return 'اسم صاحب البطاقة غير صحيح.';
    if (!/^\d{16}$/.test(card.card_number)) return 'رقم البطاقة يجب أن يتكون من 16 رقماً.';
    // نفصل الشهر والسنة من تاريخ الانتهاء
    // وإذا لم يطابق الصيغة تكون النتيجة فارغة
    const m = card.expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return 'تاريخ انتهاء البطاقة يجب أن يكون بالصيغة MM/YY.';
    // نقارن تاريخ انتهاء البطاقة مع الشهر الحالي
    // إذا كانت السنة أقدم أو نفس السنة بشهر أقدم فالبطاقة منتهية
    const now = new Date();
    const year = 2000 + Number(m[2]);
    const month = Number(m[1]);
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'البطاقة منتهية الصلاحية.';
    if (year > now.getFullYear() + 20) return 'تاريخ انتهاء البطاقة غير صحيح.';
    if (!/^\d{3}$/.test(card.cvv)) return 'رمز CVV يجب أن يتكون من 3 أرقام.';
    return '';
  },

  // تمسح كل حقول البطاقة بعد الاستخدام حتى لا تبقى بياناتها في الصفحة
  clear() {
    ['#card-name', '#card-number', '#card-expiry', '#card-cvv'].forEach(sel => { $(sel).value = ''; });
  }
};
