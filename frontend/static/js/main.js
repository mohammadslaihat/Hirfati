/* =========================================================
   حِرفتي — الدوال المشتركة لجميع الصفحات
   (الرأس، القوائم، الصلاحيات، النوافذ، والعناصر المتكررة)
   ========================================================= */

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

const ROLE_LABEL = { customer: 'عميل', craftsman: 'حرفي', admin: 'أدمن' };

const REQUEST_STATUS = {
  pending:        { label: 'قيد الانتظار',          cls: 'st-pending' },
  quoted:         { label: 'تم إرسال عرض السعر',     cls: 'st-quoted' },
  in_progress:    { label: 'جارٍ التنفيذ',           cls: 'st-progress' },
  completed:      { label: 'مكتمل',                  cls: 'st-done' },
  rejected:       { label: 'مرفوض',                  cls: 'st-rejected' },
  quote_rejected: { label: 'تم رفض عرض السعر',      cls: 'st-rejected' }
};

const COMPLAINT_STATUS = {
  new:        { label: 'جديدة',           cls: 'st-pending' },
  processing: { label: 'قيد المعالجة',    cls: 'st-progress' },
  resolved:   { label: 'تمت المعالجة',    cls: 'st-done' }
};

/* ---------- تهيئة الصفحة ---------- */

const App = {
  root: document.body.dataset.root || '',
  role: document.body.dataset.role || '',
  page: document.body.dataset.page || '',
  user: null,

  /* تحميل المستخدم الحالي ثم تشغيل دالة الصفحة من ملف JavaScript الخاص بها.
     (الخادم يمنع فتح صفحات نوع حساب آخر، وهذا تحقق إضافي في الواجهة) */
  async run(pages) {
    try {
      if (this.role) {
        this.user = await Api.me();
        if (this.user.role !== this.role) {
          location.replace(this.root + 'login.html');
          return;
        }
        renderHeader();
      }
      const fn = pages[this.page];
      if (fn) await fn();
    } catch (e) {
      if (e.status !== 401) toast(e.message, 'error');
    }
  }
};

renderFooter();

function renderHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const links = NAV[App.role] || [];
  const brandSuffix = App.role === 'admin' ? '<span class="brand-tag">لوحة التحكم</span>' : '';
  header.className = 'site-header';
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

  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  header.querySelector('#logout-btn').addEventListener('click', async () => {
    try { await Api.logout(); } catch (e) { /* نكمل الخروج */ }
    location.href = App.root + 'index.html';
  });
}

function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="container">© ${new Date().getFullYear()} حِرفتي — منصة تربط العملاء بالحرفيين في الأردن</div>`;
}

/* ---------- دوال مساعدة عامة ---------- */

function $(selector, scope = document) { return scope.querySelector(selector); }
function $all(selector, scope = document) { return Array.from(scope.querySelectorAll(selector)); }

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function getParam(name) { return new URLSearchParams(location.search).get(name) || ''; }

function yearsText(n) {
  n = Number(n) || 0;
  if (n === 0) return 'أقل من سنة';
  if (n === 1) return 'سنة واحدة';
  if (n === 2) return 'سنتان';
  if (n <= 10) return n + ' سنوات';
  return n + ' سنة';
}

function money(value) { return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

/* يقبل أرقام الهواتف الأردنية: +9627XXXXXXXX */
function isJordanPhone(phone) { return /^\+9627[789]\d{7}$/.test(phone.trim()); }

/* قائمة المحافظات مجمّعة حسب الأقاليم */
function fillGovernorateSelect(select, placeholder) {
  const regions = [...new Set(GOVERNORATES.map(g => g.region))];
  select.innerHTML = (placeholder !== undefined ? `<option value="">${placeholder}</option>` : '') +
    regions.map(r => `<optgroup label="${r}">${
      GOVERNORATES.filter(g => g.region === r).map(g => `<option value="${g.id}">${g.name}</option>`).join('')
    }</optgroup>`).join('');
}

/* قائمة فلترة الخدمات: الأساسية + «خدمات أخرى» (الكل + الخدمات التي أضافها الحرفيون) */
function fillServiceFilter(select, services, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` +
    services.main.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') +
    `<optgroup label="خدمات أخرى">
       <option value="other">جميع الخدمات الأخرى</option>
       ${services.other.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
     </optgroup>`;
}

/* قائمة المهنة للحرفي: المهن الأساسية + خيار «خدمات أخرى» مع حقل لكتابة اسم الخدمة */
function fillProfessionSelect(select, mainServices) {
  select.innerHTML = '<option value="">اختر المهنة</option>' +
    mainServices.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') +
    '<option value="other">خدمات أخرى (اكتب اسم خدمتك)</option>';
}

/* ---------- عناصر العرض المتكررة ---------- */

function premiumBadge() { return '<span class="badge-premium" title="حرفي مميز">★ Premium</span>'; }

function starsHtml(rating) {
  if (!rating) return '<span class="muted small">لا توجد تقييمات بعد</span>';
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return `<span class="stars" style="--pct:${pct}%" aria-label="التقييم ${rating} من 5"></span>
          <strong class="rating-num">${Number(rating).toFixed(1)}</strong>`;
}

function statusBadge(status, map = REQUEST_STATUS) {
  const s = map[status] || { label: status, cls: '' };
  return `<span class="status ${s.cls}">${s.label}</span>`;
}

function avatar(name, size = '') {
  const letter = (name || '?').trim().charAt(0);
  return `<span class="avatar ${size}" aria-hidden="true">${esc(letter)}</span>`;
}

/* اسم المهنة كما يظهر للعملاء (خدمات أخرى يظهر معها اسم الخدمة التي كتبها الحرفي) */
function professionLabel(c) {
  return c.profession_category === 'other'
    ? `<span class="other-tag">خدمات أخرى</span> ${esc(c.profession)}`
    : esc(c.profession);
}

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

/* الملف الشخصي كما يظهر للعملاء (يُستخدم في صفحة العميل وفي معاينة الحرفي) */
function profileViewHtml(c) {
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

function emptyState(text) { return `<div class="empty">${text}</div>`; }

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

/* ---------- النوافذ المنبثقة والتنبيهات ---------- */

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('no-scroll');
  const first = modal.querySelector('input, select, textarea, button');
  if (first) first.focus();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('no-scroll');
}

/* إغلاق النافذة عند الضغط على الخلفية أو زر الإغلاق أو مفتاح Esc */
document.addEventListener('click', e => {
  const closer = e.target.closest('[data-close-modal]');
  if (closer) closeModal(closer.closest('.modal').id);
  else if (e.target.classList.contains('modal')) closeModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $all('.modal:not([hidden])').forEach(m => closeModal(m.id));
});

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

/* رسالة تأكيد بخياري «نعم» و«لا» — تعيد true عند اختيار نعم */
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

function showFormError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

/* تعطيل زر الإرسال أثناء انتظار رد الخادم */
async function withBusy(button, task) {
  if (button) button.disabled = true;
  try { return await task(); } finally { if (button) button.disabled = false; }
}

/* ---------- نموذج الشكوى (مشترك بين العميل والحرفي) ---------- */

function initComplaintForm(requests, otherPartyName) {
  const form = $('#complaint-form');
  const select = $('#complaint-request');
  const error = $('#complaint-error');
  select.innerHTML = '<option value="">— بدون طلب محدد —</option>' +
    requests.map(r => `<option value="${r.id}">طلب #${r.id} — ${esc(otherPartyName(r))} — ${esc(r.service_name)}</option>`).join('');

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
  form.addEventListener('input', () => { $('#complaint-success').hidden = true; });
}
