output "ci_service_account_email" {
  value = google_service_account.ci.email
}

output "workload_identity_provider_resource_name" {
  description = "Full resource name to pass as workload_identity_provider in google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github_actions.name
}
