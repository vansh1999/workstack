output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "vpc_name" {
  value = module.network.vpc_name
}

output "subnet_name" {
  value = module.network.subnet_name
}

output "subnet_self_link" {
  value = module.network.subnet_self_link
}

output "artifact_registry_repository_url" {
  value = module.artifact_registry.repository_url
}

output "cluster_name" {
  value = module.gke.cluster_name
}

output "cluster_location" {
  value = module.gke.cluster_location
}

output "get_credentials_command" {
  value = module.gke.get_credentials_command
}

output "gke_node_service_account_email" {
  value = module.gke.node_service_account_email
}

output "gke_workload_service_account_email" {
  value = module.gke.workload_service_account_email
}

output "ingress_static_ip" {
  value = module.gke.ingress_static_ip_address
}

output "cloudsql_instance_connection_name" {
  value = module.cloudsql.connection_name
}

output "cloudsql_private_ip" {
  value = module.cloudsql.private_ip_address
}

output "secret_resource_paths" {
  value = module.secrets.secret_resource_paths
}

output "ci_service_account_email" {
  value = module.github_actions_ci.ci_service_account_email
}

output "workload_identity_provider_resource_name" {
  value = module.github_actions_ci.workload_identity_provider_resource_name
}
