# CloudWatch: one dashboard + alarms that email the SNS topic (hirfati-alerts)

locals {
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ---------- Load balancer ----------
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.project_name}-alb-unhealthy-hosts"
  alarm_description   = "An app server behind the load balancer is unhealthy"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "app_5xx" {
  alarm_name          = "${var.project_name}-app-5xx-errors"
  alarm_description   = "The app returned 5 or more server errors (5xx) in 5 minutes"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
  }
}

# ---------- EC2 A (app) and EC2 B (database) ----------
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  for_each = {
    app = aws_instance.app.id
    db  = aws_instance.db.id
  }

  alarm_name          = "${var.project_name}-${each.key}-cpu-high"
  alarm_description   = "CPU on the ${each.key} server is above ${var.alarm_cpu_threshold}% for 10 minutes"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.alarm_cpu_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions

  dimensions = {
    InstanceId = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "status_check" {
  for_each = {
    app = aws_instance.app.id
    db  = aws_instance.db.id
  }

  alarm_name          = "${var.project_name}-${each.key}-status-check-failed"
  alarm_description   = "AWS status check failed on the ${each.key} server"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions

  dimensions = {
    InstanceId = each.value
  }
}

# ---------- Lambda ----------
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-lambda-errors"
  alarm_description   = "The monitor Lambda failed"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.monitor.function_name
  }
}

# ---------- Dashboard ----------
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title  = "Site requests (load balancer)"
          region = var.aws_region
          stat   = "Sum"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.app.arn_suffix],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "Healthy vs unhealthy app servers"
          region = var.aws_region
          stat   = "Maximum"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", aws_lb_target_group.app.arn_suffix, "LoadBalancer", aws_lb.app.arn_suffix],
            [".", "UnHealthyHostCount", ".", ".", ".", "."]
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "CPU % (EC2 A, EC2 B, Auto Scaling group)"
          region = var.aws_region
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.app.id, { label = "EC2 A (app)" }],
            ["...", aws_instance.db.id, { label = "EC2 B (database)" }],
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.app.name, { label = "Auto Scaling (A', A'')" }]
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6
        properties = {
          title  = "Response time (seconds)"
          region = var.aws_region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.app.arn_suffix]
          ]
        }
      },
      {
        type = "metric", x = 0, y = 12, width = 12, height = 6
        properties = {
          title  = "Monitor Lambda"
          region = var.aws_region
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.monitor.function_name],
            [".", "Errors", ".", "."]
          ]
        }
      },
      {
        type = "alarm", x = 12, y = 12, width = 12, height = 6
        properties = {
          title = "Alarms"
          alarms = concat(
            [
              aws_cloudwatch_metric_alarm.unhealthy_hosts.arn,
              aws_cloudwatch_metric_alarm.app_5xx.arn,
              aws_cloudwatch_metric_alarm.lambda_errors.arn,
            ],
            [for a in aws_cloudwatch_metric_alarm.cpu_high : a.arn],
            [for a in aws_cloudwatch_metric_alarm.status_check : a.arn],
          )
        }
      }
    ]
  })
}
