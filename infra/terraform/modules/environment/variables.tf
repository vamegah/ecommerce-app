variable "name_prefix" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnets" {
  type = map(object({ cidr = string, az = string }))
}
variable "private_subnets" {
  type = map(object({ cidr = string, az = string }))
}
variable "security_group_ids" { type = list(string) }
variable "db_instance_class" { type = string }
variable "db_allocated_storage" { type = number }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" { type = string, sensitive = true }
variable "db_multi_az" { type = bool, default = true }
variable "db_backup_retention_days" { type = number, default = 14 }
variable "skip_final_snapshot" { type = bool, default = false }
variable "deletion_protection" { type = bool, default = true }
variable "media_bucket_name" { type = string }
variable "domain_name" { type = string }
variable "zone_id" { type = string }
variable "record_name" { type = string }
variable "alb_dns_name" { type = string }
variable "alb_zone_id" { type = string }
variable "web_task_definition_arn" { type = string }
variable "web_desired_count" { type = number, default = 2 }
variable "web_min_capacity" { type = number, default = 2 }
variable "web_max_capacity" { type = number, default = 8 }
variable "web_cpu_target" { type = number, default = 55 }
variable "waf_rate_limit" { type = number, default = 2000 }
variable "tags" { type = map(string), default = {} }
