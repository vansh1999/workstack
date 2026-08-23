WORK STACK — DEVOPS PROJECT

PROJECT

Work Stack is a simple Scrum workspace for engineering teams.

The application MVP is COMPLETE and already pushed to a private GitHub repository.

Application stack:

* Frontend: React + TypeScript + Vite
* Backend: FastAPI + Python
* Database: PostgreSQL
* API communication: REST
* Authentication: existing application implementation
* Local development: existing Docker Compose / local development setup

The application currently supports:

* Authentication
* User registration/login/logout
* Workspaces
* Workspace members
* Workspace invitations
* Projects
* Sprints
* Sprint lifecycle
* Tasks
* Backlog
* Kanban board
* Drag and drop
* Task assignment
* Reporter
* Priority
* Multi-user collaboration
* Role-based access
* Persistent database state

The application has already been manually tested.

The application layer should now be treated as the MVP baseline.

Do NOT redesign or rewrite the application unnecessarily.

⸻

DEVOPS OBJECTIVE

Turn Work Stack into a production-style DevOps/SRE project.

The final system should demonstrate:

* containerization
* Kubernetes
* Infrastructure as Code
* GCP
* GKE
* Helm
* CI
* GitOps CD
* observability
* security
* scalability
* reliability
* operational readiness

The final architecture should be:

Developer
↓
GitHub
↓
GitHub Actions
↓
Docker
↓
Artifact Registry
↓
GitOps Repository
↓
Argo CD
↓
GKE
↓
Work Stack

Infrastructure:

Terraform
↓
GCP
├── VPC
├── IAM
├── Artifact Registry
├── GKE
├── Cloud SQL
└── Secret Manager

Observability:

Terraform
↓
Helm Provider
↓
kube-prometheus-stack
├── Prometheus
├── Grafana
├── Alertmanager
├── kube-state-metrics
└── node-exporter

⸻

DEVOPS ROADMAP

Follow these stages in order.

Do not skip ahead unless explicitly instructed.

STAGE 1 — DOCKER

Containerize:

* React frontend
* FastAPI backend

Use PostgreSQL through Docker Compose for local development.

Requirements:

* production-quality Dockerfiles
* multi-stage builds where appropriate
* non-root containers
* .dockerignore
* environment configuration
* health checks
* reasonable image sizes

Goal:

docker compose up

must run the complete application locally.

⸻

STAGE 2 — LOCAL KUBERNETES

Use kind.

Create a local Kubernetes environment for Work Stack.

Resources should eventually include:

* Namespace
* Deployment
* Service
* ConfigMap
* Secret
* readinessProbe
* livenessProbe
* startupProbe where appropriate
* resource requests
* resource limits
* HPA
* PDB
* Ingress

The purpose of this stage is to understand and validate Kubernetes before using GKE.

Do not introduce Helm yet.

Initially use normal Kubernetes manifests.

⸻

STAGE 3 — TERRAFORM + GCP FOUNDATION

Introduce Terraform.

Terraform should provision GCP infrastructure including, as appropriate:

* required GCP APIs
* VPC
* subnets
* IAM/service accounts
* Artifact Registry
* GKE
* Cloud SQL
* Secret Manager

Use a modular structure.

Recommended:

terraform/
├── environments/
│   ├── dev/
│   └── prod/
└── modules/
├── network/
├── gke/
├── artifact-registry/
├── cloudsql/
└── secrets/

Use remote Terraform state in Google Cloud Storage.

Do not manually create production infrastructure in the GCP console unless necessary for bootstrapping.

⸻

STAGE 4 — GKE

Deploy Work Stack to GKE.

Initially validate the Kubernetes architecture using kubectl.

Production PostgreSQL should use Cloud SQL rather than a PostgreSQL pod.

Connect:

GKE
↓
FastAPI
↓
Cloud SQL PostgreSQL

Use Secret Manager for sensitive configuration where appropriate.

Validate:

* frontend
* backend
* database connectivity
* services
* ingress
* probes
* HPA
* PDB

⸻

STAGE 5 — HELM

Package the Work Stack Kubernetes deployment as a Helm chart.

Recommended:

helm/
└── workstack/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
└── templates/

Include templates for:

* frontend Deployment
* backend Deployment
* frontend Service
* backend Service
* ConfigMap
* Secret references
* HPA
* PDB
* Ingress
* ServiceMonitor

Validate using:

helm lint
helm template

Then install/upgrade/rollback using Helm.

⸻

STAGE 6 — CI WITH GITHUB ACTIONS

Create GitHub Actions workflows.

CI should run on pull requests and appropriate pushes.

Pipeline should include:

* backend tests
* frontend tests
* TypeScript validation
* linting
* application build
* Docker image build
* container security scanning
* push successful images to Artifact Registry

Use immutable image tags.

Preferred:

<git-sha>

Avoid deploying using:

latest

CI should produce validated Docker artifacts.

CI should not directly manage production Kubernetes deployments.

⸻

STAGE 7 — CD WITH ARGO CD

Create a separate GitOps repository.

Application repository:

* source code
* Dockerfiles
* CI

GitOps repository:

* Helm deployment configuration
* environment values
* image versions

Install and configure Argo CD on GKE.

Argo CD should watch the GitOps repository and reconcile the Kubernetes cluster.

Desired flow:

Developer
↓
GitHub
↓
GitHub Actions
↓
Docker image
↓
Artifact Registry
↓
GitOps repository
↓
Argo CD
↓
GKE

Do not have both Terraform and Argo CD permanently manage the same application resources.

Terraform owns infrastructure.

Argo CD owns application deployment.

⸻

STAGE 8 — OBSERVABILITY

Provision the observability stack using Terraform.

Use the Terraform Helm provider to install/configure:

kube-prometheus-stack

This should provide:

* Prometheus
* Grafana
* Alertmanager
* kube-state-metrics
* node-exporter

Monitor Kubernetes:

* CPU
* memory
* pod count
* pod restarts
* deployment availability
* HPA
* node health

Instrument the FastAPI application with Prometheus-compatible metrics.

Expose:

/metrics

Create a ServiceMonitor.

Grafana dashboards must focus on the SRE Four Golden Signals:

1. Traffic
2. Latency
3. Errors
4. Saturation

Include:

Traffic:

* requests/sec

Latency:

* p50
* p95
* p99

Errors:

* 4xx
* 5xx
* error rate

Saturation:

* CPU
* memory
* pod capacity
* HPA utilization

Add useful Alertmanager alerts for:

* high error rate
* high latency
* unavailable pods
* restart loops
* high CPU
* high memory
* insufficient replicas

Do not introduce Loki or OpenTelemetry initially.

Keep the first observability implementation focused on Prometheus, Grafana and Alertmanager.

⸻

STAGE 9 — PRODUCTION HARDENING

After the complete platform works, improve:

Security:

* least-privilege IAM
* Workload Identity
* Secret Manager
* NetworkPolicy
* non-root containers
* securityContext
* container scanning

Reliability:

* readiness probes
* liveness probes
* startup probes
* resource requests
* resource limits
* HPA
* PDB
* rolling deployments

Infrastructure:

* remote Terraform state
* dev/prod separation
* Cloud SQL backup strategy
* appropriate GKE configuration

Operations:

* SLOs
* alerts
* runbooks
* failure testing
* rollback procedures

Simulate failures:

* kill backend pod
* increase traffic
* deploy a bad image
* cause database connectivity failure
* observe alerts
* recover/rollback

⸻

ENGINEERING PRINCIPLES

Follow these principles throughout the project.

1. Do not introduce a tool unless it has a clear responsibility.
2. Prefer simple architecture over unnecessary complexity.
3. Do not rewrite working application code without a reason.
4. Keep application concerns separate from infrastructure concerns.
5. Keep infrastructure separate from application deployment.
6. Terraform owns cloud infrastructure.
7. Argo CD owns application deployment.
8. Helm packages Kubernetes applications.
9. GitHub Actions owns CI.
10. Prometheus collects metrics.
11. Grafana visualizes metrics.
12. Alertmanager handles alerts.
13. Use immutable container image tags.
14. Never commit secrets.
15. Validate security server-side.
16. Prefer reproducible infrastructure.
17. Test locally before moving to GCP.
18. Understand each Kubernetes resource before abstracting it with Helm.
19. Do not introduce service meshes, Kafka, Redis, OpenTelemetry, Loki, or other infrastructure unless a later requirement actually justifies them.
20. Keep costs under control while learning.

⸻

PROJECT QUALITY BAR

At the end of the project, the system should be explainable from first principles.

I should be able to explain:

* why Docker is used
* why Kubernetes is used
* why GKE is used
* why Terraform is used
* why Helm is used
* why GitHub Actions is used
* why Argo CD is used
* why Prometheus is used
* why Grafana is used
* why Cloud SQL is used
* how traffic reaches the application
* how deployments happen
* how rollback happens
* how scaling happens
* how failures are detected
* how secrets are handled
* how infrastructure is recreated

The project should be understandable enough that I can discuss the architecture in a DevOps/SRE interview.

⸻

IMPLEMENTATION RULE

Work one stage at a time.

Before implementing a stage:

1. Inspect the existing repository.
2. Understand the current implementation.
3. Identify what the stage needs.
4. Explain the proposed changes.
5. Implement only that stage.

After implementing:

1. Run relevant tests.
2. Run validation/linting.
3. Build where applicable.
4. Manually verify the result.
5. Report what changed.
6. Report commands used.
7. Report any issues.
8. Do not silently move into the next stage.

Do not make unrelated application changes.

The current application MVP is considered complete.

Start with:

STAGE 1 — DOCKER


# CURRENT STATUS

Application MVP: COMPLETE

The 3-tier application is working:

React
  ↓
FastAPI
  ↓
PostgreSQL

The MVP has been manually tested and pushed to GitHub.

Current DevOps stage:

STAGE 1 — DOCKER

The immediate objective is to containerize the existing Work Stack application.

Do not start Stage 2 or any later stage until Stage 1 is explicitly completed and verified.

Current roadmap:

1. Docker
2. Local Kubernetes
3. Terraform + GCP Foundation
4. GKE
5. Helm
6. GitHub Actions CI
7. Argo CD GitOps CD
8. Observability
9. Production Hardening

# We have completed Stage 1 — Docker.

The Dockerized Work Stack has been manually verified:

- frontend, backend and PostgreSQL run successfully with Docker Compose
- backend migrations run automatically and idempotently
- frontend Nginx proxies /api to FastAPI
- cookie authentication works through the proxy
- containers run as non-root
- fresh boot from wiped volumes works
- application functionality has not been changed

Start (after first build, or when nothing changed):

docker compose up -d
Start with a rebuild (after editing a Dockerfile, requirements.txt, or app source):

docker compose up -d --build
Stop (keeps containers/volumes, e.g. Postgres data, for next time):

docker compose stop
Stop and remove containers (keeps the postgres_data volume, so your DB persists):

docker compose down
Full reset (removes containers and the Postgres volume — wipes all data, next up starts from an empty DB and reruns migrations):

docker compose down -v

# Now begin STAGE 2 — LOCAL KUBERNETES.

Use kind for the local Kubernetes cluster.

IMPORTANT:
- Do NOT introduce Helm yet.
- Do NOT introduce Terraform yet.
- Do NOT introduce GKE yet.
- Do NOT introduce Argo CD.
- Do NOT introduce Prometheus/Grafana.
- Use plain Kubernetes manifests.
- Do not modify application functionality unless Kubernetes requires a small compatibility change.
- Reuse the Docker images from Stage 1.

First inspect the existing repository and CLAUDE.md.

Then propose the Kubernetes architecture and implementation plan before modifying files.

The target Kubernetes resources are:

workstack namespace

Frontend:
- Deployment
- Service

Backend:
- Deployment
- Service

PostgreSQL:
- Deployment
- Service
- PersistentVolumeClaim

Configuration:
- ConfigMap
- Secret

Reliability:
- readiness probes
- liveness probes
- resource requests
- resource limits
- HPA
- PDB

Networking:
- Ingress

Start simple and implement incrementally.

The important learning objective is to understand what each Kubernetes resource does rather than hiding everything behind abstractions.

The desired application flow is:

Ingress
  ↓
Frontend Service
  ↓
Frontend Pods
  ↓
Backend Service
  ↓
Backend Pods
  ↓
PostgreSQL Service
  ↓
PostgreSQL Pod
  ↓
PersistentVolume

For local Kubernetes, PostgreSQL may run inside the kind cluster. This is intentionally different from the eventual GKE architecture, where production PostgreSQL will use Cloud SQL.

Make the Kubernetes manifests reproducible and organized.

Suggested structure:

k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── postgres/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── pvc.yaml
├── backend/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   └── pdb.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
└── ingress.yaml

You may adjust this structure if there is a better reason, but explain why.

Use the existing Docker images rather than rebuilding the application architecture.

For local image loading, use the appropriate kind workflow so the cluster can run the locally built images without requiring a registry.

Verification must include:

1. Create a clean kind cluster.
2. Create the workstack namespace.
3. Load the Work Stack Docker images into kind.
4. Apply Kubernetes manifests.
5. Verify all pods become Ready.
6. Verify Services.
7. Verify PostgreSQL persistence.
8. Verify backend /health.
9. Verify frontend access.
10. Verify frontend → backend communication.
11. Verify authentication through the frontend.
12. Delete/recreate a PostgreSQL pod and verify persistent data remains.
13. Test readiness/liveness behavior.
14. Test HPA configuration.
15. Test PDB configuration.
16. Test Ingress routing.

Run appropriate Kubernetes validation commands and tests.

At the end report:

- files created/modified
- Kubernetes architecture
- resources created
- commands used
- verification results
- problems encountered
- anything intentionally deferred

Do not start Stage 3.

Stop after Stage 2 is complete and verified.


# CURRENT STATUS

Application MVP: COMPLETE

Stage 1 — Docker: COMPLETE

Stage 2 — Local Kubernetes: COMPLETE

Verified:
- Work Stack runs in Docker Compose
- Work Stack runs on a dedicated kind cluster named workstack
- Frontend, backend and PostgreSQL run successfully
- Kubernetes Deployments and Services work
- PostgreSQL persistence verified through PVC
- Backend HPA is receiving real metrics
- PDB behavior verified
- Ingress routing works
- Full authentication flow works through Kubernetes Ingress
- No application code changes were required

Current DevOps stage:

STAGE 3 — TERRAFORM + GCP FOUNDATION

The immediate objective is to build the GCP infrastructure foundation using Terraform.

Do not start GKE, Helm, GitHub Actions, Argo CD, or observability yet.





