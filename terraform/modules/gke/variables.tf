variable "project_id" {
  type = string
}

variable "zone" {
  description = "Zone for this zonal GKE cluster, e.g. us-central1-a."
  type        = string
}

variable "name_prefix" {
  description = "Prefix used to name the cluster/node pool/service accounts, e.g. \"workstack-dev\"."
  type        = string
}

variable "network_self_link" {
  type = string
}

variable "subnet_self_link" {
  type = string
}

variable "pods_range_name" {
  type = string
}

variable "services_range_name" {
  type = string
}

variable "release_channel" {
  type    = string
  default = "REGULAR"
}

variable "default_max_pods_per_node" {
  type    = number
  default = 32
}

variable "master_authorized_networks" {
  description = "CIDR blocks allowed to reach the cluster's public control-plane endpoint. Empty (default) leaves the endpoint open (still protected by IAM + TLS) since no master_authorized_networks_config block is created at all."
  type        = list(string)
  default     = []
}

variable "node_machine_type" {
  type    = string
  default = "e2-medium"
}

variable "node_spot" {
  type    = bool
  default = true
}

variable "node_min_count" {
  type    = number
  default = 2
}

variable "node_max_count" {
  type    = number
  default = 4
}

variable "node_disk_size_gb" {
  type    = number
  default = 50
}

variable "node_disk_type" {
  type    = string
  default = "pd-balanced"
}

variable "workload_backend_ksa_namespace" {
  type    = string
  default = "workstack"
}

variable "workload_backend_ksa_name" {
  type    = string
  default = "workstack-backend"
}
