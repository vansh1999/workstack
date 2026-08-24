variable "project_id" {
  description = "GCP project ID (same existing project as bootstrap)."
  type        = string
  default     = "workstack-devops-vb"
}

variable "region" {
  description = "Region for all regional resources in this environment."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zone for the zonal GKE cluster."
  type        = string
  default     = "us-central1-a"
}
