// ملف صفحات الحرفي
// يحمل في صفحات مجلد الحرفي فقط
// ترتيب عرض الطلبات في صفحة الحرفي
// الطلبات الجديدة التي تحتاج رداً تظهر أولاً
const STATUS_ORDER = ['pending', 'quoted', 'in_progress', 'completed', 'rejected', 'quote_rejected'];

// تعيد بطاقة طلب في صفحة الطلبات للحرفي
// والأزرار تتغير حسب حالة الطلب
function craftsmanRequestCard(r) {
  let actions = '';

  // طلب جديد فنعرض زري قبول الطلب ورفض الطلب
  // ومعهما نموذجان مخفيان
  // نموذج عرض السعر بالتكلفة والمدة والموعد ونموذج سبب الرفض
  // الضغط على أحد الزرين يظهر النموذج المناسب
  // حقل التاريخ لا يسمح باختيار تاريخ في الماضي
  if (r.status === 'pending') {
    actions = `
      <div class="btn-row" data-buttons="${r.id}">
        <button type="button" class="btn btn-success" data-action="show-quote" data-id="${r.id}">قبول الطلب</button>
        <button type="button" class="btn btn-danger" data-action="show-reject" data-id="${r.id}">رفض الطلب</button>
      </div>

      <form class="inline-form quote-form" data-id="${r.id}" hidden novalidate>
        <span class="label">إرسال عرض السعر للعميل</span>
        <div class="form-row form-row-3">
          <div class="form-group">
            <label for="q-price-${r.id}">تكلفة الخدمة (دينار أردني)</label>
            <input type="number" id="q-price-${r.id}" min="1" step="0.5" required>
          </div>
          <div class="form-group">
            <label for="q-duration-${r.id}">المدة</label>
            <input type="text" id="q-duration-${r.id}" maxlength="100" placeholder="مثال: يوم واحد" required>
          </div>
          <div class="form-group">
            <label for="q-date-${r.id}">موعد التنفيذ</label>
            <input type="date" id="q-date-${r.id}" min="${todayISO()}" required>
          </div>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn btn-primary">إرسال عرض السعر</button>
          <button type="button" class="btn btn-ghost" data-action="cancel" data-id="${r.id}">إلغاء</button>
        </div>
      </form>

      <form class="inline-form reject-form" data-id="${r.id}" hidden novalidate>
        <div class="form-group">
          <label for="reject-reason-${r.id}">سبب الرفض</label>
          <textarea id="reject-reason-${r.id}" rows="2" maxlength="255" style="min-height:70px" placeholder="اكتب سبب رفض الطلب" required></textarea>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn btn-danger">تأكيد الرفض</button>
          <button type="button" class="btn btn-ghost" data-action="cancel" data-id="${r.id}">إلغاء</button>
        </div>
      </form>`;
  // تم إرسال العرض وننتظر رد العميل
  } else if (r.status === 'quoted') {
    actions = '<p class="muted small" style="margin:0">تم إرسال عرض السعر، بانتظار موافقة العميل.</p>';
  // الطلب قيد التنفيذ فنعرض زر تم إنجاز الخدمة
  } else if (r.status === 'in_progress') {
    actions = `<div class="btn-row">
      <button type="button" class="btn btn-success" data-action="complete" data-id="${r.id}">تم إنجاز الخدمة</button>
    </div>`;
  // الطلب مرفوض فنعرض سبب الرفض
  } else if (r.status === 'rejected') {
    actions = `<div class="note-box"><strong>سبب الرفض:</strong> ${esc(r.reject_reason)}</div>`;
  // العميل رفض عرض السعر
  } else if (r.status === 'quote_rejected') {
    actions = '<div class="note-box">قام العميل برفض عرض السعر.</div>';
  }

  // القالب النهائي للبطاقة
  // بيانات الطلب وعرض السعر المرسل إن وجد ثم الأزرار
  return `
    <article class="card request-card">
      <div class="request-top">
        <h3>طلب #${r.id}</h3>
        ${statusBadge(r.status)}
      </div>
      <div class="request-fields">
        <div><span>اسم العميل</span><strong>${esc(r.customer_name)}</strong></div>
        <div><span>نوع الخدمة</span><strong>${esc(r.service_name)}</strong></div>
        <div><span>الموقع</span><strong>${esc(r.location)}</strong></div>
        <div><span>تاريخ الطلب</span><strong>${esc(r.created_at)}</strong></div>
      </div>
      <p class="request-desc"><span>وصف المشكلة</span>${esc(r.description)}</p>
      ${offerBlock(r.offer, 'عرض السعر المرسل')}
      ${actions}
    </article>`;
}

// دوال صفحات الحرفي
App.run({
  // صفحة الملف الشخصي للحرفي
  // نموذج تعديل البيانات ومعاينة مباشرة للملف وصندوق حالة الاشتراك
  async profile() {
    const form = $('#profile-form');
    const error = $('#profile-error');
    const submitBtn = $('#profile-submit');

    // نجلب الخدمات وملف الحرفي وحالة اشتراكه في نفس الوقت
    const [services, initial, subscriptionInfo] = await Promise.all([
      Api.services(), Api.craftsmanProfile(), Api.subscription()
    ]);
    let profile = initial;
    // كائن يربط رقم كل خدمة أساسية بالخدمة نفسها للوصول السريع
    const mainById = Object.fromEntries(services.main.map(s => [String(s.id), s]));

    // تعبئة القوائم بالمهن والمحافظات
    // وإنشاء مربعات اختيار لمناطق العمل والخدمات الإضافية
    fillProfessionSelect($('#p-profession'), services.main);
    fillGovernorateSelect($('#p-governorate'), 'اختر المحافظة');
    $('#p-areas').innerHTML = GOVERNORATES.map(g => `
      <label class="check-item"><input type="checkbox" name="areas" value="${g.id}"> ${g.name}</label>`).join('');
    $('#p-services').innerHTML = services.main.map(s => `
      <label class="check-item"><input type="checkbox" name="services" value="${s.id}"> ${esc(s.name)}</label>`).join('');

    // تضع قيم الملف المحفوظ في حقول النموذج
    // وتحدد مربعات مناطق العمل والخدمات الموجودة في الملف
    // والخدمات الأخرى تكتب في حقل نصي واحد مفصولة بفواصل
    function fillForm(p) {
      $('#p-name').value = p.name;
      $('#p-phone').value = p.phone;
      const isOther = p.profession_category === 'other';
      $('#p-profession').value = isOther ? 'other' : String(p.profession_id);
      $('#p-other-profession').value = isOther ? p.profession : '';
      $('#p-experience').value = p.experience_years;
      $('#p-governorate').value = p.governorate;
      $('#p-bio').value = p.bio || '';
      $all('input[name="areas"]').forEach(cb => { cb.checked = p.work_areas.includes(cb.value); });
      const ids = p.services.map(s => String(s.id));
      $all('input[name="services"]').forEach(cb => { cb.checked = ids.includes(cb.value); });
      $('#p-other-services').value = p.services
        .filter(s => s.category === 'other' && s.id !== p.profession_id).map(s => s.name).join('، ');
    }

    // تقسم النص إلى أسماء عند الفاصلة العربية أو الإنجليزية
    // وتحذف المسافات والقيم الفارغة
    const splitNames = text => text.split(/[,،]/).map(s => s.trim()).filter(Boolean);

    // تقرأ كل قيم النموذج في كائن بنفس أسماء الحقول التي يتوقعها الخادم
    function readForm() {
      const profession = $('#p-profession').value;
      return {
        name: $('#p-name').value.trim(),
        phone: $('#p-phone').value.trim(),
        profession,
        other_service: $('#p-other-profession').value.trim(),
        experience: $('#p-experience').value,
        governorate: $('#p-governorate').value,
        work_areas: $all('input[name="areas"]:checked').map(cb => cb.value),
        bio: $('#p-bio').value.trim(),
        main_services: $all('input[name="services"]:checked').map(cb => Number(cb.value)),
        other_services: splitNames($('#p-other-services').value)
      };
    }

    // المهنة الأساسية تبقى ضمن الخدمات دائماً
    // نحدد مربعها ونعطله حتى لا يمكن إلغاؤه
    // ونظهر حقل اسم الخدمة فقط إذا كانت المهنة من الخدمات الأخرى
    function syncProfessionCheckbox() {
      const value = $('#p-profession').value;
      $all('input[name="services"]').forEach(cb => {
        const isProfession = cb.value === value;
        cb.disabled = isProfession;
        if (isProfession) cb.checked = true;
      });
      $('#p-other-profession-group').hidden = value !== 'other';
    }

    // المعاينة المباشرة للملف كما سيظهر للعملاء
    // نبني نسخة من الملف من قيم النموذج الحالية
    // ونرسمها بنفس الدالة التي تعرض الملف للعميل
    function updatePreview() {
      const f = readForm();
      const isOther = f.profession === 'other';
      const main = mainById[f.profession];
      const professionName = isOther ? f.other_service : (main ? main.name : '');
      // قائمة أسماء الخدمات وهي المهنة ثم الخدمات الأساسية المختارة ثم الأخرى المكتوبة
      // مع حذف القيم الفارغة والمكررة
      const serviceNames = [professionName]
        .concat(f.main_services.map(id => mainById[String(id)]?.name))
        .concat(f.other_services)
        .filter((n, i, arr) => n && arr.indexOf(n) === i);
      // ننسخ كل خصائص الملف المحفوظ ثم نستبدل ما عدله الحرفي في النموذج
      $('#profile-preview').innerHTML = profileViewHtml({
        ...profile,
        name: f.name, phone: f.phone, bio: f.bio, governorate: f.governorate, work_areas: f.work_areas,
        experience_years: Number(f.experience) || 0,
        profession: professionName || '—', profession_category: isOther ? 'other' : 'main',
        services: serviceNames.map(name => ({ name }))
      });
    }

    // قسم صندوق حالة الاشتراك
    // نحفظ آخر حالة اشتراك وصلت من الخادم
    let subInfo = subscriptionInfo;

    // تعرض حالة الاشتراك
    // برو مع شارة بريميوم وتاريخ الانتهاء أو الاشتراك المجاني
    // الزر يتغير حسب الحالة
    // إلغاء الاشتراك لمشترك برو والاشتراك في برو للمشترك المجاني
    // ونحفظ في الزر العملية المطلوبة عند الضغط
    function renderSubscription() {
      const sub = subInfo.subscription || { subscription_type: 'basic' };
      const isPro = sub.subscription_type === 'pro';
      profile.subscription_type = sub.subscription_type;
      $('#sub-status').innerHTML = isPro ? `Pro ${premiumBadge()}` : 'Basic';
      $('#sub-detail').textContent = isPro && sub.end_date ? `فعّال — ينتهي في ${sub.end_date}` : '';
      const action = $('#sub-action');
      action.textContent = isPro ? 'إلغاء الاشتراك' : 'الاشتراك في Pro';
      action.className = 'btn btn-sm ' + (isPro ? 'btn-danger' : 'btn-accent');
      action.dataset.action = isPro ? 'cancel' : 'subscribe';
      $('#sub-box').hidden = false;
      updatePreview();
    }

    // عند الضغط على زر الاشتراك
    $('#sub-action').addEventListener('click', async e => {
      const btn = e.currentTarget;
      try {
        // عند الإلغاء نسأل للتأكيد وإذا كانت الإجابة لا نتوقف
        // وعند نعم نرسل طلب الإلغاء ونعرض الحالة الجديدة القادمة من الخادم
        if (btn.dataset.action === 'cancel') {
          if (!await confirmDialog('هل أنت متأكد أنك تريد إلغاء اشتراك Pro والعودة إلى Basic؟')) return;
          subInfo = await withBusy(btn, () => Api.subscriptionCancel());
          renderSubscription();
          toast('تم إلغاء اشتراك Pro، حسابك الآن Basic.');
        } else {
          // عند الاشتراك يختلف نص السؤال إذا كان قد اشترك سابقاً
          // وعند نعم ننتقل إلى صفحة الدفع مباشرة
          // كل اشتراك أو إعادة اشتراك يبدأ دورة جديدة من تاريخ الدفع
          const question = subInfo.had_pro
            ? 'هل تريد إعادة الاشتراك في باقة Pro مقابل 10 دولارات شهرياً؟'
            : 'هل تريد الاشتراك في باقة Pro مقابل 10 دولارات شهرياً؟';
          if (!await confirmDialog(question)) return;
          location.href = 'subscription.html?step=pay';
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // التهيئة الأولى بتعبئة النموذج ثم ربط الأحداث
    // أي تعديل في النموذج يحدث المعاينة فوراً
    fillForm(profile);
    syncProfessionCheckbox();
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', e => {
      if (e.target.id === 'p-profession') syncProfessionCheckbox();
      updatePreview();
    });
    renderSubscription();

    // حفظ الملف
    // نتحقق من الحقول بالترتيب ثم نرسلها للخادم
    // ثم نحدث النموذج والاسم في الشريط العلوي بالبيانات المحفوظة
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fields = readForm();
      let message = '';
      if (fields.name.length < 3) message = 'يرجى إدخال الاسم.';
      else if (!isJordanPhone(fields.phone)) message = 'رقم الهاتف يجب أن يكون أردنياً بالصيغة +9627XXXXXXXX.';
      else if (!fields.profession) message = 'يرجى اختيار المهنة.';
      else if (fields.profession === 'other' && fields.other_service.length < 2) message = 'يرجى كتابة اسم الخدمة التي تقدمها.';
      else if (fields.experience === '' || Number(fields.experience) < 0) message = 'يرجى إدخال سنوات الخبرة.';
      else if (!fields.governorate) message = 'يرجى اختيار المحافظة.';
      else if (!fields.work_areas.length) message = 'يرجى اختيار منطقة عمل واحدة على الأقل.';

      if (message) {
        showFormError(error, message);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      showFormError(error, '');

      try {
        profile = await withBusy(submitBtn, () => Api.updateCraftsmanProfile(fields));
        App.user.name = profile.name;
        $('.nav-user-name').textContent = profile.name;
        fillForm(profile);
        syncProfessionCheckbox();
        updatePreview();
        toast('تم حفظ الملف الشخصي بنجاح');
      } catch (err) {
        showFormError(error, err.message);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  },

  // صفحة الاشتراك وفيها ثلاثة أقسام يظهر منها قسم واحد فقط
  // قسم اختيار الباقة وقسم الدفع وقسم الاشتراك الفعال
  // الدالة المختصرة تظهر القسم المطلوب وتخفي الباقي
  async subscription() {
    const info = await Api.subscription();
    const steps = { choose: $('#step-choose'), pay: $('#step-pay'), active: $('#step-active') };
    const show = name => Object.entries(steps).forEach(([key, el]) => { el.hidden = key !== name; });
    const payError = $('#pay-error');

    // إذا كان مشتركاً في برو بالفعل نعرض قسم الاشتراك الفعال مع تاريخ الانتهاء
    // ولا نعرض نموذج الدفع
    if (info.subscription && info.subscription.subscription_type === 'pro') {
      $('#active-detail').textContent = info.subscription.end_date ? `اشتراكك فعّال وينتهي في ${info.subscription.end_date}.` : '';
      show('active');
      return;
    }

    // نجهز تنسيق حقول البطاقة ونربط الأزرار
    // زر المجاني يذهب إلى الملف الشخصي وزر برو يفتح الدفع وزر الرجوع يعود للاختيار
    PaymentForm.init();
    const openPayment = () => { show('pay'); $('#card-name').focus(); };

    $('#choose-basic').addEventListener('click', () => { location.href = 'profile.html'; });
    $('#choose-pro').addEventListener('click', openPayment);
    $('#pay-back').addEventListener('click', () => { showFormError(payError, ''); show('choose'); });

    // عند الضغط على زر الدفع نقرأ البطاقة ونتحقق منها ثم نرسلها للخادم
    // عند النجاح نمسح بيانات البطاقة ونخفي النموذج
    // ونعرض رسالة النجاح القادمة من الخادم
    // ثم ننتقل إلى الملف الشخصي بعد ثانيتين ونصف
    $('#pay-form').addEventListener('submit', async e => {
      e.preventDefault();
      const card = PaymentForm.read();
      const message = PaymentForm.validate(card);
      if (message) return showFormError(payError, message);
      showFormError(payError, '');
      try {
        const result = await withBusy($('#pay-submit'), () => Api.subscriptionPay(card));
        PaymentForm.clear();
        $('#pay-form').hidden = true;
        const success = $('#pay-success');
        success.textContent = result.message;
        success.hidden = false;
        setTimeout(() => { location.href = 'profile.html'; }, 2500);
      } catch (err) {
        showFormError(payError, err.message);
      }
    });

    // إذا جاء الحرفي من زر الاشتراك في ملفه نفتح الدفع مباشرة
    // وإلا نعرض اختيار الباقة
    if (getParam('step') === 'pay') openPayment();
    else show('choose');
  },

  // صفحة الطلبات الواردة للحرفي
  async requests() {
    const list = $('#requests-list');

    // تجلب الطلبات وترتبها حسب ترتيب الحالات ثم ترسمها
    async function render() {
      const requests = (await Api.craftsmanRequests())
        .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
      list.innerHTML = requests.length
        ? requests.map(craftsmanRequestCard).join('')
        : emptyState('لا توجد طلبات حتى الآن.');
    }
    await render();

    // تظهر نموذج عرض السعر أو نموذج الرفض لطلب معين وتخفي أزرار القبول والرفض
    // أو تعيد الأزرار عند الضغط على إلغاء
    function showPanel(id, which) {
      const card = list.querySelector(`[data-buttons="${id}"]`).closest('.request-card');
      card.querySelector(`[data-buttons="${id}"]`).hidden = which !== null;
      card.querySelector('.quote-form').hidden = which !== 'quote';
      card.querySelector('.reject-form').hidden = which !== 'reject';
      const focusEl = which && card.querySelector(which === 'quote' ? '.quote-form input' : '.reject-form textarea');
      if (focusEl) focusEl.focus();
    }

    // مستمع واحد على قائمة الطلبات يختار العملية حسب الزر المضغوط
    // عملية الإنجاز ترسل للخادم أن الخدمة أنجزت ثم تعيد رسم القائمة
    list.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      switch (btn.dataset.action) {
        case 'show-quote': showPanel(id, 'quote'); break;
        case 'show-reject': showPanel(id, 'reject'); break;
        case 'cancel': showPanel(id, null); break;
        case 'complete':
          try {
            await withBusy(btn, () => Api.completeRequest(id));
            toast('تم تحديد الطلب كمكتمل.');
            await render();
          } catch (err) { toast(err.message, 'error'); }
          break;
      }
    });

    // عند إرسال أحد النموذجين داخل البطاقة نميزه بتنسيقه
    // نموذج العرض نتحقق فيه من السعر والمدة والموعد ثم نرسل عرض السعر
    // نموذج الرفض نتحقق فيه من السبب ثم نرسله
    list.addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      const id = form.dataset.id;
      const submit = form.querySelector('[type="submit"]');

      try {
        if (form.classList.contains('quote-form')) {
          const price = Number($(`#q-price-${id}`).value);
          const duration = $(`#q-duration-${id}`).value.trim();
          const date = $(`#q-date-${id}`).value;
          if (!price || price <= 0) return toast('يرجى إدخال تكلفة الخدمة.', 'error');
          if (!duration) return toast('يرجى إدخال مدة تنفيذ الخدمة.', 'error');
          if (!date) return toast('يرجى اختيار موعد التنفيذ.', 'error');
          if (date < todayISO()) return toast('موعد التنفيذ يجب ألا يكون في الماضي.', 'error');
          await withBusy(submit, () => Api.sendOffer(id, { price, execution_time: duration, execution_date: date }));
          toast('تم قبول الطلب وإرسال عرض السعر للعميل.');
        } else if (form.classList.contains('reject-form')) {
          const reason = $(`#reject-reason-${id}`).value.trim();
          if (reason.length < 3) return toast('يرجى كتابة سبب الرفض.', 'error');
          await withBusy(submit, () => Api.rejectRequest(id, reason));
          toast('تم رفض الطلب.');
        }
        await render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  },

  // صفحة الشكاوى للحرفي والطرف الآخر في الطلب هو العميل
  async complaints() {
    initComplaintForm(await Api.craftsmanRequests(), r => r.customer_name);
  }
});
