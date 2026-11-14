// ملف تسجيل الدخول وإنشاء الحساب
// يحمل في صفحتي الدخول والتسجيل
// وتشغل الدالة التي يطابق اسمها اسم الصفحة الحالية
App.run({
  // صفحة تسجيل الدخول
  login() {
    const form = $('#login-form');
    const error = $('#login-error');

    // عند الضغط على زر الدخول نمنع إعادة تحميل الصفحة
    // ثم نقرأ البريد وكلمة المرور ونتحقق أنهما غير فارغين
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      if (!email || !password) return showFormError(error, 'يرجى إدخال البريد الإلكتروني وكلمة المرور.');

      try {
        // نرسل البيانات للخادم
        // عند النجاح يعيد الخادم الصفحة الرئيسية لنوع الحساب فننتقل إليها
        // عند الفشل نعرض رسالة الخادم
        const result = await withBusy(form.querySelector('[type="submit"]'), () => Api.login(email, password));
        location.href = result.redirect;
      } catch (err) {
        showFormError(error, err.message);
      }
    });
  },

  // صفحة إنشاء حساب جديد
  async register() {
    const form = $('#register-form');
    const error = $('#register-error');
    const craftsmanFields = $('#craftsman-fields');
    const otherServiceGroup = $('#other-service-group');
    const submitBtn = $('#register-submit');

    // تعبئة قائمة المحافظات
    fillGovernorateSelect($('#reg-governorate'), 'اختر المحافظة');

    // تعيد نوع الحساب المختار عميل أو حرفي
    const selectedRole = () => form.querySelector('input[name="role"]:checked').value;

    // تظهر حقول الحرفي أو تخفيها حسب نوع الحساب
    // تعطيل مجموعة الحقول يمنع إرسالها والتحقق منها عندما تكون مخفية
    // حقل اسم الخدمة يظهر فقط عند اختيار الخدمات الأخرى
    // ونص الزر يتغير حسب نوع الحساب
    // اختيار نوع الاشتراك يتم في الخطوة التالية بعد إنشاء حساب الحرفي
    function updateVisibility() {
      const isCraftsman = selectedRole() === 'craftsman';
      craftsmanFields.hidden = !isCraftsman;
      craftsmanFields.disabled = !isCraftsman;
      otherServiceGroup.hidden = $('#reg-profession').value !== 'other';
      submitBtn.textContent = isCraftsman ? 'إنشاء الحساب والمتابعة' : 'إنشاء الحساب';
    }

    // عند تغيير نوع الحساب أو المهنة نعيد تحديد الحقول الظاهرة
    // ثم نستدعي الدالة مرة عند بداية الصفحة
    $all('input[name="role"]', form).forEach(r => r.addEventListener('change', updateVisibility));
    $('#reg-profession').addEventListener('change', updateVisibility);
    updateVisibility();

    // عند إرسال النموذج نجمع البيانات في كائن واحد
    // ثم نتحقق منها في المتصفح لعرض الخطأ بسرعة
    // والخادم يعيد نفس التحققات لأن التحقق في المتصفح يمكن تجاوزه
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const role = selectedRole();
      const fields = {
        role,
        name: $('#reg-name').value.trim(),
        phone: $('#reg-phone').value.trim(),
        email: $('#reg-email').value.trim(),
        governorate: $('#reg-governorate').value,
        password: $('#reg-password').value
      };

      // سلسلة شروط نتوقف فيها عند أول خطأ ونحفظ رسالته
      let message = '';
      if (fields.name.length < 3) message = 'يرجى إدخال الاسم الكامل.';
      else if (!isJordanPhone(fields.phone)) message = 'رقم الهاتف يجب أن يكون أردنياً بالصيغة +9627XXXXXXXX.';
      else if (!/^\S+@\S+\.\S+$/.test(fields.email)) message = 'يرجى إدخال بريد إلكتروني صحيح.';
      else if (!fields.governorate) message = 'يرجى اختيار المحافظة.';
      else if (fields.password.length < 6) message = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      else if (fields.password !== $('#reg-password2').value) message = 'كلمتا المرور غير متطابقتين.';

      // حقول إضافية للحرفي فقط وهي المهنة واسم الخدمة الأخرى وسنوات الخبرة
      if (!message && role === 'craftsman') {
        fields.profession = $('#reg-profession').value;
        fields.other_service = $('#reg-other-service').value.trim();
        fields.experience = $('#reg-experience').value;
        if (!fields.profession) message = 'يرجى اختيار المهنة.';
        else if (fields.profession === 'other' && fields.other_service.length < 2) message = 'يرجى كتابة اسم الخدمة التي تقدمها.';
        else if (fields.experience === '' || Number(fields.experience) < 0) message = 'يرجى إدخال سنوات الخبرة.';
      }

      // عند وجود خطأ نعرضه وننتقل إليه في الصفحة ثم نوقف الدالة
      if (message) {
        showFormError(error, message);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      showFormError(error, '');

      try {
        // نرسل البيانات لإنشاء الحساب
        // الخادم يسجل الدخول تلقائياً ويعيد الصفحة التالية
        // وهي صفحة العميل الرئيسية أو صفحة اختيار الاشتراك للحرفي
        const result = await withBusy(submitBtn, () => Api.register(fields));
        location.href = result.redirect;
      } catch (err) {
        showFormError(error, err.message);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // نجلب قائمة المهن من قاعدة البيانات ونملأ بها القائمة
    const services = await Api.services();
    fillProfessionSelect($('#reg-profession'), services.main);
  }
});
