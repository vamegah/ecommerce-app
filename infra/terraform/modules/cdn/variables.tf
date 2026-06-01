variable "name_prefix" { type = string }
variable "origin_domain_name" { type = string }
variable "certificate_arn" { type = string }
variable "web_acl_arn" { type = string, default = null }
variable "tags" { type = map(string), default = {} }
