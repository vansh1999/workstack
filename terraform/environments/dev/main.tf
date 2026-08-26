terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.16"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.33"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Auth for the kubernetes/helm providers below: reuses the same gcloud
# application-default credentials the google provider already uses, so no
# separate service-account key or kubeconfig file is needed.
data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${module.gke.cluster_endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(module.gke.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = "https://${module.gke.cluster_endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(module.gke.cluster_ca_certificate)
  }
}

resource "google_project_service" "dev" {
  for_each = toset([
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_dependent_services = false
  disable_on_destroy         = false
}

module "network" {
  source = "../../modules/network"

  project_id  = var.project_id
  region      = var.region
  name_prefix = "workstack-dev"

  secondary_ranges = {
    "workstack-dev-pods"     = "10.10.16.0/21"
    "workstack-dev-services" = "10.10.24.0/22"
  }
  enable_private_service_access = true
  psa_cidr                      = "10.20.0.0/20"

  depends_on = [google_project_service.dev]
}

module "gke" {
  source = "../../modules/gke"

  project_id  = var.project_id
  zone        = var.zone
  name_prefix = "workstack-dev"

  network_self_link   = module.network.vpc_id
  subnet_self_link    = module.network.subnet_self_link
  pods_range_name     = "workstack-dev-pods"
  services_range_name = "workstack-dev-services"

  depends_on = [module.network, google_project_service.dev]
}

module "github_actions_ci" {
  source = "../../modules/github-actions-ci"

  project_id        = var.project_id
  github_repository = "vansh1999/workstack"

  depends_on = [google_project_service.dev]
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id    = var.project_id
  region        = var.region
  repository_id = "workstack"

  bindings = {
    "roles/artifactregistry.reader" = [
      "serviceAccount:${module.gke.node_service_account_email}",
    ]
    "roles/artifactregistry.writer" = [
      "serviceAccount:${module.github_actions_ci.ci_service_account_email}",
    ]
  }

  depends_on = [google_project_service.dev, module.gke, module.github_actions_ci]
}

module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id  = var.project_id
  region      = var.region
  name_prefix = "workstack-dev"

  network_id = module.network.vpc_id

  client_service_accounts = [
    module.gke.workload_service_account_email,
  ]

  depends_on = [module.network, module.gke, google_project_service.dev]
}

locals {
  database_url = "postgresql+psycopg://${module.cloudsql.db_user}:${module.cloudsql.db_password}@127.0.0.1:5432/${module.cloudsql.db_name}"
}

resource "random_id" "app_secret_key" {
  byte_length = 32
}

module "secrets" {
  source = "../../modules/secrets"

  project_id = var.project_id

  secrets = {
    "workstack-dev-database-url" = {
      value     = local.database_url
      accessors = [module.gke.workload_service_account_email]
    }
    "workstack-dev-app-secret-key" = {
      value     = random_id.app_secret_key.hex
      accessors = [module.gke.workload_service_account_email]
    }
    "workstack-dev-db-password" = {
      value     = module.cloudsql.db_password
      accessors = [] # human/debug access only, via `gcloud secrets versions access`
    }
  }

  depends_on = [module.cloudsql, module.gke]
}

module "observability" {
  source = "../../modules/observability"

  app_namespace = "workstack"

  depends_on = [module.gke]
}
