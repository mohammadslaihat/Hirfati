/* =========================================================
   حِرفتي — تسجيل الدخول وإنشاء الحساب
   ========================================================= */

App.run({
  login() {
    const form = $('#login-form');
    const error = $('#login-error');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      if (!email || !password) return showFormError(error, 'يرجى إدخال البريد الإلكتروني وكلمة المرور.');

      try {
        const result = await withBusy(form.querySelector('[type="submit"]'), () => Api.login(email, password));
        location.href = result.redirect;
      } catch (err) {
        showFormError(error, err.message);
      }
    });
  },

  async register() {
    const form = $('#register-form');
    const error = $('#register-error');
    const craftsmanFields = $('#craftsman-fields');
    const otherServiceGroup = $('#other-service-group');
    const submitBtn = $('#register-submit');

    fillGovernorateSelect($('#reg-governorate'), 'اختر المحافظة');

    const selectedRole = () => form.querySelector('input[name="role"]:checked').value;

    function updateVisibility() {
      const isCraftsman = selectedRole() === 'craftsman';
      craftsmanFields.hidden = !isCraftsman;
      craftsmanFields.disabled = !isCraftsman;
      otherServiceGroup.hidden = $('#reg-profession').value !== 'other';
      /* اختيار نوع الاشتراك يتم في الخطوة التالية بعد إنشاء حساب الحرفي */
      submitBtn.textContent = isCraftsman ? 'إنشاء الحساب والمتابعة' : 'إنشاء الحساب';
    }

    $all('input[name="role"]', form).forEach(r => r.addEventListener('change', updateVisibility));
    $('#reg-profession').addEventListener('change', updateVisibility);
    updateVisibility();

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

      let message = '';
      if (fields.name.length < 3) message = 'يرجى إدخال الاسم الكامل.';
      else if (!isJordanPhone(fields.phone)) message = 'رقم الهاتف يجب أن يكون أردنياً بالصيغة +9627XXXXXXXX.';
      else if (!/^\S+@\S+\.\S+$/.test(fields.email)) message = 'يرجى إدخال بريد إلكتروني صحيح.';
      else if (!fields.governorate) message = 'يرجى اختيار المحافظة.';
      else if (fields.password.length < 6) message = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      else if (fields.password !== $('#reg-password2').value) message = 'كلمتا المرور غير متطابقتين.';

      if (!message && role === 'craftsman') {
        fields.profession = $('#reg-profession').value;
        fields.other_service = $('#reg-other-service').value.trim();
        fields.experience = $('#reg-experience').value;
        if (!fields.profession) message = 'يرجى اختيار المهنة.';
        else if (fields.profession === 'other' && fields.other_service.length < 2) message = 'يرجى كتابة اسم الخدمة التي تقدمها.';
        else if (fields.experience === '' || Number(fields.experience) < 0) message = 'يرجى إدخال سنوات الخبرة.';
      }

      if (message) {
        showFormError(error, message);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      showFormError(error, '');

      try {
        const result = await withBusy(submitBtn, () => Api.register(fields));
        location.href = result.redirect;
      } catch (err) {
        showFormError(error, err.message);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    /* قائمة المهن من قاعدة البيانات */
    const services = await Api.services();
    fillProfessionSelect($('#reg-profession'), services.main);
  }
});
