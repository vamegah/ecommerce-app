module "networking" {
  source          = "../networking"
  name_prefix     = var.name_prefix
  vpc_cidr        = var.vpc_cidr
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  tags            = var.tags
}

module "iam" {
  source      = "../iam"
  name_prefix = var.name_prefix
}

module "database" {
  source               = "../database"
  name_prefix          = var.name_prefix
  private_subnet_ids   = module.networking.private_subnet_ids
  security_group_ids   = var.security_group_ids
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  multi_az             = var.db_multi_az
  backup_retention_days = var.db_backup_retention_days
  skip_final_snapshot  = var.skip_final_snapshot
  deletion_protection  = var.deletion_protection
  tags                 = var.tags
}

module "cache" {
  source             = "../cache"
  name_prefix        = var.name_prefix
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_ids = var.security_group_ids
}

module "storage" {
  source            = "../storage"
  media_bucket_name = var.media_bucket_name
  tags              = var.tags
}

module "tls" {
  source      = "../tls"
  domain_name = var.domain_name
}

module "compute" {
  source                  = "../compute"
  name_prefix             = var.name_prefix
  private_subnet_ids      = module.networking.private_subnet_ids
  security_group_ids      = var.security_group_ids
  web_task_definition_arn = var.web_task_definition_arn
  web_desired_count       = var.web_desired_count
  tags                    = var.tags
}

module "waf" {
  source      = "../waf"
  name_prefix = var.name_prefix
  rate_limit  = var.waf_rate_limit
}

module "cdn" {
  source             = "../cdn"
  name_prefix        = var.name_prefix
  origin_domain_name = var.alb_dns_name
  certificate_arn    = module.tls.certificate_arn
  web_acl_arn        = module.waf.web_acl_arn
  tags               = var.tags
}

module "autoscaling" {
  source       = "../autoscaling"
  name_prefix  = var.name_prefix
  cluster_name = module.compute.cluster_name
  service_name = module.compute.web_service_name
  min_capacity = var.web_min_capacity
  max_capacity = var.web_max_capacity
  cpu_target   = var.web_cpu_target
}

module "dns" {
  source      = "../dns"
  zone_id     = var.zone_id
  record_name = var.record_name
  alb_dns_name = var.alb_dns_name
  alb_zone_id  = var.alb_zone_id
}
