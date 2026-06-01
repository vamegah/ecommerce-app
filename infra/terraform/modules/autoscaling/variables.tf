variable "name_prefix" { type = string }
variable "cluster_name" { type = string }
variable "service_name" { type = string }
variable "min_capacity" { type = number, default = 2 }
variable "max_capacity" { type = number, default = 8 }
variable "cpu_target" { type = number, default = 55 }
variable "cpu_alarm_threshold" { type = number, default = 75 }
