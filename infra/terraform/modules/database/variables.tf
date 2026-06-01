variable "name_prefix" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" { type = string, sensitive = true }
variable "multi_az" { type = bool, default = true }
variable "backup_retention_days" { type = number, default = 14 }
variable "skip_final_snapshot" { type = bool, default = false }
variable "deletion_protection" { type = bool, default = true }
variable "tags" { type = map(string), default = {} }
