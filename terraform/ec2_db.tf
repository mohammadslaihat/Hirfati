# EC2 B: runs MySQL in the private subnet (no public IP)
resource "aws_instance" "db" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.insecure_value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private[0].id
  private_ip             = var.db_private_ip
  vpc_security_group_ids = [aws_security_group.db.id]
  key_name               = var.key_name
  iam_instance_profile   = var.lab_instance_profile

  root_block_device {
    volume_size = 10
    volume_type = "gp3"
  }

  metadata_options {
    http_tokens = "required"
  }

  tags = {
    Name = "${var.project_name}-db-B"
    Role = "db"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

# Separate disk for MySQL data, so it can be backed up and restored on its own
resource "aws_ebs_volume" "db_data" {
  availability_zone = aws_subnet.private[0].availability_zone
  size              = var.db_data_volume_size
  type              = "gp3"
  encrypted         = true

  tags = {
    Name   = "${var.project_name}-db-data"
    Backup = "true"
  }
}

resource "aws_volume_attachment" "db_data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.db_data.id
  instance_id = aws_instance.db.id
}
