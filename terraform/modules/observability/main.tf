resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = var.namespace
  }
}

# Grafana admin password — Terraform-generated instead of the chart's known
# default ("prom-operator"). Retrieve with:
#   terraform output -raw grafana_admin_password
resource "random_password" "grafana_admin" {
  length  = 20
  special = false
}

resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = var.chart_version
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  # Default 300s is tight here: the autoscaler may need to spin up a new
  # spot node before all of Prometheus/Grafana/kube-state-metrics/
  # node-exporter can schedule.
  timeout = 600

  values = [
    yamlencode({
      # Deferred: Stage 8 scope is Prometheus + Grafana only.
      alertmanager = {
        enabled = false
      }

      # GKE's control plane is Google-managed and not scrapable — these
      # targets would just sit permanently "down" and add alert noise.
      kubeControllerManager = { enabled = false }
      kubeScheduler         = { enabled = false }
      kubeEtcd              = { enabled = false }
      kubeProxy             = { enabled = false }

      prometheus = {
        prometheusSpec = {
          # nil-uses-Helm-values (the chart default) would otherwise only
          # discover ServiceMonitors/PodMonitors/Rules carrying this
          # release's own `release` label — false means "select everything
          # cluster-wide", so helm/workstack's backend ServiceMonitor is
          # picked up without needing to know this release's name.
          serviceMonitorSelectorNilUsesHelmValues = false
          podMonitorSelectorNilUsesHelmValues     = false
          ruleSelectorNilUsesHelmValues           = false

          retention = var.prometheus_retention

          resources = {
            requests = { cpu = "100m", memory = "256Mi" }
            limits   = { cpu = "500m", memory = "512Mi" }
          }

          # Small persistent disk so spot-node preemption / pod restarts
          # don't wipe metric history.
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                accessModes = ["ReadWriteOnce"]
                resources = {
                  requests = { storage = var.prometheus_storage_size }
                }
              }
            }
          }
        }
      }

      grafana = {
        adminPassword = random_password.grafana_admin.result
        # Dashboards are provisioned as code (see the ConfigMap below), not
        # clicked together in the UI, so no PVC is needed to preserve them.
        persistence = { enabled = false }
        resources = {
          requests = { cpu = "50m", memory = "128Mi" }
          limits   = { cpu = "200m", memory = "256Mi" }
        }
        sidecar = {
          dashboards = {
            enabled = true
            label   = "grafana_dashboard"
          }
        }
      }
    })
  ]
}

# Golden-signals dashboard as code: the chart's Grafana sidecar watches for
# ConfigMaps carrying label grafana_dashboard=1 in this namespace and loads
# them automatically — no manual import step.
resource "kubernetes_config_map" "golden_signals_dashboard" {
  metadata {
    name      = "workstack-golden-signals"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "workstack-golden-signals.json" = templatefile("${path.module}/dashboards/golden-signals.json.tftpl", {
      app_namespace = var.app_namespace
    })
  }
}
