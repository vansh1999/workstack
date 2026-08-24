output "vpc_id" {
  description = "Self link/ID of the created VPC."
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  value = google_compute_network.vpc.name
}

output "subnet_id" {
  description = "Self link/ID of the created subnet."
  value       = google_compute_subnetwork.subnet.id
}

output "subnet_name" {
  value = google_compute_subnetwork.subnet.name
}

output "subnet_self_link" {
  value = google_compute_subnetwork.subnet.self_link
}

output "psa_connection" {
  description = "The google_service_networking_connection resource, for other modules to depend_on before creating private-IP resources (e.g. Cloud SQL)."
  value       = var.enable_private_service_access ? google_service_networking_connection.psa[0] : null
}
