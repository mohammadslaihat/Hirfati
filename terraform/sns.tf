# SNS: push notifications by email
# Sources: monitor Lambda (new activity / database down), Auto Scaling (server added/removed),
# and CloudWatch alarms (step 16).
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

# The email owner must click "Confirm subscription" in the first email from AWS
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Email when Auto Scaling adds or removes an app server (A', A'')
resource "aws_autoscaling_notification" "app" {
  group_names = [aws_autoscaling_group.app.name]
  topic_arn   = aws_sns_topic.alerts.arn

  notifications = [
    "autoscaling:EC2_INSTANCE_LAUNCH",
    "autoscaling:EC2_INSTANCE_TERMINATE",
    "autoscaling:EC2_INSTANCE_LAUNCH_ERROR",
    "autoscaling:EC2_INSTANCE_TERMINATE_ERROR",
  ]
}
