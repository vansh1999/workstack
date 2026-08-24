variable "project_id" {
  type = string
}

variable "secrets" {
  description = "Map of secret name => { value, accessors } — accessors are GSA emails granted roles/secretmanager.secretAccessor on that specific secret (never project-wide)."
  type = map(object({
    value     = string
    accessors = list(string)
  }))
  default = {}
}
