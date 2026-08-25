variable "project_id" {
  type = string
}

variable "github_repository" {
  description = "GitHub \"org/repo\" allowed to mint tokens against this pool."
  type        = string
  default     = "vansh1999/workstack"
}

variable "pool_id" {
  type    = string
  default = "github-actions-pool"
}

variable "provider_id" {
  type    = string
  default = "github-actions-provider"
}

variable "service_account_id" {
  description = "Account ID for the CI service account (max 30 chars)."
  type        = string
  default     = "workstack-ci"
}

variable "restrict_ref" {
  description = "Only this git ref may impersonate the CI service account, e.g. refs/heads/main. Rejects PR-triggered runs at the GCP layer even if a workflow mistakenly requested a token."
  type        = string
  default     = "refs/heads/main"
}
