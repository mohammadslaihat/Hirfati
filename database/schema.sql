-- ملف إنشاء قاعدة بيانات حرفتي وجداولها التسعة والعلاقات بينها
-- ينفذ مرة واحدة عند أول تشغيل لحاويات دوكر أو يدوياً بأمر قاعدة البيانات
-- شرح المصطلحات المستخدمة في الملف
-- المفتاح الأساسي عمود قيمته لا تتكرر ويميز كل صف
-- الترقيم التلقائي يجعل قاعدة البيانات تعطي كل صف جديد رقماً تلقائياً
-- المفتاح الخارجي عمود يشير إلى المفتاح الأساسي في جدول آخر
-- فلا يمكن إدخال رقم غير موجود في الجدول الآخر
-- الحذف المتسلسل يعني أن حذف الصف الأصلي يحذف الصفوف المرتبطة به تلقائياً
-- التفريغ عند الحذف يعني أن القيمة المرتبطة تصبح فارغة بدلاً من حذف الصف
-- الحقل الإجباري لا يقبل قيمة فارغة والحقل الفريد لا تتكرر قيمته
-- القائمة المحددة تعني أن القيمة يجب أن تكون من خيارات محددة مسبقاً
-- السطر التالي يجعل التعامل مع النصوص بترميز يدعم العربية بالكامل
SET NAMES utf8mb4;

-- إنشاء قاعدة البيانات إذا لم تكن موجودة بترميز يدعم العربية ثم اختيارها
-- شرط عدم الوجود في كل أمر يجعل تنفيذ الملف أكثر من مرة آمناً
CREATE DATABASE IF NOT EXISTS hirfati_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hirfati_db;

-- جدول المستخدمين
-- يحتوي جميع الحسابات من عملاء وحرفيين وأدمن
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  -- البريد فريد فلا يمكن إنشاء حسابين بنفس البريد
  email       VARCHAR(150) NOT NULL UNIQUE,
  -- كلمة المرور محفوظة بشكل مشفر وليست كنص واضح
  password    VARCHAR(255) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  -- نوع الحساب عميل أو حرفي أو أدمن
  role        ENUM('customer', 'craftsman', 'admin') NOT NULL,
  -- محافظة العميل أما محافظة الحرفي فمحفوظة في ملف الحرفي
  governorate VARCHAR(20)  NULL,
  -- تاريخ إنشاء الحساب ويملأ تلقائياً بالوقت الحالي
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول الخدمات
-- اسم الخدمة فريد حتى لا تتكرر
-- التصنيف إما خدمة أساسية ثابتة أو خدمة أخرى أضافها الحرفيون
CREATE TABLE IF NOT EXISTS services (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('main', 'other') NOT NULL DEFAULT 'other'
);

-- جدول ملفات الحرفيين
-- يحتوي البيانات المهنية للحرفي فقط
-- كل حرفي له ملف واحد لأن رقم المستخدم فريد في هذا الجدول
CREATE TABLE IF NOT EXISTS craftsman_profiles (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL UNIQUE,
  profession_id     INT NOT NULL,
  experience_years  INT NOT NULL DEFAULT 0,
  governorate       VARCHAR(20)  NOT NULL,
  -- مناطق العمل رموز محافظات مفصولة بفواصل
  work_areas        VARCHAR(255) NOT NULL DEFAULT '',
  bio               TEXT NULL,
  -- نوع الاشتراك الحالي للعرض السريع والسجل الكامل في جدول الاشتراكات
  subscription_type ENUM('basic', 'pro') NOT NULL DEFAULT 'basic',
  -- رقم المستخدم يشير إلى جدول المستخدمين وحذف الحساب يحذف ملفه
  -- ورقم المهنة يشير إلى جدول الخدمات
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profession_id) REFERENCES services(id)
);

-- جدول ربط الحرفيين بالخدمات
-- علاقة كثير إلى كثير فالحرفي يقدم عدة خدمات والخدمة يقدمها عدة حرفيين
-- كل صف يمثل حرفياً وخدمة واحدة يقدمها
CREATE TABLE IF NOT EXISTS craftsman_services (
  craftsman_id INT NOT NULL,
  service_id   INT NOT NULL,
  -- مفتاح أساسي مركب من عمودين يمنع تكرار نفس الخدمة لنفس الحرفي
  PRIMARY KEY (craftsman_id, service_id),
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- جدول طلبات عروض الأسعار من العميل إلى الحرفي
-- يرتبط بجدول المستخدمين مرتين مرة للعميل ومرة للحرفي ويرتبط بجدول الخدمات
CREATE TABLE IF NOT EXISTS requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT NOT NULL,
  craftsman_id  INT NOT NULL,
  service_id    INT NOT NULL,
  description   TEXT NOT NULL,
  location      VARCHAR(150) NOT NULL,
  -- حالة الطلب وتبدأ بقيد الانتظار
  -- الحالات بالترتيب
  -- بانتظار رد الحرفي ثم تم إرسال عرض السعر ثم جار التنفيذ ثم مكتمل
  -- أو رفضه الحرفي أو رفض العميل عرض السعر
  status        ENUM('pending', 'quoted', 'in_progress', 'completed', 'rejected', 'quote_rejected')
                NOT NULL DEFAULT 'pending',
  -- سبب رفض الحرفي للطلب
  reject_reason VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)   REFERENCES services(id)
);

-- جدول عروض الأسعار التي يرسلها الحرفي
-- رقم الطلب فريد فلكل طلب عرض واحد فقط
CREATE TABLE IF NOT EXISTS offers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  request_id     INT NOT NULL UNIQUE,
  -- السعر رقم عشري دقيق فيه رقمان بعد الفاصلة العشرية
  price          DECIMAL(10, 2) NOT NULL,
  -- مدة التنفيذ نص مثل يوم واحد
  execution_time VARCHAR(100) NOT NULL,
  -- موعد تنفيذ الخدمة
  execution_date DATE NOT NULL,
  status         ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

-- جدول الشكاوى
-- صاحب الشكوى إجباري والمشتكى عليه اختياري إذا كانت الشكوى عامة
-- عند حذف المشتكى عليه تبقى الشكوى ويصبح حقله فارغاً
CREATE TABLE IF NOT EXISTS complaints (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  complainant_id    INT NOT NULL,
  accused_id        INT NULL,
  complaint_details TEXT NOT NULL,
  status            ENUM('new', 'processing', 'resolved') NOT NULL DEFAULT 'new',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complainant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (accused_id)     REFERENCES users(id) ON DELETE SET NULL
);

-- جدول تقييمات العملاء للحرفيين
-- رقم الطلب فريد فلكل طلب تقييم واحد فقط
CREATE TABLE IF NOT EXISTS reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  craftsman_id INT NOT NULL,
  request_id   INT NULL UNIQUE,
  -- التقييم رقم من 1 إلى 5 ويمنع الشرط أي قيمة أخرى
  rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      VARCHAR(500) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id)   REFERENCES requests(id) ON DELETE SET NULL
);

-- جدول الاشتراكات
-- سجل كامل لكل دورات الاشتراك ولا نكتب فوق الدورات القديمة
-- الاشتراك الحالي هو الصف الذي حالته فعال
CREATE TABLE IF NOT EXISTS subscriptions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  craftsman_id      INT NOT NULL,
  subscription_type ENUM('basic', 'pro') NOT NULL,
  start_date        DATE NOT NULL,
  -- تاريخ الانتهاء ويكون فارغاً للاشتراك المجاني لأنه دائم
  end_date          DATE NULL,
  -- حالة الدورة فعال أو منتهي أو ملغى
  status            ENUM('active', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  -- تاريخ ووقت إلغاء الحرفي لدورة برو
  cancelled_at      DATETIME NULL,
  -- رقم عملية الدفع التجريبي دون أي بيانات بطاقة
  gateway_subscription_id VARCHAR(100) NULL,
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE
);
