variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "network_id" {
  description = "Self link/ID of the VPC to attach this instance's private IP to. The caller must ensure Private Service Access is already set up on this VPC (module dependency, not a variable here)."
  type        = string
}

variable "db_name" {
  type    = string
  default = "workstack"
}

variable "db_user" {
  type    = string
  default = "workstack"
}

variable "tier" {
  type    = string
  default = "db-f1-micro"
}

variable "disk_size_gb" {
  type    = number
  default = 10
}

variable "disk_autoresize_limit_gb" {
  type    = number
  default = 20
}

variable "max_connections" {
  description = "Postgres max_connections flag. db-f1-micro defaults to ~25, which SQLAlchemy's pool (5+10 overflow per pod) x the backend HPA's 3 replicas can exceed under load."
  type        = number
  default     = 100
}

variable "client_service_accounts" {
  description = "GSA emails granted roles/cloudsql.client (project-level — Cloud SQL has no resource-level IAM)."
  type        = list(string)
  default     = []
}
