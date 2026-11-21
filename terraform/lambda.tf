# Existing Learner Lab role (creating IAM roles is not allowed in the lab)
data "aws_iam_role" "lab" {
  name = "LabRole"
}

# Zip of lambda/build (created by lambda/build.ps1)
data "archive_file" "monitor" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/build"
  output_path = "${path.module}/build/monitor.zip"
}

resource "aws_cloudwatch_log_group" "monitor" {
  name              = "/aws/lambda/${var.project_name}-db-monitor"
  retention_in_days = 7
}

resource "aws_lambda_function" "monitor" {
  function_name    = "${var.project_name}-db-monitor"
  description      = "Checks the Hirfati database on EC2 B and notifies about new activity"
  role             = data.aws_iam_role.lab.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.monitor.output_path
  source_code_hash = data.archive_file.monitor.output_base64sha256
  timeout          = 20
  memory_size      = 128

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST        = var.db_private_ip
      DB_PORT        = "3306"
      DB_NAME        = var.db_name
      DB_USER        = var.monitor_db_user
      DB_PASSWORD    = var.monitor_db_password
      WINDOW_MINUTES = tostring(var.monitor_interval_minutes)
      SNS_TOPIC_ARN  = ""
    }
  }

  depends_on = [aws_cloudwatch_log_group.monitor]
}

# Schedule (EventBridge): runs the Lambda every N minutes
resource "aws_cloudwatch_event_rule" "monitor" {
  name                = "${var.project_name}-db-monitor-schedule"
  schedule_expression = "rate(${var.monitor_interval_minutes} minutes)"
  state               = var.monitor_enabled ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "monitor" {
  rule = aws_cloudwatch_event_rule.monitor.name
  arn  = aws_lambda_function.monitor.arn
}

resource "aws_lambda_permission" "events" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.monitor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monitor.arn
}
