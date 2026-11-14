// ملف صفحات العميل
// يحمل في صفحات مجلد العميل فقط ولكل صفحة دالة في أسفل الملف
// تعيد بطاقة خدمة واحدة فيها الرمز والاسم
// والبطاقة رابط إلى صفحة الحرفيين مفلترة بهذه الخدمة
function serviceCard(s) {
  // القالب النهائي للبطاقة
  // رقم الطلب والحالة وبيانات الطلب والوصف وعرض السعر إن وجد ثم الأزرار
  // كل نص قادم من المستخدم يمر عبر دالة الحماية
  return `<a class="service-card" href="craftsmen.html?service=${s.id}">
            <span class="service-icon" aria-hidden="true">${serviceIcon(s.name)}</span>${esc(s.name)}
          </a>`;
}

// تعيد بطاقة جميع الخدمات الأخرى
// تفتح الحرفيين الذين يقدمون أي خدمة من الخدمات الأخرى
function allOthersCard() {
  return `<a class="service-card" href="craftsmen.html?service=other">
            <span class="service-icon" aria-hidden="true">${OTHERS_GROUP_ICON}</span>جميع الخدمات الأخرى
          </a>`;
}

// تجهز صندوق الفلترة
// تملأ قائمتي الخدمة والمحافظة ثم تختار القيم الموجودة في الرابط
// حتى يبقى الفلتر ظاهراً بعد البحث
function initFilter(services) {
  const service = $('#filter-service');
  const gov = $('#filter-governorate');
  fillServiceFilter(service, services, 'جميع الخدمات');
  fillGovernorateSelect(gov, 'جميع المحافظات');
  service.value = getParam('service');
  gov.value = getParam('gov');
}

// تعيد بطاقة طلب واحد في صفحة طلباتي
// الأزرار والمحتوى في أسفل البطاقة يتغيران حسب حالة الطلب
function customerRequestCard(r) {
  let actions = '';
  // وصل عرض سعر فنعرض زري الموافقة والرفض
  // كل زر يحمل نوع العملية ورقم الطلب لاستخدامهما عند الضغط
  if (r.status === 'quoted') {
    actions = `
      <div class="btn-row">
        <button type="button" class="btn btn-success" data-action="accept-offer" data-id="${r.id}">الموافقة على العرض</button>
        <button type="button" class="btn btn-danger" data-action="reject-offer" data-id="${r.id}">رفض العرض</button>
      </div>`;
  // الطلب ينتظر رد الحرفي فنعرض رسالة انتظار
  } else if (r.status === 'pending') {
    actions = '<p class="muted small" style="margin:0">بانتظار رد الحرفي وإرسال عرض السعر.</p>';
  // رفض الحرفي الطلب فنعرض سبب الرفض
  } else if (r.status === 'rejected') {
    actions = `<div class="note-box"><strong>سبب الرفض:</strong> ${esc(r.reject_reason)}</div>`;
  // الطلب مكتمل ولم يقيم بعد فنعرض نموذج تقييم بخمس نجوم وتعليق اختياري
  // أزرار الاختيار مخفية وتظهر على شكل نجوم بواسطة ملف التنسيق
  } else if (r.status === 'completed' && !r.reviewed) {
    actions = `
      <form class="inline-form review-form" data-id="${r.id}" novalidate>
        <span class="label">قيّم الحرفي ${esc(r.craftsman_name)}</span>
        <div class="star-input">
          ${[5, 4, 3, 2, 1].map(n => `
            <input type="radio" name="stars-${r.id}" id="star-${r.id}-${n}" value="${n}">
            <label for="star-${r.id}-${n}" title="${n} من 5">★</label>`).join('')}
        </div>
        <div class="form-group" style="margin-top:8px">
          <label for="review-comment-${r.id}">تعليقك (اختياري)</label>
          <textarea id="review-comment-${r.id}" rows="2" maxlength="500" style="min-height:70px"></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">إرسال التقييم</button>
      </form>`;
  // الطلب مكتمل وتم تقييمه فنعرض رسالة شكر بدلاً من النموذج
  } else if (r.status === 'completed' && r.reviewed) {
    actions = '<div class="note-box ok">شكراً لك، تم تقييم هذه الخدمة.</div>';
  }

  return `
    <article class="card request-card">
      <div class="request-top">
        <h3>طلب #${r.id}</h3>
        ${statusBadge(r.status)}
      </div>
      <div class="request-fields">
        <div><span>اسم الحرفي</span><strong><a href="craftsman-profile.html?id=${r.craftsman_id}">${esc(r.craftsman_name)}</a></strong></div>
        <div><span>نوع الخدمة</span><strong>${esc(r.service_name)}</strong></div>
        <div><span>الموقع</span><strong>${esc(r.location)}</strong></div>
        <div><span>تاريخ الطلب</span><strong>${esc(r.created_at)}</strong></div>
      </div>
      <p class="request-desc"><span>وصف المشكلة</span>${esc(r.description)}</p>
      ${offerBlock(r.offer, 'عرض السعر من الحرفي')}
      ${actions}
    </article>`;
}

// دوال صفحات العميل
App.run({
  // الصفحة الرئيسية للعميل
  // نرسل طلبي الخدمات والحرفيين المميزين في نفس الوقت وننتظرهما معاً
  // وهذا أسرع من إرسالهما واحداً بعد الآخر
  async home() {
    const [services, featured] = await Promise.all([Api.services(), Api.craftsmen({ featured: 1 })]);
    initFilter(services);

    const others = $('#other-services');
    // شبكة الخدمات فيها بطاقات الخدمات الأساسية
    // ثم زر الخدمات الأخرى الذي يفتح قسماً مخفياً فيه الخدمات الأخرى
    $('#services-grid').innerHTML = services.main.map(serviceCard).join('') +
      `<button type="button" class="service-card" id="other-toggle" aria-expanded="false" aria-controls="other-services">
         <span class="service-icon" aria-hidden="true">${OTHERS_GROUP_ICON}</span>خدمات أخرى
       </button>`;
    $('#other-services-grid').innerHTML = allOthersCard() + services.other.map(serviceCard).join('');

    // عند الضغط على زر الخدمات الأخرى نظهر القسم أو نخفيه ونميز الزر
    const toggle = $('#other-toggle');
    toggle.addEventListener('click', () => {
      others.hidden = !others.hidden;
      toggle.classList.toggle('active', !others.hidden);
      toggle.setAttribute('aria-expanded', String(!others.hidden));
    });

    // قسم الحرفيين المميزين
    // بطاقات كل مشتركي برو الفعالين القادمين من الخادم أو رسالة إذا لم يوجد أحد
    $('#featured-grid').innerHTML = featured.length
      ? featured.map(c => craftsmanCard(c)).join('')
      : emptyState('لا يوجد حرفيون مميزون حالياً.');
  },

  // صفحة الخدمات وفيها الخدمات الأساسية والخدمات الأخرى ظاهرة مباشرة
  async services() {
    const services = await Api.services();
    $('#services-grid').innerHTML = services.main.map(serviceCard).join('');
    $('#other-services-grid').innerHTML = allOthersCard() + services.other.map(serviceCard).join('');
  },

  // صفحة الحرفيين
  // نجلب الحرفيين حسب الفلاتر الموجودة في الرابط ونعرضهم كبطاقات
  // والخادم يرتبهم بحيث يظهر مشتركو برو أولاً
  async craftsmen() {
    const [services, list] = await Promise.all([
      Api.services(),
      Api.craftsmen({ service: getParam('service'), gov: getParam('gov') })
    ]);
    initFilter(services);
    $('#craftsmen-grid').innerHTML = list.length
      ? list.map(c => craftsmanCard(c)).join('')
      : emptyState('لا يوجد حرفيون مطابقون لبحثك. جرّب خدمة أو محافظة أخرى.');
  },

  // صفحة ملف الحرفي
  // نقرأ رقم الحرفي من الرابط ونجلب ملفه
  // وإذا لم يوجد نعرض رسالة ونتوقف
  async 'craftsman-profile'() {
    let craftsman;
    try {
      craftsman = await Api.craftsman(getParam('id'));
    } catch (e) {
      $('#profile-card').innerHTML = emptyState('لم يتم العثور على الحرفي. <a href="craftsmen.html">العودة إلى قائمة الحرفيين</a>');
      return;
    }
    // عنوان تبويب المتصفح يصبح اسم الحرفي ثم نرسم ملفه الشخصي
    document.title = craftsman.name + ' | حِرفتي';
    $('#profile-view').innerHTML = profileViewHtml(craftsman);

    // نافذة طلب عرض السعر
    // نملأ قائمة المحافظات ونكتب اسم الحرفي ومهنته في أعلى النافذة
    const form = $('#quote-form');
    const error = $('#quote-error');
    fillGovernorateSelect($('#quote-governorate'), 'اختر المحافظة');
    $('#quote-modal-to').textContent = 'إلى: ' + craftsman.name + ' — ' + craftsman.profession;

    // عند الضغط على زر طلب عرض السعر نفرغ النموذج
    // ونختار محافظة العميل تلقائياً ثم نفتح النافذة
    $('#quote-btn').addEventListener('click', () => {
      form.reset();
      showFormError(error, '');
      $('#quote-governorate').value = App.user.governorate || '';
      openModal('quote-modal');
    });

    // عند إرسال الطلب نتحقق من الوصف والمحافظة والمنطقة
    // ثم نرسله للخادم ونغلق النافذة ونعرض رسالة نجاح
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const description = $('#quote-description').value.trim();
      const governorate = $('#quote-governorate').value;
      const address = $('#quote-address').value.trim();
      if (description.length < 10) return showFormError(error, 'يرجى كتابة وصف واضح للمشكلة أو الخدمة (10 أحرف على الأقل).');
      if (!governorate) return showFormError(error, 'يرجى اختيار المحافظة.');
      if (!address) return showFormError(error, 'يرجى كتابة المنطقة أو الحي.');

      try {
        await withBusy(form.querySelector('[type="submit"]'), () =>
          Api.createRequest({ craftsman_id: craftsman.id, description, governorate, address }));
        closeModal('quote-modal');
        toast('تم إرسال طلب عرض السعر. يمكنك متابعته من صفحة طلباتي.');
      } catch (err) {
        showFormError(error, err.message);
      }
    });
  },

  // صفحة الشكاوى
  // نجلب طلبات العميل لاختيار الطلب المتعلق بالشكوى
  // والطرف الآخر في الطلب هو الحرفي
  async complaints() {
    initComplaintForm(await Api.customerRequests(), r => r.craftsman_name);
  },

  // صفحة الملف الشخصي وطلباتي
  // نعرض بيانات العميل في العناصر المخصصة لها كنص عادي بشكل آمن
  async 'my-requests'() {
    const u = App.user;
    $('#customer-avatar').innerHTML = avatar(u.name, 'avatar-lg');
    $('#customer-name').textContent = u.name;
    $('#customer-email').textContent = u.email;
    $('#customer-phone').textContent = u.phone;
    $('#customer-governorate').textContent = govName(u.governorate);

    const list = $('#requests-list');

    // تجلب الطلبات من الخادم وترسمها من جديد
    // نستدعيها عند فتح الصفحة وبعد كل عملية قبول أو رفض أو تقييم
    async function render() {
      const requests = await Api.customerRequests();
      list.innerHTML = requests.length
        ? requests.map(customerRequestCard).join('')
        : emptyState('لا توجد طلبات بعد. <a href="craftsmen.html">تصفح الحرفيين</a> وأرسل أول طلب عرض سعر.');
    }
    await render();

    // مستمع واحد على القائمة كلها بدلاً من مستمع لكل زر
    // لأن البطاقات ترسم من جديد بعد كل تحديث
    // نحدد الزر الذي تم الضغط عليه ونوع العملية ثم ننفذها ونعيد رسم القائمة
    list.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      try {
        if (btn.dataset.action === 'accept-offer') {
          await withBusy(btn, () => Api.acceptOffer(id));
          toast('تمت الموافقة على عرض السعر، الطلب الآن قيد التنفيذ.');
        } else if (btn.dataset.action === 'reject-offer') {
          await withBusy(btn, () => Api.rejectOffer(id));
          toast('تم رفض عرض السعر.', 'error');
        }
        await render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // عند إرسال نموذج تقييم نحدد النموذج ونقرأ عدد النجوم المختار
    // ثم نرسل التقييم والتعليق للخادم ونعيد رسم القائمة
    list.addEventListener('submit', async e => {
      const form = e.target.closest('.review-form');
      if (!form) return;
      e.preventDefault();
      const id = form.dataset.id;
      const checked = form.querySelector(`input[name="stars-${id}"]:checked`);
      if (!checked) return toast('يرجى اختيار عدد النجوم.', 'error');
      try {
        await withBusy(form.querySelector('[type="submit"]'), () =>
          Api.addReview(id, Number(checked.value), $(`#review-comment-${id}`).value.trim()));
        toast('شكراً لك، تم إرسال تقييمك.');
        await render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
});
