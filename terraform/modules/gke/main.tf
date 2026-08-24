# --- Node pool identity: least-privilege, NOT the default Compute Engine SA ---

resource "google_service_account" "node" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-gke-node"
  display_name = "GKE node pool SA (${var.name_prefix}) — image pulls, logging, monitoring only"
}

resource "google_project_iam_member" "node_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.node.email}"
}

# --- Workload Identity: backend pod identity (Cloud SQL + Secret Manager) ---
# Lives here (not a generic modules/iam) because the workloadIdentityUser
# binding is meaningless without this cluster's workload pool.

resource "google_service_account" "workload_backend" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-backend"
  display_name = "Workload Identity SA for the backend Pod (${var.name_prefix})"
}

resource "google_service_account_iam_member" "workload_identity_backend" {
  service_account_id = google_service_account.workload_backend.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.workload_backend_ksa_namespace}/${var.workload_backend_ksa_name}]"

  # The cluster's workload identity pool (<project>.svc.id.goog) is not
  # immediately queryable by the IAM API the moment google_container_cluster
  # reports creation complete (GCP eventual consistency). Without an explicit
  # dependency + short buffer, this binding races the pool's own propagation
  # and fails with "Identity Pool does not exist".
  depends_on = [time_sleep.wait_for_workload_identity_pool]
}

resource "time_sleep" "wait_for_workload_identity_pool" {
  depends_on      = [google_container_cluster.primary]
  create_duration = "30s"
}

# --- Cluster ---

resource "google_container_cluster" "primary" {
  project  = var.project_id
  name     = "${var.name_prefix}-gke"
  location = var.zone

  network    = var.network_self_link
  subnetwork = var.subnet_self_link

  networking_mode          = "VPC_NATIVE"
  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = false

  release_channel {
    channel = var.release_channel
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  default_max_pods_per_node = var.default_max_pods_per_node

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  secret_manager_config {
    enabled = true
  }

  # Classic GKE Ingress (ingress-gce) is in maintenance mode and did not
  # provision a load balancer on this cluster after 30+ minutes with no
  # errors (empirically confirmed). Gateway API is Google's actively
  # maintained replacement for external HTTP(S) load balancing on GKE.
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  # Dataplane V2 (Cilium). Create-time-only setting: enabling it now (free,
  # enforces nothing by itself) avoids a full cluster recreation when Stage 9
  # introduces NetworkPolicy.
  datapath_provider = "ADVANCED_DATAPATH"

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      # Stage 8 installs its own kube-prometheus-stack; leaving this on
      # would double-collect and double-bill.
      enabled = false
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  dynamic "master_authorized_networks_config" {
    for_each = length(var.master_authorized_networks) > 0 ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block = cidr_blocks.value
        }
      }
    }
  }
}

# --- Node pool (separate from the cluster resource, managed explicitly) ---

resource "google_container_node_pool" "primary" {
  project  = var.project_id
  name     = "${var.name_prefix}-pool"
  location = var.zone
  cluster  = google_container_cluster.primary.name

  node_count = var.node_min_count

  autoscaling {
    min_node_count = var.node_min_count
    max_node_count = var.node_max_count
  }

  node_config {
    machine_type = var.node_machine_type
    spot         = var.node_spot
    disk_size_gb = var.node_disk_size_gb
    disk_type    = var.node_disk_type
    image_type   = "COS_CONTAINERD"

    service_account = google_service_account.node.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  # The autoscaler (not Terraform) owns node_count after initial creation.
  lifecycle {
    ignore_changes = [node_count]
  }

  depends_on = [google_project_iam_member.node_roles]
}

# --- Reserved static IP for the GCE Ingress (created ahead of time so
#     CORS_ORIGINS/FRONTEND_BASE_URL can be set deterministically). ---

resource "google_compute_global_address" "ingress_ip" {
  project = var.project_id
  name    = "${var.name_prefix}-ingress-ip"
}
