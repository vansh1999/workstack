variable "project_id" {
  description = "Existing GCP project ID that this Terraform config bootstraps (not created here — it already exists)."
  type        = string
  default     = "workstack-devops-vb"
}

variable "region" {
  description = "Default region for regional resources (the state bucket's location)."
  type        = string
  default     = "us-central1"
}
