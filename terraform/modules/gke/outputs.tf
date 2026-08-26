output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_location" {
  value = google_container_cluster.primary.location
}

output "node_service_account_email" {
  value = google_service_account.node.email
}

output "workload_service_account_email" {
  value = google_service_account.workload_backend.email
}

output "ingress_static_ip_address" {
  value = google_compute_global_address.ingress_ip.address
}

output "ingress_static_ip_name" {
  value = google_compute_global_address.ingress_ip.name
}

output "get_credentials_command" {
  value = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --zone ${google_container_cluster.primary.location} --project ${var.project_id}"
}

output "cluster_endpoint" {
  description = "GKE API server endpoint — for wiring the kubernetes/helm Terraform providers."
  value       = google_container_cluster.primary.endpoint
}

output "cluster_ca_certificate" {
  description = "Base64-encoded cluster CA cert — for wiring the kubernetes/helm Terraform providers."
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}
