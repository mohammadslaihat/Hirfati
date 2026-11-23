# Auto Scaling: extra app servers (A', A'' in the architecture diagram).
# Each new server installs Docker, writes the compose file and .env,
# pulls the image from Docker Hub and starts the app - no manual steps.

locals {
  app_bootstrap = <<-EOT

    # ---- Hirfati app bootstrap (runs after install-docker.sh) ----
    exec >> /var/log/hirfati-bootstrap.log 2>&1
    APP_DIR=/home/ubuntu/hirfati-app
    mkdir -p "$APP_DIR"

    cat > "$APP_DIR/docker-compose.yml" <<'COMPOSE'
    ${file("${path.module}/../deploy/app/docker-compose.yml")}
    COMPOSE

    cat > "$APP_DIR/.env" <<'ENVFILE'
    DB_HOST=${var.db_private_ip}
    DB_PORT=3306
    DB_NAME=${var.db_name}
    DB_USER=${var.db_user}
    DB_PASSWORD=${var.db_password}
    SECRET_KEY=${var.secret_key}
    ENVFILE

    chmod 600 "$APP_DIR/.env"
    chown -R ubuntu:ubuntu "$APP_DIR"
    cd "$APP_DIR" && docker compose pull && docker compose up -d
    echo "Hirfati app started: $(date)"
  EOT
}

resource "aws_launch_template" "app" {
  name_prefix            = "${var.project_name}-app-"
  image_id               = data.aws_ssm_parameter.ubuntu_ami.insecure_value
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.app.id]

  iam_instance_profile {
    name = var.lab_instance_profile
  }

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size = 10
      volume_type = "gp3"
    }
  }

  metadata_options {
    http_tokens = "required"
  }

  user_data = base64encode(join("\n", [
    file("${path.module}/../scripts/install-docker.sh"),
    local.app_bootstrap,
  ]))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name    = "${var.project_name}-app-asg"
      Role    = "app"
      Project = var.project_name
    }
  }
}

resource "aws_autoscaling_group" "app" {
  name                      = "${var.project_name}-app-asg"
  min_size                  = var.asg_min_size
  max_size                  = var.asg_max_size
  vpc_zone_identifier       = aws_subnet.public[*].id
  target_group_arns         = [aws_lb_target_group.app.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 300
  default_instance_warmup   = 300

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "ManagedBy"
    value               = "Terraform"
    propagate_at_launch = true
  }
}

# Add a server when average CPU goes above the target, remove it when it drops
resource "aws_autoscaling_policy" "cpu" {
  name                   = "${var.project_name}-cpu-target"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = var.asg_cpu_target
  }
}
