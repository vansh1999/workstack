output "project_id" {
  description = "GCP project ID used by all Terraform configs in this repo."
  value       = var.project_id
}

output "state_bucket_name" {
  description = "GCS bucket holding remote Terraform state for environments/*."
  value       = google_storage_bucket.tf_state.name
}
