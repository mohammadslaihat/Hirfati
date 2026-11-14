-- =========================================================
-- حِرفتي (HIRFATI) — هيكل قاعدة البيانات
-- =========================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS hirfati_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hirfati_db;

-- الحسابات بأنواعها الثلاثة
-- governorate: محافظة العميل (محافظة الحرفي محفوظة في craftsman_profiles)
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,              -- كلمة المرور مشفّرة (hash)
  phone       VARCHAR(20)  NOT NULL,
  role        ENUM('customer', 'craftsman', 'admin') NOT NULL,
  governorate VARCHAR(20)  NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- الخدمات: main = المهن الأساسية الثابتة، other = خدمات أخرى يضيفها الحرفيون بأنفسهم
CREATE TABLE IF NOT EXISTS services (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('main', 'other') NOT NULL DEFAULT 'other'
);

-- الملف الشخصي للحرفي (المهنة الأساسية تشير إلى جدول services)
-- work_areas: رموز المحافظات مفصولة بفواصل، مثل: amman,zarqa
CREATE TABLE IF NOT EXISTS craftsman_profiles (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL UNIQUE,
  profession_id     INT NOT NULL,
  experience_years  INT NOT NULL DEFAULT 0,
  governorate       VARCHAR(20)  NOT NULL,
  work_areas        VARCHAR(255) NOT NULL DEFAULT '',
  bio               TEXT NULL,
  subscription_type ENUM('basic', 'pro') NOT NULL DEFAULT 'basic',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profession_id) REFERENCES services(id)
);

-- الخدمات التي يقدمها كل حرفي (يمكن أن تكون أكثر من خدمة)
CREATE TABLE IF NOT EXISTS craftsman_services (
  craftsman_id INT NOT NULL,
  service_id   INT NOT NULL,
  PRIMARY KEY (craftsman_id, service_id),
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- طلبات عروض الأسعار
-- pending: بانتظار رد الحرفي | quoted: تم إرسال عرض السعر | in_progress: جارٍ التنفيذ
-- completed: مكتمل | rejected: رفضه الحرفي | quote_rejected: رفض العميل عرض السعر
CREATE TABLE IF NOT EXISTS requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT NOT NULL,
  craftsman_id  INT NOT NULL,
  service_id    INT NOT NULL,
  description   TEXT NOT NULL,
  location      VARCHAR(150) NOT NULL,
  status        ENUM('pending', 'quoted', 'in_progress', 'completed', 'rejected', 'quote_rejected')
                NOT NULL DEFAULT 'pending',
  reject_reason VARCHAR(255) NULL,                 -- سبب رفض الحرفي للطلب
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)   REFERENCES services(id)
);

-- عروض الأسعار (عرض واحد لكل طلب)
CREATE TABLE IF NOT EXISTS offers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  request_id     INT NOT NULL UNIQUE,
  price          DECIMAL(10, 2) NOT NULL,
  execution_time VARCHAR(100) NOT NULL,            -- مدة التنفيذ، مثل: يوم واحد
  execution_date DATE NOT NULL,                    -- موعد التنفيذ
  status         ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

-- الشكاوى (accused_id اختياري إذا لم تكن الشكوى ضد طرف محدد)
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

-- تقييمات الحرفيين (request_id يمنع تقييم نفس الطلب أكثر من مرة)
CREATE TABLE IF NOT EXISTS reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  craftsman_id INT NOT NULL,
  request_id   INT NULL UNIQUE,
  rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      VARCHAR(500) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id)   REFERENCES requests(id) ON DELETE SET NULL
);

-- اشتراكات الحرفيين (سجل كامل، والاشتراك الحالي هو صاحب الحالة active)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  craftsman_id      INT NOT NULL,
  subscription_type ENUM('basic', 'pro') NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NULL,                     -- NULL للاشتراك المجاني Basic
  status            ENUM('active', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  cancelled_at      DATETIME NULL,                 -- تاريخ ووقت إلغاء الحرفي لدورة Pro
  gateway_subscription_id VARCHAR(100) NULL,       -- رقم عملية الدفع التجريبية (SIM-...)، بدون أي بيانات بطاقة
  FOREIGN KEY (craftsman_id) REFERENCES users(id) ON DELETE CASCADE
);
