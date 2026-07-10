##############################################################################
# Backend-server module — SSH key pair, EC2 instance, Elastic IP
# (verbatim move from the original flat main.tf, names via var.name_prefix;
#  user_data templated to optionally install on-instance MariaDB)
##############################################################################

resource "aws_key_pair" "main" {
  key_name   = "${var.name_prefix}-key"
  public_key = var.ssh_public_key

  tags = {
    Name = "${var.name_prefix}-key"
  }
}

resource "aws_instance" "web" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.main.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = var.security_group_ids

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    install_mariadb       = var.install_mariadb
    mariadb_root_password = var.mariadb_root_password
  })

  # Import safety: never let AMI or user_data drift replace/stop a live
  # server. Bootstrap changes are applied by building a fresh instance,
  # not by mutating an existing one.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  tags = {
    Name = "${var.name_prefix}-web"
  }
}

# Elastic IP
resource "aws_eip" "web" {
  instance = aws_instance.web.id
  domain   = "vpc"

  tags = {
    Name = "${var.name_prefix}-eip"
  }
}
