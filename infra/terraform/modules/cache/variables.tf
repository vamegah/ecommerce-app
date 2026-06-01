variable "name_prefix" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "node_type" { type = string, default = "cache.t4g.micro" }
