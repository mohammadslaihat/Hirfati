/* =========================================================
   حِرفتي — الاتصال بالواجهة الخلفية (Flask API)
   كل البيانات تأتي من قاعدة بيانات MySQL عبر هذه الدوال.
   ========================================================= */

/* محافظات الأردن الاثنتا عشرة (نفس الرموز المستخدمة في الخادم) */
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

/* أيقونات الخدمات الأساسية (أي خدمة أخرى تأخذ الأيقونة الافتراضية) */
const SERVICE_ICONS = {
  'كهربائي': '⚡', 'سباك': '🚿', 'نجار': '🪚', 'دهان': '🎨', 'فني تكييف': '❄️',
  'فني صيانة': '🔧', 'بناء وترميم': '🧱', 'فني أقفال': '🔑'
};
const OTHER_ICON = '🛠️';
const OTHERS_GROUP_ICON = '➕';
const PRO_PRICE_USD = 10;

function serviceIcon(name) { return SERVICE_ICONS[name] || OTHER_ICON; }
function govName(id) { const g = GOVERNORATES.find(x => x.id === id); return g ? g.name : '—'; }

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function apiRequest(method, url, body) {
  const options = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    throw new ApiError('تعذر الاتصال بالخادم، يرجى التحقق من الاتصال والمحاولة مرة أخرى.', 0);
  }
  let data = null;
  try { data = await response.json(); } catch (e) { data = null; }

  if (response.status === 401 && url !== '/api/login') {
    location.href = '/login.html';
    throw new ApiError((data && data.error) || 'يجب تسجيل الدخول أولاً.', 401);
  }
  if (!response.ok) {
    throw new ApiError((data && data.error) || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.', response.status);
  }
  return data;
}

const Api = {
  /* الحسابات */
  me: () => apiRequest('GET', '/api/me'),
  login: (email, password) => apiRequest('POST', '/api/login', { email, password }),
  logout: () => apiRequest('POST', '/api/logout'),
  register: fields => apiRequest('POST', '/api/register', fields),

  /* الخدمات والحرفيون */
  services: () => apiRequest('GET', '/api/services'),
  craftsmen: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return apiRequest('GET', '/api/craftsmen' + (query ? '?' + query : ''));
  },
  craftsman: id => apiRequest('GET', '/api/craftsmen/' + encodeURIComponent(id)),

  /* العميل */
  createRequest: body => apiRequest('POST', '/api/requests', body),
  customerRequests: () => apiRequest('GET', '/api/customer/requests'),
  acceptOffer: id => apiRequest('POST', `/api/customer/requests/${id}/accept-offer`),
  rejectOffer: id => apiRequest('POST', `/api/customer/requests/${id}/reject-offer`),
  addReview: (id, rating, comment) => apiRequest('POST', `/api/customer/requests/${id}/review`, { rating, comment }),

  /* الحرفي */
  craftsmanProfile: () => apiRequest('GET', '/api/craftsman/profile'),
  updateCraftsmanProfile: body => apiRequest('PUT', '/api/craftsman/profile', body),
  craftsmanRequests: () => apiRequest('GET', '/api/craftsman/requests'),
  rejectRequest: (id, reason) => apiRequest('POST', `/api/craftsman/requests/${id}/reject`, { reason }),
  sendOffer: (id, offer) => apiRequest('POST', `/api/craftsman/requests/${id}/offer`, offer),
  completeRequest: id => apiRequest('POST', `/api/craftsman/requests/${id}/complete`),

  /* اشتراك الحرفي */
  subscription: () => apiRequest('GET', '/api/craftsman/subscription'),
  subscriptionPay: card => apiRequest('POST', '/api/craftsman/subscription/pay', card),
  subscriptionCancel: () => apiRequest('POST', '/api/craftsman/subscription/cancel'),

  /* الشكاوى */
  createComplaint: body => apiRequest('POST', '/api/complaints', body),

  /* الأدمن */
  adminRequests: () => apiRequest('GET', '/api/admin/requests'),
  adminComplaints: () => apiRequest('GET', '/api/admin/complaints'),
  adminUpdateComplaint: (id, status) => apiRequest('PUT', `/api/admin/complaints/${id}`, { status }),
  adminUsers: role => apiRequest('GET', '/api/admin/users?role=' + encodeURIComponent(role)),
  adminUser: id => apiRequest('GET', '/api/admin/users/' + encodeURIComponent(id)),
  adminSubscriptions: () => apiRequest('GET', '/api/admin/subscriptions'),
  adminSubscriptionHistory: id => apiRequest('GET', '/api/admin/subscriptions/' + encodeURIComponent(id))
};
