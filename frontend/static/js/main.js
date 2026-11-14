// ملف الدوال المشتركة لجميع الصفحات
// يحمل في كل الصفحات بعد ملف الاتصال بالخادم
// يحتوي الشريط العلوي والقوائم والنوافذ والعناصر المتكررة
// روابط القائمة العلوية لكل نوع حساب
// اسم الصفحة يقارن مع اسم الصفحة الحالية لتمييز رابطها
const NAV = {
  customer: [
    { page: 'home',        href: 'home.html',        label: 'الرئيسية' },
    { page: 'services',    href: 'services.html',    label: 'الخدمات' },
    { page: 'craftsmen',   href: 'craftsmen.html',   label: 'الحرفيون' },
    { page: 'complaints',  href: 'complaints.html',  label: 'الشكاوى' },
    { page: 'my-requests', href: 'my-requests.html', label: 'الملف الشخصي وطلباتي' }
  ],
  craftsman: [
    { page: 'profile',    href: 'profile.html',    label: 'الملف الشخصي' },
    { page: 'requests',   href: 'requests.html',   label: 'الطلبات' },
    { page: 'complaints', href: 'complaints.html', label: 'الشكاوى' }
  ],
  admin: [
    { page: 'requests',      href: 'requests.html',      label: 'إدارة الطلبات' },
    { page: 'complaints',    href: 'complaints.html',    label: 'إدارة الشكاوى' },
    { page: 'users',         href: 'users.html',         label: 'إدارة المستخدمين' },
    { page: 'subscriptions', href: 'subscriptions.html', label: 'مراقبة الاشتراكات' }
  ]
};

// أسماء أنواع الحسابات بالعربية للعرض
const ROLE_LABEL = { customer: 'عميل', craftsman: 'حرفي', admin: 'أدمن' };

// لكل حالة طلب النص العربي الذي يظهر واسم التنسيق الذي يحدد لون الشارة
const REQUEST_STATUS = {
  pending:        { label: 'قيد الانتظار',          cls: 'st-pending' },
  quoted:         { label: 'تم إرسال عرض السعر',     cls: 'st-quoted' },
  in_progress:    { label: 'جارٍ التنفيذ',           cls: 'st-progress' },
  completed:      { label: 'مكتمل',                  cls: 'st-done' },
  rejected:       { label: 'مرفوض',                  cls: 'st-rejected' },
  quote_rejected: { label: 'تم رفض عرض السعر',      cls: 'st-rejected' }
};

// نفس الفكرة لحالات الشكاوى
const COMPLAINT_STATUS = {
  new:        { label: 'جديدة',           cls: 'st-pending' },
  processing: { label: 'قيد المعالجة',    cls: 'st-progress' },
  resolved:   { label: 'تمت المعالجة',    cls: 'st-done' }
};

// قسم تهيئة الصفحة
// كائن يحفظ معلومات الصفحة الحالية ويقرؤها من خصائص وسم الجسم
// المسار الجذري للعودة إلى المجلد الرئيسي
// ونوع الحساب المطلوب لفتح الصفحة واسم الصفحة والمستخدم الحالي
const App = {
  root: document.body.dataset.root || '',
  role: document.body.dataset.role || '',
  page: document.body.dataset.page || '',
  user: null,

  // نقطة بداية كل صفحة
  // تستقبل كائناً يربط اسم كل صفحة بالدالة الخاصة بها
  // ثم تشغل الدالة التي تطابق الصفحة الحالية
  // الخادم يمنع فتح صفحات نوع حساب آخر وهذا تحقق إضافي في الواجهة
  async run(pages) {
    try {
      // إذا كانت الصفحة تحتاج تسجيل دخول نجلب المستخدم الحالي من الخادم
      // إذا كان نوع حسابه مختلفاً نحوله إلى صفحة تسجيل الدخول
      // وإلا نرسم الشريط العلوي
      if (this.role) {
        this.user = await Api.me();
        if (this.user.role !== this.role) {
          location.replace(this.root + 'login.html');
          return;
        }
        renderHeader();
      }
      // نبحث عن دالة الصفحة الحالية وننفذها وننتظر انتهاءها
      const fn = pages[this.page];
      if (fn) await fn();
    // أي خطأ يظهر كرسالة منبثقة
    // إلا خطأ عدم تسجيل الدخول لأن المستخدم يتحول تلقائياً إلى صفحة الدخول
    } catch (e) {
      if (e.status !== 401) toast(e.message, 'error');
    }
  }
};

// رسم التذييل فوراً عند تحميل الملف في كل الصفحات
renderFooter();

// ترسم الشريط العلوي داخل العنصر المخصص له
// فيه الشعار وروابط القائمة واسم المستخدم وزر الخروج
function renderHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const links = NAV[App.role] || [];
  const brandSuffix = App.role === 'admin' ? '<span class="brand-tag">لوحة التحكم</span>' : '';
  header.className = 'site-header';
  // نضع محتوى الشريط داخل العنصر باستخدام قالب نصي
  // كل رابط يتحول إلى وسم رابط ويميز رابط الصفحة الحالية
  // اسم المستخدم يمر عبر دالة الحماية لمنع إدخال كود ضار
  header.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="${links[0].href}">حِرفتي ${brandSuffix}</a>
      <button class="nav-toggle" type="button" aria-label="فتح القائمة" aria-expanded="false">☰</button>
      <nav class="nav" id="main-nav">
        ${links.map(l => `<a href="${l.href}" class="${l.page === App.page ? 'active' : ''}">${l.label}</a>`).join('')}
        <div class="nav-user">
          <span class="nav-user-name">${esc(App.user.name)}</span>
          <button type="button" class="btn btn-outline btn-sm" id="logout-btn">تسجيل الخروج</button>
        </div>
      </nav>
    </div>`;

  // زر القائمة في الجوال
  // عند الضغط نضيف أو نحذف تنسيق الفتح فتظهر القائمة أو تختفي
  // ونخبر قارئات الشاشة بحالة القائمة
  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  // زر تسجيل الخروج يرسل طلب الخروج للخادم
  // وحتى لو فشل الطلب ننتقل إلى صفحة البداية
  header.querySelector('#logout-btn').addEventListener('click', async () => {
    try { await Api.logout(); } catch (e) {  }
    location.href = App.root + 'index.html';
  });
}

// ترسم التذييل مع السنة الحالية تلقائياً
function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="container">© ${new Date().getFullYear()} حِرفتي — منصة تربط العملاء بالحرفيين في الأردن</div>`;
}

// قسم الدوال المساعدة العامة
// دالة مختصرة تعيد أول عنصر يطابق المحدد
function $(selector, scope = document) { return scope.querySelector(selector); }
// دالة مختصرة تعيد كل العناصر المطابقة في مصفوفة
function $all(selector, scope = document) { return Array.from(scope.querySelectorAll(selector)); }

// دالة الحماية من إدخال الكود الضار
// تحول الرموز الخاصة في لغة الصفحات إلى رموز آمنة
// تستخدم قبل وضع أي نص قادم من المستخدم داخل الصفحة
// القيمة الفارغة تتحول إلى نص فارغ
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// تقرأ قيمة من رابط الصفحة الحالية حسب اسمها
// مثل رقم الحرفي في رابط صفحة ملفه
function getParam(name) { return new URLSearchParams(location.search).get(name) || ''; }

// تكتب سنوات الخبرة بصيغة عربية صحيحة حسب العدد
function yearsText(n) {
  n = Number(n) || 0;
  if (n === 0) return 'أقل من سنة';
  if (n === 1) return 'سنة واحدة';
  if (n === 2) return 'سنتان';
  if (n <= 10) return n + ' سنوات';
  return n + ' سنة';
}

// تنسق المبلغ بأرقام إنجليزية وبحد أقصى رقمين بعد الفاصلة العشرية
function money(value) { return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

// تتحقق أن رقم الهاتف أردني بنفس النمط المستخدم في الخادم
function isJordanPhone(phone) { return /^\+9627[789]\d{7}$/.test(phone.trim()); }

// تملأ قائمة الاختيار بالمحافظات مجمعة حسب الإقليم
// نستخرج أسماء الأقاليم دون تكرار
// ونضيف خياراً أول فارغاً إذا طلب ذلك
function fillGovernorateSelect(select, placeholder) {
  const regions = [...new Set(GOVERNORATES.map(g => g.region))];
  select.innerHTML = (placeholder !== undefined ? `<option value="">${placeholder}</option>` : '') +
    regions.map(r => `<optgroup label="${r}">${
      GOVERNORATES.filter(g => g.region === r).map(g => `<option value="${g.id}">${g.name}</option>`).join('')
    }</optgroup>`).join('');
}

// تملأ قائمة فلترة الخدمات
// الخدمات الأساسية أولاً ثم مجموعة الخدمات الأخرى
// وفيها خيار جميع الخدمات الأخرى ثم كل خدمة أخرى موجودة
function fillServiceFilter(select, services, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` +
    services.main.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') +
    `<optgroup label="خدمات أخرى">
       <option value="other">جميع الخدمات الأخرى</option>
       ${services.other.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
     </optgroup>`;
}

// تملأ قائمة المهنة في نموذج الحرفي
// المهن الأساسية ثم خيار الخدمات الأخرى الذي يظهر حقلاً لكتابة اسم الخدمة
function fillProfessionSelect(select, mainServices) {
  select.innerHTML = '<option value="">اختر المهنة</option>' +
    mainServices.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') +
    '<option value="other">خدمات أخرى (اكتب اسم خدمتك)</option>';
}

// قسم عناصر العرض المتكررة
// تعيد شارة بريميوم التي تظهر بجانب اسم الحرفي المشترك في برو
function premiumBadge() { return '<span class="badge-premium" title="حرفي مميز">★ Premium</span>'; }

// تعرض التقييم على شكل نجوم
// نحسب نسبة التقييم من خمسة ونمررها لملف التنسيق فيلون هذا الجزء من النجوم
// إذا لم يوجد تقييم نعرض نصاً بدلاً من النجوم
function starsHtml(rating) {
  if (!rating) return '<span class="muted small">لا توجد تقييمات بعد</span>';
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return `<span class="stars" style="--pct:${pct}%" aria-label="التقييم ${rating} من 5"></span>
          <strong class="rating-num">${Number(rating).toFixed(1)}</strong>`;
}

// تعيد شارة حالة ملونة حسب قاموس الحالات المحدد
function statusBadge(status, map = REQUEST_STATUS) {
  const s = map[status] || { label: status, cls: '' };
  return `<span class="status ${s.cls}">${s.label}</span>`;
}

// تعيد صورة رمزية بسيطة فيها أول حرف من الاسم داخل دائرة
function avatar(name, size = '') {
  const letter = (name || '?').trim().charAt(0);
  return `<span class="avatar ${size}" aria-hidden="true">${esc(letter)}</span>`;
}

// تعيد اسم مهنة الحرفي كما يظهر للعملاء
// إذا كانت مهنته من الخدمات الأخرى نعرض وسماً يوضح ذلك قبل اسم الخدمة
function professionLabel(c) {
  return c.profession_category === 'other'
    ? `<span class="other-tag">خدمات أخرى</span> ${esc(c.profession)}`
    : esc(c.profession);
}

// تعيد بطاقة الحرفي التي تظهر في القوائم
// فيها الاسم مع شارة بريميوم للمشترك في برو والمهنة والموقع والخبرة والتقييم
// وزر يفتح ملفه الشخصي مع رقمه في الرابط
function craftsmanCard(c, profileHref = 'craftsman-profile.html') {
  return `
    <article class="card craftsman-card">
      <div class="craftsman-card-head">
        ${avatar(c.name)}
        <div>
          <h3 class="craftsman-name">${esc(c.name)} ${c.subscription_type === 'pro' ? premiumBadge() : ''}</h3>
          <p class="muted">${professionLabel(c)}</p>
        </div>
      </div>
      <ul class="meta-list">
        <li><span>الموقع</span><strong>${govName(c.governorate)}</strong></li>
        <li><span>الخبرة</span><strong>${yearsText(c.experience_years)}</strong></li>
        <li><span>التقييم</span><span class="rating">${starsHtml(c.rating)}</span></li>
      </ul>
      <a class="btn btn-primary btn-block" href="${profileHref}?id=${c.id}">عرض الملف الشخصي</a>
    </article>`;
}

// تعيد الملف الشخصي الكامل للحرفي كما يراه العميل
// تستخدم في صفحة العميل وفي معاينة الحرفي لملفه
function profileViewHtml(c) {
  // دالة داخلية تحول قائمة نصوص إلى وسوم
  // أو تعرض عبارة لم تتم الإضافة بعد إذا كانت القائمة فارغة
  const tags = list => list && list.length
    ? `<ul class="tags">${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '<p class="muted">لم تتم الإضافة بعد.</p>';
  const reviews = c.reviews || [];

  return `
    <div class="profile-head">
      ${avatar(c.name, 'avatar-lg')}
      <div>
        <h1 class="profile-name">${esc(c.name)} ${c.subscription_type === 'pro' ? premiumBadge() : ''}</h1>
        <p class="muted">${professionLabel(c)}</p>
        <div class="rating">${starsHtml(c.rating)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item"><span>رقم الهاتف</span><strong dir="ltr">${esc(c.phone)}</strong></div>
      <div class="info-item"><span>سنوات الخبرة</span><strong>${yearsText(c.experience_years)}</strong></div>
      <div class="info-item"><span>الموقع</span><strong>${govName(c.governorate)}</strong></div>
      <div class="info-item"><span>نوع الحساب</span><strong>${c.subscription_type === 'pro' ? 'Premium' : 'عادي'}</strong></div>
    </div>

    <section class="profile-section">
      <h2>النبذة الشخصية</h2>
      <p>${c.bio ? esc(c.bio) : '<span class="muted">لم تتم إضافة نبذة بعد.</span>'}</p>
    </section>

    <section class="profile-section">
      <h2>الخدمات التي يقدمها</h2>
      ${tags((c.services || []).map(s => s.name))}
    </section>

    <section class="profile-section">
      <h2>مناطق العمل</h2>
      ${tags((c.work_areas || []).map(govName))}
    </section>

    <section class="profile-section">
      <h2>التقييمات</h2>
      ${reviews.length ? `<div class="reviews">${reviews.map(r => `
        <div class="review">
          <div class="review-head">
            <strong>${esc(r.customer_name)}</strong>
            <span class="stars" style="--pct:${r.rating * 20}%" aria-label="${r.rating} من 5"></span>
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
          <span class="muted small">${esc(r.created_at)}</span>
        </div>`).join('')}</div>` : '<p class="muted">لا توجد تقييمات بعد.</p>'}
    </section>`;
}

// تعيد مربع رسالة يظهر عندما لا توجد بيانات
function emptyState(text) { return `<div class="empty">${text}</div>`; }

// تعيد صندوق عرض السعر بالتكلفة والمدة وموعد التنفيذ
// وإذا لم يوجد عرض تعيد نصاً فارغاً
function offerBlock(offer, title) {
  if (!offer) return '';
  return `
    <div class="quote-box">
      <h4>${title}</h4>
      <div class="request-fields">
        <div><span>التكلفة</span><strong>${money(offer.price)} دينار أردني</strong></div>
        <div><span>المدة</span><strong>${esc(offer.execution_time)}</strong></div>
        <div><span>موعد التنفيذ</span><strong>${esc(offer.execution_date)}</strong></div>
      </div>
    </div>`;
}

// قسم النوافذ المنبثقة والتنبيهات
// تفتح النافذة المنبثقة وتمنع تمرير الصفحة خلفها
// وتضع المؤشر على أول حقل فيها
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('no-scroll');
  const first = modal.querySelector('input, select, textarea, button');
  if (first) first.focus();
}

// تغلق النافذة وتعيد تمرير الصفحة
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('no-scroll');
}

// مستمع واحد على الصفحة كلها يغلق النوافذ
// عند الضغط على زر الإغلاق نغلق النافذة التي يقع داخلها
// أو عند الضغط على الخلفية الداكنة نفسها
document.addEventListener('click', e => {
  const closer = e.target.closest('[data-close-modal]');
  if (closer) closeModal(closer.closest('.modal').id);
  else if (e.target.classList.contains('modal')) closeModal(e.target.id);
});
// مفتاح الهروب يغلق كل النوافذ المفتوحة
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $all('.modal:not([hidden])').forEach(m => closeModal(m.id));
});

// تعرض رسالة تنبيه صغيرة أسفل الشاشة ثم تخفيها بعد ثلاث ثوان
// تنشئ عنصر التنبيه مرة واحدة إذا لم يكن موجوداً
// نوع الرسالة نجاح أو خطأ ويحدد لونها
// نلغي المؤقت السابق حتى لا تختفي الرسالة الجديدة مبكراً
function toast(message, type = 'success') {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.className = 'toast show ' + type;
  clearTimeout(box._timer);
  box._timer = setTimeout(() => { box.className = 'toast ' + type; }, 3000);
}

// تعرض نافذة تأكيد بزري نعم ولا
// تنشأ النافذة مرة واحدة ثم يعاد استخدامها
// نضع نص السؤال كنص عادي بشكل آمن
function confirmDialog(message) {
  let modal = document.getElementById('confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'confirm-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-box confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-message">
        <p id="confirm-message"></p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-answer="yes">نعم</button>
          <button type="button" class="btn btn-ghost" data-answer="no">لا</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  $('#confirm-message', modal).textContent = message;
  openModal('confirm-modal');
  $('[data-answer="no"]', modal).focus();

  // تعيد وعداً ينتظر اختيار المستخدم
  // دالة الإنهاء تزيل المستمعين وتغلق النافذة
  // وتعيد صحيح عند اختيار نعم وخطأ عند اختيار لا أو الضغط خارج النافذة
  return new Promise(resolve => {
    function finish(answer) {
      modal.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      closeModal('confirm-modal');
      resolve(answer);
    }
    function onClick(e) {
      const btn = e.target.closest('[data-answer]');
      if (btn) finish(btn.dataset.answer === 'yes');
      else if (e.target === modal) finish(false);
    }
    function onKey(e) { if (e.key === 'Escape') finish(false); }
    modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

// تعرض رسالة الخطأ في النموذج أو تخفي العنصر إذا كانت الرسالة فارغة
function showFormError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

// تعطل الزر أثناء انتظار رد الخادم لمنع إرسال الطلب مرتين
// وتعيد تفعيله في كل الأحوال بعد انتهاء العملية
async function withBusy(button, task) {
  if (button) button.disabled = true;
  try { return await task(); } finally { if (button) button.disabled = false; }
}

// قسم نموذج الشكوى المشترك بين العميل والحرفي
// تستقبل طلبات المستخدم لاختيار الطلب المتعلق بالشكوى
// وتستقبل دالة تعيد اسم الطرف الآخر في الطلب
function initComplaintForm(requests, otherPartyName) {
  const form = $('#complaint-form');
  const select = $('#complaint-request');
  const error = $('#complaint-error');
  select.innerHTML = '<option value="">— بدون طلب محدد —</option>' +
    requests.map(r => `<option value="${r.id}">طلب #${r.id} — ${esc(otherPartyName(r))} — ${esc(r.service_name)}</option>`).join('');

  // عند إرسال النموذج نمنع المتصفح من إعادة تحميل الصفحة
  // ثم نتحقق من طول التفاصيل ونرسل الشكوى للخادم
  // ثم نفرغ النموذج ونعرض رسالة النجاح
  // إذا لم يختر المستخدم طلباً نرسل قيمة فارغة
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const details = $('#complaint-details').value.trim();
    if (details.length < 10) return showFormError(error, 'يرجى كتابة تفاصيل الشكوى (10 أحرف على الأقل).');
    showFormError(error, '');
    try {
      await withBusy(form.querySelector('[type="submit"]'), () =>
        Api.createComplaint({ request_id: select.value || null, details }));
      form.reset();
      $('#complaint-success').hidden = false;
      toast('تم إرسال الشكوى إلى قسم الشكاوى والجودة');
    } catch (err) {
      showFormError(error, err.message);
    }
  });
  // عند بدء الكتابة من جديد نخفي رسالة النجاح السابقة
  form.addEventListener('input', () => { $('#complaint-success').hidden = true; });
}
