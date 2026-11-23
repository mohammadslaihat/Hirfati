# دليل نشر منصة حِرفتي على AWS

## 1. نظرة عامة

تعمل منصة **حِرفتي** (Flask + MySQL + Docker) على **AWS Learner Lab** في المنطقة `us-east-1`.
البنية التحتية كلها مكتوبة بـ **Terraform** (Infrastructure as Code) داخل مجلد `terraform/`،
وتُنفَّذ من جهاز Windows باستخدام **PowerShell** و**AWS CLI**.

| المجلد | المحتوى |
|---|---|
| `terraform/` | تعريف كل موارد AWS |
| `deploy/app/` | ملفات تشغيل التطبيق على EC2 A (`docker-compose.yml`، `up.sh`، `.env.example`) |
| `deploy/db/` | ملفات MySQL على EC2 B، والنسخ الاحتياطي والاستعادة |
| `scripts/` | `install-docker.sh` و`prepare-db-disk.sh` |
| `lambda/` | كود Lambda المراقبة وسكربت بناء الحزمة `build.ps1` |

---

## 2. مخطط البنية

```
                              Users (Internet)
                                     |
                                     | HTTP :80
                                     v
                 +-------------------------------------------+
                 |  Application Load Balancer (hirfati-alb)  |
                 +-------------------------------------------+
                        |                         |
                        | :5000                   | :5000
                        v                         v
   +--------------------------+     +----------------------------------+
   |  EC2 A  (hirfati-app-A)  |     |  Auto Scaling (hirfati-app-asg)  |
   |  Docker: hirfati-web     |     |  A', A''  Docker: hirfati-web    |
   +--------------------------+     +----------------------------------+
     Public subnets 10.0.1.0/24 , 10.0.2.0/24   (us-east-1a , us-east-1b)
                        |                         |
                        +------------+------------+
                                     | MySQL :3306
                                     v
   +------------------------------------------------------------------+
   |  EC2 B (hirfati-db-B)  10.0.11.10:3306   Docker: hirfati-mysql   |
   |  EBS data volume (hirfati-db-data) mounted at /data              |
   +------------------------------------------------------------------+
     Private subnets 10.0.11.0/24 , 10.0.12.0/24
          ^                                        |
          | read-only user (hirfati_monitor)       | cron: mysqldump -> gzip
          |                                        v
   +---------------------------------+     VPC Gateway Endpoint (S3)
   | Lambda hirfati-db-monitor       |             |
   | (inside VPC, every 5 minutes)   |             v
   +---------------------------------+     S3: hirfati-db-backups-<account-id>
          |
          v
   +---------------------------+      +-----------------------------------+
   | SNS topic hirfati-alerts  | <--- | CloudWatch: dashboard + 7 alarms  |
   +---------------------------+      +-----------------------------------+
          |                      <--- Auto Scaling notifications
          v
        Email

   NAT Gateway (in public subnet 1): outbound internet for the private subnets
   (Docker Hub, AWS APIs).
```

---

## 3. المكونات

| المورد في Terraform | الملف | الوظيفة |
|---|---|---|
| `aws_vpc.main` | `network.tf` | الشبكة `10.0.0.0/16` مع DNS support/hostnames |
| `aws_internet_gateway.igw` | `network.tf` | ربط الشبكة العامة بالإنترنت |
| `aws_subnet.public[0..1]` | `network.tf` | `10.0.1.0/24` و`10.0.2.0/24` في `us-east-1a/b`، للتطبيق والـ ALB |
| `aws_subnet.private[0..1]` | `network.tf` | `10.0.11.0/24` و`10.0.12.0/24`، لقاعدة البيانات والـ Lambda |
| `aws_route_table.public` و`aws_route_table_association.public` | `network.tf` | توجيه `0.0.0.0/0` إلى Internet Gateway |
| `aws_eip.nat` و`aws_nat_gateway.nat` | `network.tf` | خروج الشبكة الخاصة إلى الإنترنت (يُنشأ فقط عند `enable_nat_gateway = true`) |
| `aws_route_table.private` و`aws_route.private_nat` | `network.tf` | توجيه الشبكة الخاصة عبر NAT |
| `aws_security_group.alb/app/db/lambda` | `security_groups.tf` | الجدران النارية (القسم 4) |
| `data.aws_ssm_parameter.ubuntu_ami` | `ec2_app.tf` | أحدث صورة Ubuntu 24.04 LTS الرسمية من SSM |
| `aws_instance.app` | `ec2_app.tf` | EC2 A: خادم التطبيق في public subnet 1 (قرص 10 GB gp3، IMDSv2) |
| `aws_instance.db` | `ec2_db.tf` | EC2 B: خادم MySQL في private subnet 1 بعنوان ثابت `10.0.11.10` |
| `aws_ebs_volume.db_data` و`aws_volume_attachment.db_data` | `ec2_db.tf` | قرص بيانات MySQL منفصل (10 GB gp3، مشفّر) على `/dev/sdf` |
| `data.aws_iam_role.lab` | `lambda.tf` | الدور الجاهز `LabRole` (لا يسمح الـ Lab بإنشاء IAM roles) |
| `data.archive_file.monitor` | `lambda.tf` | ضغط `lambda/build` إلى `terraform/build/monitor.zip` |
| `aws_cloudwatch_log_group.monitor` | `lambda.tf` | سجلات الـ Lambda (احتفاظ 7 أيام) |
| `aws_lambda_function.monitor` | `lambda.tf` | Lambda `hirfati-db-monitor` (Python 3.12، داخل الـ VPC) |
| `aws_cloudwatch_event_rule/target.monitor` و`aws_lambda_permission.events` | `lambda.tf` | جدولة EventBridge كل `monitor_interval_minutes` دقيقة |
| `local.backup_bucket` | `s3_backup.tf` | اسم الحاوية `hirfati-db-backups-<account-id>` (تُنشأ بـ AWS CLI) |
| `aws_s3_bucket_versioning/server_side_encryption_configuration/public_access_block/lifecycle_configuration` | `s3_backup.tf` | إعدادات حاوية النسخ الاحتياطي |
| `aws_vpc_endpoint.s3` | `s3_backup.tf` | Gateway Endpoint للوصول إلى S3 بدون إنترنت |
| `aws_lb.app` | `alb.tf` | Application Load Balancer العام |
| `aws_lb_target_group.app` | `alb.tf` | مجموعة خوادم التطبيق على المنفذ 5000، مع health check على `/` |
| `aws_lb_listener.http` | `alb.tf` | استقبال HTTP على المنفذ 80 وتحويله إلى الـ target group |
| `aws_lb_target_group_attachment.app_a` | `alb.tf` | إضافة EC2 A إلى الـ target group |
| `aws_launch_template.app` | `asg.tf` | قالب خوادم A' وA'' مع `user_data` للتجهيز التلقائي |
| `aws_autoscaling_group.app` | `asg.tf` | `hirfati-app-asg` (min 1، max 2، health check من ELB) |
| `aws_autoscaling_policy.cpu` | `asg.tf` | Target Tracking على متوسط CPU (الافتراضي 50%) |
| `aws_sns_topic.alerts` و`aws_sns_topic_subscription.email` | `sns.tf` | موضوع `hirfati-alerts` واشتراك البريد |
| `aws_autoscaling_notification.app` | `sns.tf` | بريد عند إضافة خادم أو إزالته أو فشل ذلك |
| `aws_cloudwatch_metric_alarm.*` | `cloudwatch.tf` | 7 تنبيهات (القسم 11) |
| `aws_cloudwatch_dashboard.main` | `cloudwatch.tf` | لوحة `hirfati-dashboard` |

---

## 4. الجدران النارية (Security Groups)

| Security Group | الوارد (Inbound) | الصادر (Outbound) |
|---|---|---|
| `hirfati-alb-sg` | TCP 80 من `0.0.0.0/0` | الكل |
| `hirfati-app-sg` | TCP 5000 من `hirfati-alb-sg` فقط؛ TCP 22 (SSH) من `my_ip` فقط | الكل |
| `hirfati-db-sg` | TCP 3306 من `hirfati-app-sg`؛ TCP 3306 من `hirfati-lambda-sg`؛ TCP 22 من `hirfati-app-sg` (jump host) | الكل |
| `hirfati-lambda-sg` | لا شيء | الكل |

النتيجة:
- قاعدة البيانات لا تملك عنواناً عاماً، ولا يصل إليها إلا خوادم التطبيق والـ Lambda.
- المنفذ 5000 لا يصل إليه أحد من الإنترنت مباشرة، بل عبر الـ ALB فقط.

---

## 5. المتطلبات

- **AWS CLI**، مضبوط ببيانات الدخول من صفحة Learner Lab (`AWS Details` ثم `AWS CLI`) في الملف `~/.aws/credentials`.
- **Terraform** بإصدار `>= 1.6` (المزوّدان `hashicorp/aws ~> 6.0` و`hashicorp/archive ~> 2.4`).
- **Docker Desktop**، لبناء حزمة Lambda باستخدام صورة `public.ecr.aws/lambda/python:3.12`.
- مفتاح SSH الخاص بـ Learner Lab: زوج المفاتيح `vockey`، والملف `labsuser.pem` من صفحة `AWS Details`.

---

## 6. النشر من الصفر

### أ) ملف المتغيرات

```powershell
cd terraform
Copy-Item terraform.tfvars.example terraform.tfvars
notepad terraform.tfvars
```

املأ القيم التالية:

| المفتاح | القيمة |
|---|---|
| `aws_region` | `us-east-1` |
| `my_ip` | عنوان IP العام لجهازك بصيغة `x.x.x.x/32` (من `https://checkip.amazonaws.com`) |
| `alert_email` | البريد الذي يستقبل إشعارات SNS |
| `db_password`، `db_root_password`، `monitor_db_password`، `secret_key` | نصوص عشوائية طويلة |

`terraform.tfvars` مستثنى في `.gitignore`، ويجب ألا يُرفع إلى GitHub.

### ب) إنشاء حاوية S3 (مرة واحدة)

```powershell
$acct = aws sts get-caller-identity --query Account --output text
aws s3api create-bucket --bucket "hirfati-db-backups-$acct" --region us-east-1
```

**لماذا لا ينشئها Terraform؟**
سياسة Learner Lab (Service Control Policy) تمنع الإجراء `s3:GetBucketObjectLockConfiguration`.
المورد `aws_s3_bucket` يقرأ هذا الإعداد دائماً، فيفشل.
لذلك تُنشأ الحاوية بـ AWS CLI، ويدير Terraform إعداداتها في `s3_backup.tf`:
Versioning، والتشفير، ومنع الوصول العام، وحذف النسخ القديمة.

### ج) بناء حزمة Lambda

من جذر المشروع، وبعد تشغيل Docker Desktop:

```powershell
powershell -ExecutionPolicy Bypass -File .\lambda\build.ps1
```

ينشئ السكربت المجلد `lambda/build` ويضع فيه المكتبات (`PyMySQL`، `cryptography`) والملف `handler.py`.
بعدها يضغط Terraform هذا المجلد تلقائياً.

### د) Terraform

```powershell
cd terraform
terraform init
terraform plan "-out=tfplan"
terraform apply "tfplan"
terraform output
```

> في PowerShell ضع `-out=tfplan` بين علامتي تنصيص. بدونها قد يفسّر PowerShell الوسيط بشكل خاطئ.

### هـ) تثبيت Docker على الخادمين

اضبط ملف `~/.ssh/config` أولاً (القسم 7)، ثم:

```powershell
scp scripts/install-docker.sh hirfati-app:~/
ssh hirfati-app "sudo bash ~/install-docker.sh"

scp scripts/install-docker.sh scripts/prepare-db-disk.sh hirfati-db:~/
ssh hirfati-db "sudo bash ~/install-docker.sh && sudo bash ~/prepare-db-disk.sh"
```

- `install-docker.sh`: يثبّت Docker Engine وCompose plugin من مستودع Docker الرسمي، ويضيف swap بحجم 1 GB.
- `prepare-db-disk.sh`: يجهّز قرص البيانات المنفصل ويربطه على `/data`. لا يهيّئ القرص إلا إذا كان فارغاً، فتشغيله مرة أخرى لا يحذف البيانات.
- على EC2 B يتطلب تنزيل Docker أن يكون NAT Gateway مفعّلاً (`enable_nat_gateway = true`).

### و) قاعدة البيانات على EC2 B

```powershell
scp -r deploy/db hirfati-db:~/hirfati-db
scp database/schema.sql hirfati-db:~/hirfati-db/initdb/01-schema.sql
scp database/seed.sql   hirfati-db:~/hirfati-db/initdb/02-seed.sql
ssh hirfati-db "chmod +x ~/hirfati-db/*.sh && chmod 644 ~/hirfati-db/initdb/*"
```

> يجب أن تبقى ملفات `initdb` بصلاحية `644` (غير قابلة للتنفيذ): مدخل صورة MySQL يقرأ ملفات `.sh` غير القابلة للتنفيذ بـ `source` داخل عمليته فتكون الدالة `docker_process_sql` متاحة، أما الملف القابل للتنفيذ فيُشغَّل كعملية منفصلة لا تعرف هذه الدالة فيفشل إنشاء مستخدم المراقبة.

أنشئ `~/hirfati-db/.env` على الخادم، مثلاً بـ `ssh hirfati-db` ثم `nano ~/hirfati-db/.env`.
اكتبه حسب `deploy/db/.env.example` وبنهاية أسطر LF:

| المفتاح في `.env` | مصدر القيمة |
|---|---|
| `MYSQL_DATABASE` | `hirfati_db` (المتغير `db_name`) |
| `MYSQL_USER` | `hirfati_user` (المتغير `db_user`) |
| `MYSQL_PASSWORD` | `db_password` من `terraform.tfvars` |
| `MYSQL_ROOT_PASSWORD` | `db_root_password` من `terraform.tfvars` |
| `MONITOR_USER` | `hirfati_monitor` (المتغير `monitor_db_user`) |
| `MONITOR_PASSWORD` | `monitor_db_password` من `terraform.tfvars` |
| `BACKUP_BUCKET` | ناتج `terraform output backup_bucket_name` |

ثم:

```powershell
ssh hirfati-db "chmod 600 ~/hirfati-db/.env && bash ~/hirfati-db/up.sh"
```

عند أول تشغيل، والمجلد `/data/mysql` فارغ، تنفّذ MySQL الملفات في `initdb` بالترتيب:
- `01-schema.sql`: الجداول.
- `02-seed.sql`: البيانات التجريبية.
- `03-monitor-user.sh`: مستخدم القراءة فقط للـ Lambda.

يعرض `up.sh` بعدها عدد الصفوف في كل جدول وصلاحيات مستخدم المراقبة.

تفعيل النسخ الاحتياطي التلقائي:

```powershell
ssh hirfati-db "sudo cp ~/hirfati-db/hirfati-backup.cron /etc/cron.d/hirfati-backup && sudo chmod 644 /etc/cron.d/hirfati-backup"
```

### ز) التطبيق على EC2 A

```powershell
scp -r deploy/app hirfati-app:~/hirfati-app
ssh hirfati-app "chmod +x ~/hirfati-app/up.sh"
```

أنشئ `~/hirfati-app/.env` حسب `deploy/app/.env.example`:

| المفتاح | مصدر القيمة |
|---|---|
| `DB_HOST` | `10.0.11.10` (المتغير `db_private_ip`) |
| `DB_PORT` | `3306` |
| `DB_NAME` | `hirfati_db` |
| `DB_USER` | `hirfati_user` |
| `DB_PASSWORD` | `db_password` من `terraform.tfvars` |
| `SECRET_KEY` | `secret_key` من `terraform.tfvars` (يجب أن يكون نفسه على كل خوادم التطبيق) |

ثم:

```powershell
ssh hirfati-app "bash ~/hirfati-app/up.sh"
```

يسحب `up.sh` الصورة `mohdzaal/hirfati:latest` من Docker Hub ويشغّل الحاوية `hirfati-web` على المنفذ 5000.
ثم يجري ثلاثة فحوص:
1. الصفحة الرئيسية.
2. `/api/services`، وهي تقرأ من MySQL.
3. تسجيل دخول المدير التجريبي.

قبل كل ذلك يزيل السكربت BOM ونهايات CRLF من `.env` إن وُجدت.

**خوادم Auto Scaling (A'، A'')** تجهّز نفسها تلقائياً من `user_data` في `asg.tf`:
تثبّت Docker، وتكتب `docker-compose.yml` و`.env`، وتسحب الصورة وتشغّلها.
سجلها على الخادم في `/var/log/hirfati-bootstrap.log`.

### ح) تأكيد اشتراك البريد

افتح أول رسالة من AWS Notifications على `alert_email`، واضغط **Confirm subscription**.
بدون التأكيد لا تصل أي إشعارات.

### ط) فتح الموقع

```powershell
terraform output site_url
```

---

## 7. الدخول بـ SSH

انسخ `labsuser.pem` إلى `C:\Users\<you>\.ssh\labsuser.pem`، ثم أضف إلى `C:\Users\<you>\.ssh\config`:

```
Host hirfati-app
    HostName <app_public_ip>
    User ubuntu
    IdentityFile ~/.ssh/labsuser.pem

Host hirfati-db
    HostName 10.0.11.10
    User ubuntu
    IdentityFile ~/.ssh/labsuser.pem
    ProxyJump hirfati-app
```

- `<app_public_ip>` من `terraform output app_public_ip`.
- EC2 B في شبكة خاصة، فيُدخَل إليه عبر EC2 A كـ jump host (`ProxyJump`). هذا ما تسمح به `hirfati-db-sg`.
- SSH إلى EC2 A مسموح فقط من العنوان `my_ip`.

```powershell
ssh hirfati-app
ssh hirfati-db
```

---

## 8. إيقاف البيئة وتشغيلها بين جلسات الـ Lab

### الإيقاف

في `terraform.tfvars`:

```hcl
enable_nat_gateway = false
monitor_enabled    = false
```

```powershell
terraform plan "-out=tfplan"
terraform apply "tfplan"
```

ثم اضغط **End Lab**.

NAT Gateway يكلّف تقريباً 0.045 USD في الساعة، كما هو مذكور في وصف المتغير `enable_nat_gateway`.

### التشغيل

1. اضغط **Start Lab**.
2. حدّث `~/.aws/credentials` ببيانات الجلسة الجديدة من `AWS Details`.
3. إن تغيّر عنوانك العام فحدّث `my_ip` في `terraform.tfvars`.
4. في `terraform.tfvars`:
   ```hcl
   enable_nat_gateway = true
   monitor_enabled    = true
   ```
5. نفّذ:
   ```powershell
   terraform plan "-out=tfplan"
   terraform apply "tfplan"
   terraform output app_public_ip
   ```
6. حدّث `HostName` لـ `hirfati-app` في `~/.ssh/config` بالعنوان الجديد، لأن العنوان العام لـ EC2 A يتغيّر بعد كل إيقاف وتشغيل.

**ملاحظة:** حاويتا `hirfati-web` و`hirfati-mysql` تعودان تلقائياً بعد الإقلاع (`restart: unless-stopped`).
وتُؤخذ نسخة احتياطية تلقائياً بعد 5 دقائق من إقلاع EC2 B (سطر `@reboot` في `hirfati-backup.cron`).

---

## 9. النسخ الاحتياطي والاستعادة

| البند | القيمة |
|---|---|
| الجدولة | `deploy/db/hirfati-backup.cron`: كل 6 ساعات، وبعد 5 دقائق من كل إقلاع |
| الطريقة | `mysqldump --single-transaction`، ثم `gzip`، ثم `/data/backups`، ثم رفع إلى `s3://<bucket>/mysql/` |
| الرفع | عبر VPC Gateway Endpoint، باستخدام صلاحيات `LabInstanceProfile` |
| الاحتفاظ في S3 | 30 يوماً (`backup_retention_days`)، والإصدارات القديمة 7 أيام |
| الاحتفاظ محلياً | 7 أيام في `/data/backups` |
| الحماية | Versioning مفعّل، وتشفير AES256، ومنع كامل للوصول العام |
| السجل | `/var/log/hirfati-backup.log` |

أخذ نسخة يدوياً:

```bash
sudo ~/hirfati-db/backup.sh
```

اختبار الاستعادة (آمن، لا يلمس البيانات الحية):

```bash
sudo ~/hirfati-db/restore.sh latest
```

يستعيد أحدث نسخة إلى قاعدة `hirfati_restore_test`، ثم يقارن عدد الصفوف في كل جدول مع `hirfati_db`.
يكتب `OK` إن تطابق العدد و`DIFF` إن اختلف.

الاستعادة الفعلية إلى القاعدة الحية:

```bash
sudo ~/hirfati-db/restore.sh latest hirfati_db
```

يمكن تمرير اسم ملف محدد بدل `latest`، مثل `hirfati_db_YYYY-MM-DD_HH-MM.sql.gz`.

---

## 10. تحديث التطبيق بعد رفع صورة جديدة إلى Docker Hub

EC2 A:

```powershell
ssh hirfati-app "bash ~/hirfati-app/up.sh"
```

خوادم Auto Scaling (يستبدلها بخوادم جديدة تسحب أحدث صورة):

```powershell
aws autoscaling start-instance-refresh --auto-scaling-group-name hirfati-app-asg
```

---

## 11. المراقبة

رابط لوحة CloudWatch:

```powershell
terraform output dashboard_url
```

تعرض اللوحة `hirfati-dashboard`:
- طلبات الموقع وأخطاء 5xx.
- عدد الخوادم السليمة وغير السليمة.
- CPU لـ EC2 A وEC2 B ومجموعة Auto Scaling.
- زمن الاستجابة.
- تشغيلات Lambda وأخطاؤها.
- حالة كل التنبيهات.

### التنبيهات السبعة

كلها ترسل إلى SNS `hirfati-alerts`.

| التنبيه | المقياس | متى يعمل |
|---|---|---|
| `hirfati-alb-unhealthy-hosts` | `UnHealthyHostCount` (Maximum) | أكثر من 0 لمدة دقيقتين (2 × 60 ثانية). يرسل أيضاً عند العودة إلى OK |
| `hirfati-app-5xx-errors` | `HTTPCode_Target_5XX_Count` (Sum) | 5 أخطاء أو أكثر خلال 5 دقائق |
| `hirfati-app-cpu-high` | `CPUUtilization` لـ EC2 A (Average) | أكثر من 80% (`alarm_cpu_threshold`) لمدة 10 دقائق (2 × 300 ثانية) |
| `hirfati-db-cpu-high` | `CPUUtilization` لـ EC2 B (Average) | أكثر من 80% لمدة 10 دقائق |
| `hirfati-app-status-check-failed` | `StatusCheckFailed` لـ EC2 A (Maximum) | قيمة 1 أو أكثر لمدة دقيقتين |
| `hirfati-db-status-check-failed` | `StatusCheckFailed` لـ EC2 B (Maximum) | قيمة 1 أو أكثر لمدة دقيقتين |
| `hirfati-lambda-errors` | `Errors` لـ `hirfati-db-monitor` (Sum) | خطأ واحد أو أكثر خلال 5 دقائق |

غياب البيانات لا يُعدّ مشكلة في أي تنبيه (`treat_missing_data = "notBreaching"`).

### إشعارات Lambda (`hirfati-db-monitor`)

تعمل كل 5 دقائق عند `monitor_enabled = true`، وتتصل بـ MySQL بمستخدم القراءة فقط.

- **`Hirfati ALERT: database unreachable`**: عند تعذّر الاتصال بقاعدة البيانات على `10.0.11.10`.
- **`Hirfati: new activity`**: عند وجود نشاط جديد خلال آخر 5 دقائق، مع العدد لكل نوع:
  - شكاوى جديدة (`complaints`).
  - طلبات عروض أسعار جديدة (`requests`).
  - عروض أسعار أرسلها الحرفيون (`offers`).

كل نتيجة تُكتب أيضاً في CloudWatch Logs `/aws/lambda/hirfati-db-monitor`.

### إشعارات Auto Scaling

ترسل بريداً عند كل من:
- `EC2_INSTANCE_LAUNCH`
- `EC2_INSTANCE_TERMINATE`
- `EC2_INSTANCE_LAUNCH_ERROR`
- `EC2_INSTANCE_TERMINATE_ERROR`

---

## 12. ملاحظات أمنية وتحسينات مستقبلية

- **الأسرار** موجودة فقط في `terraform/terraform.tfvars` على جهاز النشر، وفي ملفات `.env` على الخوادم.
  كلها مستثناة في `.gitignore`، ولا تُرفع إلى GitHub.
- **user_data:** كلمة مرور قاعدة البيانات و`SECRET_KEY` تُمرَّران كنص داخل `user_data` في الـ Launch Template (`asg.tf`).
  في بيئة إنتاج يُفضَّل تخزينهما في **AWS Secrets Manager** وقراءتهما عند الإقلاع.
- **HTTP فقط:** الموقع يعمل حالياً على HTTP (المنفذ 80).
  في الإنتاج يُضاف HTTPS بشهادة من **AWS Certificate Manager (ACM)** ودومين خاص، مع listener على المنفذ 443.
- **Terraform state:** الملف `terraform.tfstate` محلي على جهاز واحد.
  عند العمل كفريق يُفضَّل **S3 backend** مع قفل للـ state.

---

## 13. حذف كل شيء نهائياً

```powershell
cd terraform
terraform destroy
```

حاوية S3 أُنشئت بـ AWS CLI وليست موارد Terraform، فلا يحذفها `terraform destroy`.
لحذفها مع كل النسخ وإصداراتها، من AWS Console: S3، ثم الحاوية، ثم **Empty**، ثم **Delete**.
أو بـ AWS CLI:

```powershell
$acct = aws sts get-caller-identity --query Account --output text
aws s3 rm "s3://hirfati-db-backups-$acct" --recursive
aws s3api delete-bucket --bucket "hirfati-db-backups-$acct"
```

إن بقيت إصدارات قديمة (Versioning)، فأفرغ الحاوية من AWS Console قبل `delete-bucket`.
