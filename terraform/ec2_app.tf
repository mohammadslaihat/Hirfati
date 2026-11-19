# Latest official Ubuntu 24.04 LTS (x86_64, gp3) image ID, published by Canonical in SSM
data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

# EC2 A: runs the Hirfati app container (frontend + backend)
resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.insecure_value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
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
    Name = "${var.project_name}-app-A"
    Role = "app"
  }

  # Do not replace the server when Canonical publishes a newer image
  lifecycle {
    ignore_changes = [ami]
  }
}
