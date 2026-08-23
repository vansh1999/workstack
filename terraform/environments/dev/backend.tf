terraform {
  backend "gcs" {
    bucket = "workstack-devops-vb-tfstate"
    prefix = "dev"
  }
}
