# Application Load Balancer: one fixed public URL for the site.
# Receives HTTP on port 80 and forwards to the app servers (EC2 A, later A' and A'') on port 5000.
resource "aws_lb" "app" {
  name               = "${var.project_name}-alb"
  load_balancer_type = "application"
  internal           = false
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]

  tags = { Name = "${var.project_name}-alb" }
}

# App servers group with health checks on the home page
resource "aws_lb_target_group" "app" {
  name                 = "${var.project_name}-app-tg"
  port                 = 5000
  protocol             = "HTTP"
  target_type          = "instance"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${var.project_name}-app-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# EC2 A joins the target group (Auto Scaling instances join automatically in step 14)
resource "aws_lb_target_group_attachment" "app_a" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app.id
  port             = 5000
}
