resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = "${var.name_prefix}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  project       = var.project_id
  name          = "${var.name_prefix}-subnet"
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.subnet_cidr

  # Keeps Google API traffic (Artifact Registry, Secret Manager, sqladmin)
  # on Google's backbone instead of the public internet, even though nodes
  # have external IPs. Free to enable.
  private_ip_google_access = true

  dynamic "secondary_ip_range" {
    for_each = var.secondary_ranges
    content {
      range_name    = secondary_ip_range.key
      ip_cidr_range = secondary_ip_range.value
    }
  }
}

# Private Service Access: required for Cloud SQL private IP. This is a
# VPC-scoped singleton (one peering connection per VPC to
# servicenetworking.googleapis.com), so it lives here rather than in
# modules/cloudsql to avoid two consumer modules ever fighting over it.
resource "google_compute_global_address" "psa" {
  count = var.enable_private_service_access ? 1 : 0

  project       = var.project_id
  name          = "${var.name_prefix}-psa-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  address       = split("/", var.psa_cidr)[0]
  prefix_length = tonumber(split("/", var.psa_cidr)[1])
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "psa" {
  count = var.enable_private_service_access ? 1 : 0

  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.psa[0].name]
}

resource "google_compute_firewall" "allow_internal" {
  project = var.project_id
  name    = "${var.name_prefix}-allow-internal"
  network = google_compute_network.vpc.id

  direction = "INGRESS"
  source_ranges = [
    var.subnet_cidr,
  ]

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }
}
