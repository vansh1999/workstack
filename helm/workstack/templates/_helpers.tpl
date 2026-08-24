{{/*
Deliberately minimal: this is a single-app chart, not a library chart, and
resource names must stay unprefixed (backend, frontend, postgres, ...) to
match the objects already live on GKE from the pre-Helm kubectl apply. Do
not add a fullname helper that prefixes names with the release name -
Kubernetes treats an object rename as delete+recreate, which would drop the
GKE Gateway's already-provisioned NEG bindings, the backend PVC (kind), and
HPA history.
*/}}

{{- define "workstack.chart" -}}
{{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "workstack.labels" -}}
helm.sh/chart: {{ include "workstack.chart" . }}
app.kubernetes.io/part-of: workstack
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}
