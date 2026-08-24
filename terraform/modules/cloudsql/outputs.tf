output "instance_name" {
  value = google_sql_database_instance.pg.name
}

output "connection_name" {
  description = "project:region:instance — the string the Cloud SQL Auth Proxy needs."
  value       = google_sql_database_instance.pg.connection_name
}

output "private_ip_address" {
  value = google_sql_database_instance.pg.private_ip_address
}

output "db_name" {
  value = google_sql_database.app.name
}

output "db_user" {
  value = google_sql_user.app.name
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
