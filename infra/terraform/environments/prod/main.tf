terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
}

module "env" {
  source = "../../modules/environment"

  name_prefix              = "greatkart-prod"
  vpc_cidr                 = var.vpc_cidr
  public_subnets           = var.public_subnets
  private_subnets          = var.private_subnets
  security_group_ids       = var.security_group_ids
  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_name                  = var.db_name
  db_username              = var.db_username
  db_password              = var.db_password
  db_multi_az              = true
  db_backup_retention_days = 35
  skip_final_snapshot      = false
  deletion_protection      = true
  media_bucket_name        = var.media_bucket_name
  domain_name              = var.domain_name
  zone_id                  = var.zone_id
  record_name              = var.record_name
  alb_dns_name             = var.alb_dns_name
  alb_zone_id              = var.alb_zone_id
  web_task_definition_arn  = var.web_task_definition_arn
  web_desired_count        = 3
  tags                     = var.tags
}
