variable "namespace" {
  description = "Kubernetes namespace for the observability stack."
  type        = string
  default     = "monitoring"
}

variable "app_namespace" {
  description = "Namespace the Work Stack application runs in — dashboard queries are scoped to it."
  type        = string
  default     = "workstack"
}

variable "chart_version" {
  description = "kube-prometheus-stack Helm chart version, pinned for reproducibility."
  type        = string
  default     = "88.5.4"
}

variable "prometheus_retention" {
  description = "How long Prometheus keeps metric history."
  type        = string
  default     = "5d"
}

variable "prometheus_storage_size" {
  description = "Size of the PersistentVolumeClaim backing Prometheus's TSDB."
  type        = string
  default     = "10Gi"
}
