resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  format        = "DOCKER"
  description   = "Docker images for Work Stack (workstack-backend, workstack-frontend)."
}

resource "google_artifact_registry_repository_iam_binding" "bindings" {
  for_each = var.bindings

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.docker.repository_id
  role       = each.key
  members    = each.value
}
