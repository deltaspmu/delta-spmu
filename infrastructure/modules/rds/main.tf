##############################################################################
# RDS module — MariaDB instance + subnet group
# (verbatim move from the original flat main.tf; dev-grade settings are now
#  variables so prod can carry its live hardened values)
##############################################################################

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.name_prefix}-db-subnet"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.name_prefix}-db"
  engine         = "mariadb"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = 20
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = var.db_name
  username = "admin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false

  backup_retention_period = var.backup_retention_period
  skip_final_snapshot     = var.skip_final_snapshot
  deletion_protection     = var.deletion_protection

  lifecycle {
    # Minor engine upgrades happen out-of-band (auto minor version upgrade);
    # don't let a stale pin in code try to downgrade a live database.
    ignore_changes = [engine_version]
  }

  tags = {
    Name = "${var.name_prefix}-db"
  }
}
