variable "project_id" {
  description = "GCP project ID to create network resources in."
  type        = string
}

variable "region" {
  description = "Region for the subnet."
  type        = string
}

variable "name_prefix" {
  description = "Prefix used to name the VPC/subnet/firewall rule, e.g. \"workstack-dev\"."
  type        = string
}

variable "subnet_cidr" {
  description = "Primary IP range for the subnet."
  type        = string
  default     = "10.10.0.0/20"
}
