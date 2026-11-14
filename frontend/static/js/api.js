// ملف الاتصال بالواجهة الخلفية
// يحمل أولاً في كل الصفحات ويعرف الثوابت العامة ودالة الاتصال بالخادم
// كل البيانات تأتي من قاعدة البيانات عبر دوال هذا الملف
// مصفوفة محافظات الأردن الاثنتي عشرة
// كل عنصر فيه رمز المحافظة الذي يرسل للخادم واسمها للعرض والإقليم الذي تتبعه
// تستخدم لبناء قوائم اختيار المحافظة وتحويل الرمز إلى اسم
const GOVERNORATES = [
  { id: 'irbid',  name: 'إربد',    region: 'إقليم الشمال' },
  { id: 'jerash', name: 'جرش',     region: 'إقليم الشمال' },
  { id: 'ajloun', name: 'عجلون',   region: 'إقليم الشمال' },
  { id: 'mafraq', name: 'المفرق',  region: 'إقليم الشمال' },
  { id: 'amman',  name: 'عمّان',   region: 'إقليم الوسط' },
  { id: 'zarqa',  name: 'الزرقاء', region: 'إقليم الوسط' },
  { id: 'balqa',  name: 'البلقاء', region: 'إقليم الوسط' },
  { id: 'madaba', name: 'مادبا',   region: 'إقليم الوسط' },
  { id: 'karak',  name: 'الكرك',   region: 'إقليم الجنوب' },
  { id: 'maan',   name: 'معان',    region: 'إقليم الجنوب' },
  { id: 'tafila', name: 'الطفيلة', region: 'إقليم الجنوب' },
  { id: 'aqaba',  name: 'العقبة',  region: 'إقليم الجنوب' }
];

// كائن يربط اسم كل خدمة أساسية برمز تعبيري يظهر في بطاقة الخدمة
const SERVICE_ICONS = {
  'كهربائي': '⚡', 'سباك': '🚿', 'نجار': '🪚', 'دهان': '🎨', 'فني تكييف': '❄️',
  'فني صيانة': '🔧', 'بناء وترميم': '🧱', 'فني أقفال': '🔑'
};
// الرمز الافتراضي لأي خدمة غير موجودة في القائمة السابقة
const OTHER_ICON = '🛠️';
// رمز مجموعة الخدمات الأخرى
const OTHERS_GROUP_ICON = '➕';
// سعر اشتراك برو للعرض في الواجهة
const PRO_PRICE_USD = 10;

// تعيد رمز الخدمة وإذا لم يوجد تعيد الرمز الافتراضي
function serviceIcon(name) { return SERVICE_ICONS[name] || OTHER_ICON; }
// تعيد اسم المحافظة العربي من رمزها
// تبحث عن أول عنصر يطابق الرمز وإذا لم تجده تعيد علامة فارغة
function govName(id) { const g = GOVERNORATES.find(x => x.id === id); return g ? g.name : '—'; }

// تعيد تاريخ اليوم كنص بصيغة السنة ثم الشهر ثم اليوم
// يستخدم كحد أدنى لحقل موعد التنفيذ
// الشهر في جافاسكربت يبدأ من صفر لذلك نضيف واحداً
// ونضيف صفراً في بداية الرقم المكون من خانة واحدة
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// كلاس خطأ خاص بطلبات الخادم يرث من كلاس الخطأ العام
// يضيف رمز حالة الطلب لمعرفة نوع الخطأ
class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// الدالة المركزية لكل الاتصالات مع الخادم
// تستقبل نوع الطلب والرابط والبيانات المرسلة إن وجدت
// الدالة غير متزامنة فتنتظر رد الخادم دون أن تتجمد الصفحة
// تعيد البيانات القادمة من الخادم أو ترمي خطأ برسالة عربية عند الفشل
async function apiRequest(method, url, body) {
  // نرسل ملف الجلسة مع الطلب حتى يعرف الخادم من هو المستخدم
  // إذا كانت هناك بيانات نحولها إلى نص بصيغة جيسون ونحدد نوع المحتوى
  const options = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  // نرسل الطلب فعلياً
  // إذا فشل الاتصال بسبب انقطاع الشبكة أو توقف الخادم نرمي خطأ برسالة مفهومة
  try {
    response = await fetch(url, options);
  } catch (e) {
    throw new ApiError('تعذر الاتصال بالخادم، يرجى التحقق من الاتصال والمحاولة مرة أخرى.', 0);
  }
  let data = null;
  // نحول رد الخادم من جيسون إلى كائن وإذا لم يكن الرد بهذه الصيغة تبقى البيانات فارغة
  try { data = await response.json(); } catch (e) { data = null; }

  // الرمز 401 يعني أن الجلسة انتهت أو أن المستخدم لم يسجل دخوله
  // فنحوله إلى صفحة تسجيل الدخول
  // إلا إذا كان الطلب نفسه هو تسجيل الدخول فنعرض رسالة الخطأ فقط
  if (response.status === 401 && url !== '/api/login') {
    location.href = '/login.html';
    throw new ApiError((data && data.error) || 'يجب تسجيل الدخول أولاً.', 401);
  }
  // أي رمز خطأ آخر نرمي معه خطأ يحمل رسالة الخادم العربية إن وجدت
  if (!response.ok) {
    throw new ApiError((data && data.error) || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.', response.status);
  }
  return data;
}

// كائن يجمع دالة لكل مسار في الخادم
// تستدعيها الصفحات مباشرة بدلاً من تكرار كتابة الروابط
// كل دالة هنا قصيرة وتستدعي الدالة المركزية بالنوع والرابط المناسبين
const Api = {
  // دوال الحسابات
  me: () => apiRequest('GET', '/api/me'),
  login: (email, password) => apiRequest('POST', '/api/login', { email, password }),
  logout: () => apiRequest('POST', '/api/logout'),
  register: fields => apiRequest('POST', '/api/register', fields),

  // دوال الخدمات والحرفيين
  services: () => apiRequest('GET', '/api/services'),
  // تحول كائن الفلاتر إلى نص استعلام يضاف إلى الرابط
  // تحذف القيم الفارغة أولاً ثم تبني النص مع ترميز الأحرف الخاصة
  craftsmen: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return apiRequest('GET', '/api/craftsmen' + (query ? '?' + query : ''));
  },
  // ترميز القيمة قبل وضعها في الرابط
  craftsman: id => apiRequest('GET', '/api/craftsmen/' + encodeURIComponent(id)),

  // دوال العميل
  createRequest: body => apiRequest('POST', '/api/requests', body),
  customerRequests: () => apiRequest('GET', '/api/customer/requests'),
  acceptOffer: id => apiRequest('POST', `/api/customer/requests/${id}/accept-offer`),
  rejectOffer: id => apiRequest('POST', `/api/customer/requests/${id}/reject-offer`),
  addReview: (id, rating, comment) => apiRequest('POST', `/api/customer/requests/${id}/review`, { rating, comment }),

  // دوال الحرفي
  craftsmanProfile: () => apiRequest('GET', '/api/craftsman/profile'),
  updateCraftsmanProfile: body => apiRequest('PUT', '/api/craftsman/profile', body),
  craftsmanRequests: () => apiRequest('GET', '/api/craftsman/requests'),
  rejectRequest: (id, reason) => apiRequest('POST', `/api/craftsman/requests/${id}/reject`, { reason }),
  sendOffer: (id, offer) => apiRequest('POST', `/api/craftsman/requests/${id}/offer`, offer),
  completeRequest: id => apiRequest('POST', `/api/craftsman/requests/${id}/complete`),

  // دوال اشتراك الحرفي
  subscription: () => apiRequest('GET', '/api/craftsman/subscription'),
  subscriptionPay: card => apiRequest('POST', '/api/craftsman/subscription/pay', card),
  subscriptionCancel: () => apiRequest('POST', '/api/craftsman/subscription/cancel'),

  // دالة الشكاوى
  createComplaint: body => apiRequest('POST', '/api/complaints', body),

  // دوال الأدمن
  adminRequests: () => apiRequest('GET', '/api/admin/requests'),
  adminComplaints: () => apiRequest('GET', '/api/admin/complaints'),
  adminUpdateComplaint: (id, status) => apiRequest('PUT', `/api/admin/complaints/${id}`, { status }),
  adminUsers: role => apiRequest('GET', '/api/admin/users?role=' + encodeURIComponent(role)),
  adminUser: id => apiRequest('GET', '/api/admin/users/' + encodeURIComponent(id)),
  adminSubscriptions: () => apiRequest('GET', '/api/admin/subscriptions'),
  adminSubscriptionHistory: id => apiRequest('GET', '/api/admin/subscriptions/' + encodeURIComponent(id))
};
