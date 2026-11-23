output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "security_group_ids" {
  value = {
    alb = aws_security_group.alb.id
    app = aws_security_group.app.id
    db  = aws_security_group.db.id
  }
}

output "nat_gateway_enabled" {
  value = var.enable_nat_gateway
}

output "app_instance_id" {
  value = aws_instance.app.id
}

output "app_public_ip" {
  value = aws_instance.app.public_ip
}

output "app_private_ip" {
  value = aws_instance.app.private_ip
}

output "db_instance_id" {
  value = aws_instance.db.id
}

output "db_private_ip" {
  value = aws_instance.db.private_ip
}

output "db_data_volume_id" {
  value = aws_ebs_volume.db_data.id
}

output "monitor_lambda_name" {
  value = aws_lambda_function.monitor.function_name
}

output "backup_bucket_name" {
  value = local.backup_bucket
}

output "site_url" {
  description = "Public URL of the Hirfati website (through the load balancer)"
  value       = "http://${aws_lb.app.dns_name}"
}

output "target_group_arn" {
  value = aws_lb_target_group.app.arn
}

output "asg_name" {
  value = aws_autoscaling_group.app.name
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}
