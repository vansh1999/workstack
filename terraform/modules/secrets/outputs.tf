output "secret_names" {
  value = { for k, v in google_secret_manager_secret.this : k => v.secret_id }
}

output "secret_resource_paths" {
  description = "projects/<id>/secrets/<name>/versions/latest — paste directly into a SecretProviderClass."
  value = {
    for k, v in google_secret_manager_secret.this :
    k => "projects/${var.project_id}/secrets/${v.secret_id}/versions/latest"
  }
}
