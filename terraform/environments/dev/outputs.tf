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
