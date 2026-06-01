resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_db_instance" "postgres" {
  identifier             = "${var.name_prefix}-postgres"
  engine                 = "postgres"
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.security_group_ids
  multi_az               = var.multi_az
  storage_encrypted      = true
  backup_retention_period = var.backup_retention_days
  skip_final_snapshot    = var.skip_final_snapshot
  deletion_protection    = var.deletion_protection
  publicly_accessible    = false
  tags                   = var.tags
}
