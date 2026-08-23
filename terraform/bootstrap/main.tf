terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Intentionally local state: this config creates the very GCS bucket that
  # every other Terraform config in this repo uses as its remote backend, so
  # it cannot depend on that backend itself.
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Project workstack-devops-vb already exists (created outside Terraform) and
# already has billing enabled, so there is no google_project resource here —
# only the baseline APIs and the Terraform state bucket.

resource "google_project_service" "baseline" {
  for_each = toset([
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_storage_bucket" "tf_state" {
  name     = "${var.project_id}-tfstate"
  project  = var.project_id
  location = var.region

  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  # Bound the cost/clutter of keeping every historical state version forever.
  lifecycle_rule {
    condition {
      num_newer_versions = 10
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.baseline]
}
