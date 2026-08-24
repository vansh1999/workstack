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

variable "secondary_ranges" {
  description = "Map of secondary range name => CIDR to add to the subnet (e.g. GKE pod/service ranges)."
  type        = map(string)
  default     = {}
}

variable "enable_private_service_access" {
  description = "Whether to allocate a VPC-peering IP range and create the Private Service Access connection (required for Cloud SQL private IP)."
  type        = bool
  default     = false
}

variable "psa_cidr" {
  description = "CIDR reserved for the Private Service Access peering range (address + prefix length are parsed from this)."
  type        = string
  default     = "10.20.0.0/20"
}
