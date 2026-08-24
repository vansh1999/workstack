resource "google_secret_manager_secret" "this" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = each.key

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "this" {
  for_each = var.secrets

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value.value
}

locals {
  accessor_pairs = flatten([
    for secret_name, cfg in var.secrets : [
      for accessor in cfg.accessors : {
        key      = "${secret_name}::${accessor}"
        secret   = secret_name
        accessor = accessor
      }
    ]
  ])
}

resource "google_secret_manager_secret_iam_member" "accessors" {
  for_each = { for pair in local.accessor_pairs : pair.key => pair }

  project   = var.project_id
  secret_id = google_secret_manager_secret.this[each.value.secret].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value.accessor}"
}
