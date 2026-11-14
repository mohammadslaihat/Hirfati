// ملف صفحات لوحة تحكم الأدمن
// يحمل في صفحات مجلد الأدمن فقط
// كل تبويب في صفحة إدارة الطلبات يجمع أكثر من حالة
const REQUEST_GROUPS = {
  // المعلقة وهي التي تنتظر رد الحرفي أو موافقة العميل
  pending:  ['pending', 'quoted'],
  // المقبولة وهي التي تمت الموافقة عليها
  accepted: ['in_progress', 'completed'],
  // المرفوضة وهي التي رفضها الحرفي أو رفض العميل عرضها
  rejected: ['rejected', 'quote_rejected']
};

// حالات دورة الاشتراك بالعربية مع لون الشارة وهي فعال ومنتهي وملغى
const SUBSCRIPTION_STATUS = {
  active:    { label: 'فعال',  cls: 'st-done' },
  expired:   { label: 'منتهي', cls: 'st-rejected' },
  cancelled: { label: 'ملغى',  cls: 'st-pending' }
};

// تعيد خلية جدول فيها اسم الشخص ونوع حسابه أو علامة فارغة إذا لم يوجد
function personCell(name, role) {
  if (!name) return '<span class="muted">—</span>';
  return `${esc(name)}<span class="sub">${ROLE_LABEL[role] || ''}</span>`;
}

// تفتح نافذة التفاصيل المشتركة
// تستقبل العنوان وقائمة أزواج فيها اسم الحقل وقيمته
function showDetails(title, rows) {
  $('#details-title').textContent = title;
  $('#details-body').innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  openModal('details-modal');
}

// دالة عامة لجداول الأدمن مع تبويبات الفلترة
// تستقبل عناوين الأعمدة أو دالة تعيد عناوين مختلفة حسب التبويب
// وتستقبل دالة ترجع صفوف الجدول حسب الفلتر الحالي ورسالة الجدول الفارغ
// تعيد دالة الرسم لإعادة رسم الجدول عند الحاجة
function initTable({ head, rows, emptyText }) {
  const setHead = cols => { $('#table-head').innerHTML = `<tr>${cols.map(h => `<th>${h}</th>`).join('')}</tr>`; };
  // الفلتر الابتدائي هو التبويب النشط في الصفحة
  let filter = $('#tabs .tab.active').dataset.filter;

  // ترسم العناوين ثم الصفوف
  // وإذا لم توجد صفوف تعرض صفاً واحداً يمتد على كل الأعمدة وفيه الرسالة
  async function render() {
    const cols = typeof head === 'function' ? head(filter) : head;
    setHead(cols);
    const html = await rows(filter);
    $('#table-body').innerHTML = html.length
      ? html.join('')
      : `<tr><td colspan="${cols.length}" class="center muted">${emptyText}</td></tr>`;
  }

  // عند الضغط على تبويب نجعله النشط وحده ونحفظ فلتره ونعيد رسم الجدول
  $('#tabs').addEventListener('click', async e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    $all('#tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
    filter = tab.dataset.filter;
    try { await render(); } catch (err) { toast(err.message, 'error'); }
  });

  return render;
}

App.run({
  // صفحة إدارة الطلبات
  // نجلب كل الطلبات مرة واحدة والفلترة حسب التبويب تتم في المتصفح
  async requests() {
    const requests = await Api.adminRequests();

    // تبويب الكل يعرض جميع الطلبات
    // وباقي التبويبات تعرض الطلبات التي حالتها ضمن مجموعة التبويب
    const render = initTable({
      head: ['رقم الطلب', 'العميل', 'الحرفي', 'الخدمة', 'الموقع', 'التاريخ', 'الحالة', ''],
      emptyText: 'لا توجد طلبات في هذا القسم.',
      rows: filter => requests
        .filter(r => filter === 'all' || REQUEST_GROUPS[filter].includes(r.status))
        .map(r => `<tr>
          <td>#${r.id}</td>
          <td>${esc(r.customer_name)}</td>
          <td>${esc(r.craftsman_name)}</td>
          <td>${esc(r.service_name)}</td>
          <td>${esc(r.location)}</td>
          <td>${esc(r.created_at)}</td>
          <td>${statusBadge(r.status)}</td>
          <td><button type="button" class="btn btn-outline btn-sm" data-details="${r.id}">التفاصيل</button></td>
        </tr>`)
    });
    await render();

    // زر التفاصيل يبحث عن الطلب بالرقم المحفوظ في الزر ويعرض بياناته
    // ونضيف عرض السعر وسبب الرفض فقط إن وجدا
    $('#table-body').addEventListener('click', e => {
      const btn = e.target.closest('[data-details]');
      if (!btn) return;
      const r = requests.find(x => x.id === Number(btn.dataset.details));
      const rows = [
        ['رقم الطلب', '#' + r.id],
        ['العميل', esc(r.customer_name)],
        ['الحرفي', esc(r.craftsman_name)],
        ['نوع الخدمة', esc(r.service_name)],
        ['الموقع', esc(r.location)],
        ['وصف المشكلة', esc(r.description)],
        ['تاريخ الطلب', esc(r.created_at)],
        ['الحالة', statusBadge(r.status)]
      ];
      if (r.offer) {
        rows.push(['عرض السعر', `${money(r.offer.price)} دينار أردني — ${esc(r.offer.execution_time)} — موعد التنفيذ ${esc(r.offer.execution_date)}`]);
      }
      if (r.status === 'rejected') rows.push(['سبب الرفض', esc(r.reject_reason)]);
      showDetails('تفاصيل الطلب #' + r.id, rows);
    });
  },

  // صفحة إدارة الشكاوى
  // دالة مختصرة تبني خيارات قائمة تحديث الحالة وتحدد الحالة الحالية
  async complaints() {
    let complaints = await Api.adminComplaints();
    const statusOptions = selected => Object.entries(COMPLAINT_STATUS)
      .map(([key, s]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${s.label}</option>`).join('');

    const render = initTable({
      head: ['رقم الشكوى', 'صاحب الشكوى', 'المشتكى عليه', 'التاريخ', 'الحالة', 'تحديث الحالة', ''],
      emptyText: 'لا توجد شكاوى في هذا القسم.',
      rows: filter => complaints
        .filter(c => filter === 'all' || c.status === filter)
        .map(c => `<tr>
          <td>#${c.id}</td>
          <td>${personCell(c.complainant_name, c.complainant_role)}</td>
          <td>${personCell(c.accused_name, c.accused_role)}</td>
          <td>${esc(c.created_at)}</td>
          <td>${statusBadge(c.status, COMPLAINT_STATUS)}</td>
          <td><select data-status="${c.id}" aria-label="تحديث حالة الشكوى #${c.id}">${statusOptions(c.status)}</select></td>
          <td><button type="button" class="btn btn-outline btn-sm" data-details="${c.id}">التفاصيل</button></td>
        </tr>`)
    });
    await render();

    // عند تغيير حالة شكوى من القائمة نعطل القائمة أثناء الحفظ
    // ثم نرسل الحالة الجديدة للخادم
    // ثم نجلب الشكاوى من جديد ونعيد رسم الجدول لأن الشكوى قد تنتقل لتبويب آخر
    $('#table-body').addEventListener('change', async e => {
      const select = e.target.closest('[data-status]');
      if (!select) return;
      try {
        select.disabled = true;
        await Api.adminUpdateComplaint(select.dataset.status, select.value);
        complaints = await Api.adminComplaints();
        await render();
        toast('تم تحديث حالة الشكوى #' + select.dataset.status);
      } catch (err) {
        toast(err.message, 'error');
        select.disabled = false;
      }
    });

    // تفاصيل الشكوى
    // دالة مختصرة تكتب الاسم ونوع الحساب ورقم الهاتف أو عبارة غير محدد
    $('#table-body').addEventListener('click', e => {
      const btn = e.target.closest('[data-details]');
      if (!btn) return;
      const c = complaints.find(x => x.id === Number(btn.dataset.details));
      const who = (name, role, phone) => name
        ? `${esc(name)} (${ROLE_LABEL[role]}) — <span dir="ltr">${esc(phone)}</span>`
        : 'غير محدد';
      showDetails('تفاصيل الشكوى #' + c.id, [
        ['صاحب الشكوى', who(c.complainant_name, c.complainant_role, c.complainant_phone)],
        ['المشتكى عليه', who(c.accused_name, c.accused_role, c.accused_phone)],
        ['التاريخ', esc(c.created_at)],
        ['الحالة', statusBadge(c.status, COMPLAINT_STATUS)],
        ['تفاصيل الشكوى', esc(c.complaint_details)]
      ]);
    });
  },

  // صفحة إدارة المستخدمين بتبويبين العملاء والحرفيين
  // نحفظ قائمة كل نوع بعد أول تحميل حتى لا نطلبها من الخادم مرة أخرى
  async users() {
    const cache = {};
    const load = async role => (cache[role] = cache[role] || await Api.adminUsers(role));
    const detailsBtn = u => `<td><button type="button" class="btn btn-outline btn-sm" data-details="${u.id}">عرض البيانات</button></td>`;
    const ltr = v => `<td dir="ltr" style="text-align:right">${esc(v)}</td>`;

    // الأعمدة تختلف حسب التبويب
    // والحرفي المشترك في برو تظهر بجانب اسمه شارة بريميوم
    const render = initTable({
      head: filter => filter === 'customer'
        ? ['الاسم', 'البريد الإلكتروني', 'رقم الهاتف', 'المحافظة', 'تاريخ التسجيل', '']
        : ['الاسم', 'المهنة', 'رقم الهاتف', 'المحافظة', 'الاشتراك', 'تاريخ التسجيل', ''],
      emptyText: 'لا توجد حسابات.',
      rows: async filter => {
        const users = await load(filter);
        return filter === 'customer'
          ? users.map(u => `<tr>
              <td>${esc(u.name)}</td>${ltr(u.email)}${ltr(u.phone)}
              <td>${govName(u.governorate)}</td>
              <td>${esc(u.created_at)}</td>
              ${detailsBtn(u)}
            </tr>`)
          : users.map(u => `<tr>
              <td>${esc(u.name)} ${u.subscription_type === 'pro' ? premiumBadge() : ''}</td>
              <td>${professionLabel(u)}</td>${ltr(u.phone)}
              <td>${govName(u.governorate)}</td>
              <td>${u.subscription_type === 'pro' ? 'Pro' : 'Basic'}</td>
              <td>${esc(u.created_at)}</td>
              ${detailsBtn(u)}
            </tr>`);
      }
    });
    await render();

    // زر عرض البيانات يجلب تفاصيل المستخدم من الخادم
    // ونضيف بيانات المهنة والخدمات والتقييم إذا كان حرفياً
    $('#table-body').addEventListener('click', async e => {
      const btn = e.target.closest('[data-details]');
      if (!btn) return;
      try {
        const u = await Api.adminUser(btn.dataset.details);
        const rows = [
          ['الاسم', esc(u.name)],
          ['نوع الحساب', ROLE_LABEL[u.role]],
          ['البريد الإلكتروني', `<span dir="ltr">${esc(u.email)}</span>`],
          ['رقم الهاتف', `<span dir="ltr">${esc(u.phone)}</span>`],
          ['المحافظة', govName(u.governorate)],
          ['تاريخ التسجيل', esc(u.created_at)]
        ];
        if (u.role === 'craftsman') {
          rows.push(
            ['المهنة', professionLabel(u)],
            ['سنوات الخبرة', yearsText(u.experience_years)],
            ['مناطق العمل', u.work_areas.map(govName).join('، ') || '—'],
            ['الخدمات', u.services.map(s => esc(s.name)).join('، ') || '—'],
            ['التقييم', u.rating ? u.rating.toFixed(1) + ' من 5' : 'لا توجد تقييمات'],
            ['الاشتراك', u.subscription_type === 'pro' ? 'Pro' : 'Basic'],
            ['النبذة الشخصية', u.bio ? esc(u.bio) : '—']
          );
        }
        showDetails('بيانات الحساب', rows);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  },

  // صفحة مراقبة الاشتراكات وفيها صف لكل حرفي مع آخر دورة برو له
  // دوال مختصرة لنوع الاشتراك الحالي وشارة الحالة الملونة والعلامة الفارغة
  async subscriptions() {
    const rows = await Api.adminSubscriptions();
    const typeLabel = t => t === 'pro' ? `Pro ${premiumBadge()}` : 'Basic';
    const subStatus = s => {
      const st = SUBSCRIPTION_STATUS[s] || { label: s, cls: '' };
      return `<span class="status ${st.cls}">${st.label}</span>`;
    };
    const dash = v => v ? esc(v) : '<span class="muted">—</span>';

    // تبويب المجاني فقط لمن لم يشترك في برو أبداً
    // وتبويب جميع مشتركي برو لكل من اشترك في برو بأي حالة
    // وباقي التبويبات حسب حالة آخر دورة فعال أو ملغى أو منته
    const render = initTable({
      head: ['اسم الحرفي', 'البريد الإلكتروني', 'نوع الاشتراك', 'تاريخ الاشتراك', 'تاريخ انتهاء الاشتراك', 'حالة الاشتراك', 'تاريخ الإلغاء', 'الإجراء'],
      emptyText: 'لا توجد اشتراكات في هذا القسم.',
      rows: filter => rows
        .filter(r => filter === 'basic' ? !r.has_pro : r.has_pro && (filter === 'pro' || r.status === filter))
        .map(r => `<tr>
          <td>${esc(r.name)}<span class="sub">${esc(r.profession)}</span></td>
          <td dir="ltr" style="text-align:right">${esc(r.email)}</td>
          <td>${typeLabel(r.current_type)}</td>
          <td>${dash(r.start_date)}</td>
          <td>${dash(r.end_date)}</td>
          <td>${subStatus(r.status)}</td>
          <td>${dash(r.cancelled_at)}</td>
          <td><button type="button" class="btn btn-outline btn-sm" data-details="${r.craftsman_id}">عرض التفاصيل</button></td>
        </tr>`)
    });
    await render();

    // زر عرض التفاصيل يجلب سجل كل دورات برو لهذا الحرفي من الخادم
    // ثم نحسب منه أول اشتراك وإعادات الاشتراك والدورات الملغاة والدورة الفعالة الحالية
    $('#table-body').addEventListener('click', async e => {
      const btn = e.target.closest('[data-details]');
      if (!btn) return;
      try {
        const h = await Api.adminSubscriptionHistory(btn.dataset.details);
        const cycles = h.cycles;
        const first = cycles[0];
        const resubs = cycles.filter(c => c.kind === 'resubscribe');
        const cancels = cycles.filter(c => c.cancelled_at);
        const current = cycles.find(c => c.status === 'active');
        showDetails('اشتراكات ' + h.name, [
          ['اسم الحرفي', esc(h.name)],
          ['البريد الإلكتروني', `<span dir="ltr">${esc(h.email)}</span>`],
          ['المهنة', esc(h.profession)],
          ['الاشتراك الحالي', current
            ? `${typeLabel('pro')} — فعال حتى ${esc(current.end_date)}`
            : `Basic${h.current && h.current.start_date ? ' — منذ ' + esc(h.current.start_date) : ''}`],
          ['أول اشتراك في Pro', first ? esc(first.start_date) : 'لم يشترك في Pro'],
          ['آخر إلغاء', cancels.length ? esc(cancels[cancels.length - 1].cancelled_at) : '—'],
          ['آخر إعادة اشتراك', resubs.length ? esc(resubs[resubs.length - 1].start_date) : '—'],
          ['عدد دورات Pro', String(cycles.length)]
        ]);
        // جدول سجل الاشتراكات داخل النافذة
        // صف لكل دورة فيه رقمها ونوع العملية والتواريخ والحالة ورقم العملية التجريبي
        $('#history-body').innerHTML = cycles.length ? `
          <div class="history-wrap"><table>
            <thead><tr><th>#</th><th>العملية</th><th>تاريخ الاشتراك</th><th>تاريخ الانتهاء</th><th>تاريخ الإلغاء</th><th>الحالة</th><th>رقم العملية</th></tr></thead>
            <tbody>${cycles.map(c => `<tr>
              <td>${c.cycle}</td>
              <td>${c.kind === 'first' ? 'اشتراك أول' : 'إعادة اشتراك'}</td>
              <td>${esc(c.start_date)}</td>
              <td>${esc(c.end_date)}</td>
              <td>${dash(c.cancelled_at)}</td>
              <td>${subStatus(c.status)}</td>
              <td dir="ltr" style="text-align:right">${dash(c.transaction_id)}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : '<p class="muted">لا يوجد سجل اشتراكات Pro لهذا الحرفي.</p>';
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
});
