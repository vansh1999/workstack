variable "project_id" {
  description = "GCP project ID to create the Artifact Registry repository in."
  type        = string
}

variable "region" {
  description = "Location for the Artifact Registry repository."
  type        = string
}

variable "repository_id" {
  description = "Name of the Docker repository."
  type        = string
  default     = "workstack"
}

variable "bindings" {
  description = "Optional map of role => list(member) IAM bindings on the repository, for later stages (e.g. GKE Workload Identity SA, CI pusher) to extend without restructuring this module."
  type        = map(list(string))
  default     = {}
}
