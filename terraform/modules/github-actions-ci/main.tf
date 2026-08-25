# --- Workload Identity Federation: lets GitHub Actions impersonate a GCP
#     service account via OIDC, with no downloaded key. Scoped to one repo
#     and (via the SA binding below) one ref. ---

resource "google_iam_workload_identity_pool" "github_actions" {
  project                   = var.project_id
  workload_identity_pool_id = var.pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC federation for GitHub Actions CI (this repo only)."
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions.workload_identity_pool_id
  workload_identity_pool_provider_id = var.provider_id
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Belt-and-suspenders with the SA binding's principalSet below: even if
  # this provider were somehow referenced from another repo's workflow, no
  # token would be accepted past this condition.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# --- CI service account: push-to-Artifact-Registry only (role granted in
#     environments/dev, extending the artifact-registry module's bindings
#     map — this module intentionally does not grant any roles itself). ---

resource "google_service_account" "ci" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = "GitHub Actions CI (${var.github_repository}) — Artifact Registry push only"
}

resource "time_sleep" "wait_for_wif_provider" {
  # Same eventual-consistency issue as the GKE module's own workload
  # identity pool: the provider isn't immediately queryable by the IAM API
  # the moment Terraform reports it created, so the SA binding below can
  # race it and fail with "Workload Identity Pool does not exist".
  depends_on      = [google_iam_workload_identity_pool_provider.github_actions]
  create_duration = "30s"
}

resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.ci.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions.name}/attribute.ref/${var.restrict_ref}"

  depends_on = [time_sleep.wait_for_wif_provider]
}
