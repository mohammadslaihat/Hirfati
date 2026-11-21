data "aws_caller_identity" "current" {}

# Backup bucket (B' in the architecture diagram).
# Learner Lab's service control policy denies s3:GetBucketObjectLockConfiguration,
# which the aws_s3_bucket resource always reads, so the bucket itself is created once with AWS CLI:
#   aws s3api create-bucket --bucket hirfati-db-backups-<account-id> --region us-east-1
# Terraform manages all of its settings below.
locals {
  backup_bucket = "${var.project_name}-db-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "db_backups" {
  bucket = local.backup_bucket

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = local.backup_bucket

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket                  = local.backup_bucket
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Delete old backups automatically to save cost
resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket = local.backup_bucket

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {
      prefix = "mysql/"
    }

    expiration {
      days = var.backup_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# Private route from the VPC to S3 (free, no NAT or internet needed)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id, aws_route_table.public.id]

  tags = { Name = "${var.project_name}-s3-endpoint" }
}
