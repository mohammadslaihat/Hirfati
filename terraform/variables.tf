variable "aws_region" {
  description = "AWS region (Learner Lab uses us-east-1)"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix for all resource names"
  type        = string
  default     = "hirfati"
}

variable "instance_type" {
  description = "EC2 size, small to save lab credit"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Existing Learner Lab SSH key pair"
  type        = string
  default     = "vockey"
}

variable "my_ip" {
  description = "Your public IP in CIDR form (x.x.x.x/32), only this IP can SSH"
  type        = string
}

variable "docker_image" {
  description = "Application image on Docker Hub"
  type        = string
  default     = "mohdzaal/hirfati:latest"
}

variable "db_name" {
  description = "MySQL database name (schema.sql depends on it)"
  type        = string
  default     = "hirfati_db"
}

variable "db_user" {
  description = "MySQL user used by the application"
  type        = string
  default     = "hirfati_user"
}

variable "db_password" {
  description = "MySQL password for db_user"
  type        = string
  sensitive   = true
}

variable "db_root_password" {
  description = "MySQL root password"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "Flask SECRET_KEY, must be the same on all app instances"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email that receives SNS notifications"
  type        = string
}

variable "enable_nat_gateway" {
  description = "NAT lets the private DB server reach the internet (Docker Hub). Costs about 0.045 USD/hour, can be disabled after setup"
  type        = bool
  default     = true
}

variable "lab_instance_profile" {
  description = "Existing Learner Lab instance profile (creating IAM roles is not allowed in the lab)"
  type        = string
  default     = "LabInstanceProfile"
}

variable "db_private_ip" {
  description = "Fixed private IP of the database server (used by the app as DB_HOST)"
  type        = string
  default     = "10.0.11.10"
}

variable "db_data_volume_size" {
  description = "Size in GB of the separate EBS volume that stores MySQL data"
  type        = number
  default     = 10
}

variable "monitor_db_user" {
  description = "Read-only MySQL user used by the monitor Lambda"
  type        = string
  default     = "hirfati_monitor"
}

variable "monitor_db_password" {
  description = "Password of the read-only MySQL monitor user"
  type        = string
  sensitive   = true
}

variable "monitor_interval_minutes" {
  description = "How often the monitor Lambda runs (minutes, 2 or more)"
  type        = number
  default     = 5
}

variable "monitor_enabled" {
  description = "Enable the schedule only after the database is running"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Days to keep database backups in S3 before automatic deletion"
  type        = number
  default     = 30
}

variable "asg_min_size" {
  description = "Minimum app servers in the Auto Scaling group (in addition to EC2 A)"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum app servers in the Auto Scaling group (in addition to EC2 A)"
  type        = number
  default     = 2
}

variable "asg_cpu_target" {
  description = "Average CPU % that the Auto Scaling group tries to keep"
  type        = number
  default     = 50
}

variable "alarm_cpu_threshold" {
  description = "CPU % that triggers the high-CPU alarms on EC2 A and EC2 B"
  type        = number
  default     = 80
}
