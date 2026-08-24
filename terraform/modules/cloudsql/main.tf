resource "random_password" "db" {
  length  = 32
  special = false # avoids needing to percent-encode the password inside DATABASE_URL
}

resource "google_sql_database_instance" "pg" {
  project             = var.project_id
  name                = "${var.name_prefix}-pg"
  region              = var.region
  database_version    = "POSTGRES_16" # matches local postgres:16-alpine exactly
  deletion_protection = false

  settings {
    tier                        = var.tier
    edition                     = "ENTERPRISE"
    availability_type           = "ZONAL" # no HA — Stage 9 owns that decision
    disk_type                   = "PD_SSD"
    disk_size                   = var.disk_size_gb
    disk_autoresize             = true
    disk_autoresize_limit       = var.disk_autoresize_limit_gb
    deletion_protection_enabled = false

    ip_configuration {
      ipv4_enabled    = false # private IP only, no public endpoint at all
      private_network = var.network_id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false # PITR deferred to Stage 9's backup-strategy work
      backup_retention_settings {
        retained_backups = 3
        retention_unit   = "COUNT"
      }
    }

    database_flags {
      name  = "max_connections"
      value = tostring(var.max_connections)
    }

    maintenance_window {
      day          = 7
      hour         = 4
      update_track = "stable"
    }
  }
}

resource "google_sql_database" "app" {
  project  = var.project_id
  name     = var.db_name
  instance = google_sql_database_instance.pg.name
}

resource "google_sql_user" "app" {
  project  = var.project_id
  name     = var.db_user
  instance = google_sql_database_instance.pg.name
  password = random_password.db.result
}

# Cloud SQL has no resource-level IAM — roles/cloudsql.client must be
# project-scoped. It only grants "connect via the proxy/connectors", not any
# data access (Postgres auth still gates that) or admin capability.
resource "google_project_iam_member" "cloudsql_client" {
  for_each = toset(var.client_service_accounts)

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${each.value}"
}
