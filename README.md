# Work Stack

Work Stack is two things layered on top of each other:

1. **A working Scrum/project-management web app** — React + FastAPI + PostgreSQL, with auth, workspaces, projects, sprints, and a drag-and-drop Kanban board.
2. **A production-style DevOps/SRE learning project** built *around* that app — Docker → Kubernetes → Terraform → GKE → Helm → CI → GitOps CD → Observability, in that order, each stage understood and verified before the next one starts.

The application layer is intentionally simple and treated as a fixed MVP baseline. The interesting engineering in this repository is the platform built underneath it: how the app is containerized, deployed, delivered, and observed the way a real small production service would be.

> This README documents the whole project end to end — the product idea, the application itself, and every one of the 9 DevOps stages, with the actual commands used at each step. It's long by design: it doubles as the project's own runbook and as the story of *why* each tool was introduced, not just *that* it was.

---

## Table of contents

- [Project idea](#project-idea)
- [Part 1 — The Work Stack application](#part-1--the-work-stack-application)
  - [Application stack](#application-stack)
  - [The 5 application phases](#the-5-application-phases)
  - [Authentication & authorization notes](#authentication--authorization-notes)
- [Part 2 — The DevOps platform](#part-2--the-devops-platform)
  - [DevOps objective](#devops-objective)
  - [Target architecture](#target-architecture)
  - [Engineering principles](#engineering-principles)
  - [Roadmap at a glance](#roadmap-at-a-glance)
- [Stage 1 — Docker](#stage-1--docker)
- [Stage 2 — Local Kubernetes (kind)](#stage-2--local-kubernetes-kind)
- [Stage 3 — Terraform + GCP foundation](#stage-3--terraform--gcp-foundation)
- [Stage 4 — GKE](#stage-4--gke)
- [Stage 5 — Helm](#stage-5--helm)
- [Stage 6 — GitHub Actions CI](#stage-6--github-actions-ci)
- [Stage 7 — Argo CD / GitOps CD](#stage-7--argo-cd--gitops-cd)
- [Stage 8 — Observability](#stage-8--observability)
- [Stage 9 — Production hardening (planned)](#stage-9--production-hardening-planned)
- [Repository structure](#repository-structure)
- [Clone & run it yourself](#clone--run-it-yourself)
  - [Option A — Docker Compose (fastest, no cloud needed)](#option-a--docker-compose-fastest-no-cloud-needed)
  - [Option B — Local Kubernetes with kind](#option-b--local-kubernetes-with-kind)
  - [Option C — Full cloud stack on your own GCP project](#option-c--full-cloud-stack-on-your-own-gcp-project)
- [Environment variables reference](#environment-variables-reference)
- [Operational runbooks](#operational-runbooks)
  - [Stop / start the GKE stack to save cost](#stop--start-the-gke-stack-to-save-cost)
  - [Rolling back a deployment](#rolling-back-a-deployment)
  - [Full teardown](#full-teardown)
- [Ownership boundaries (who manages what)](#ownership-boundaries-who-manages-what)
- [Cost notes](#cost-notes)
- [What I can explain about this system](#what-i-can-explain-about-this-system)

---

## Project idea

Most "DevOps portfolio" projects are either a toy app with no real infrastructure, or infrastructure with no real app behind it. Work Stack was built to avoid both: a genuinely functional multi-user Scrum tool — the kind of thing a small engineering team could actually use to plan sprints and run a Kanban board — deployed the way a real (small) production service would be, end to end, on real cloud infrastructure.

The two halves have deliberately different rules:

- **The application** (frontend, backend, database schema, business logic) is frozen once it reaches MVP. It is not redesigned, refactored, or "improved" as the DevOps work progresses — application concerns and infrastructure concerns are kept strictly separate, and this repo does not turn into a moving target on both axes at once.
- **The platform** (how the app is built, shipped, run, and watched) is built up one deliberate stage at a time — Docker first, then Kubernetes locally, then real cloud infrastructure via Terraform, then GKE, then Helm, then CI, then GitOps CD, then observability — with each stage manually verified before the next begins. Nothing is skipped ahead of schedule, and no tool is introduced without a clear, single responsibility.

The end state is a system where the answer to "why is X used here" is always a real reason: Docker for reproducible builds and isolation, Kubernetes for orchestration and self-healing, Terraform for reproducible infrastructure, GKE for a managed control plane, Helm for packaging the app as one reviewable unit, GitHub Actions for CI, Argo CD for GitOps-driven CD, and Prometheus/Grafana for the four golden signals — nothing extra, nothing decorative.

---

## Part 1 — The Work Stack application

### Application stack

```
React (Vite, TypeScript)  →  FastAPI (Python)  →  PostgreSQL
        frontend/                backend/            via SQLAlchemy + Alembic
```

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, built with Vite 8, `react-router-dom` 7, `@dnd-kit/core` for drag-and-drop, `oxlint` for linting, Vitest + Testing Library for tests |
| Backend | FastAPI 0.141, SQLAlchemy 2.0 (ORM), Alembic (migrations), Pydantic v2 (validation/settings), `psycopg[binary]` 3 (Postgres driver), `bcrypt` (password hashing), `pyjwt` (session tokens), `prometheus-fastapi-instrumentator` (metrics) |
| Database | PostgreSQL 16 |
| API | REST, all routes under `/api/v1` |
| Auth | Cookie-based JWT sessions, implemented directly in the app (no external identity provider) |
| Local dev | Docker Compose (Postgres in a container; frontend/backend can run natively or containerized) |
| Tests | `pytest` + `httpx` (backend, against a real Postgres test database), `vitest` (frontend) |

Backend module layout (`backend/app/`):

```
app/
├── main.py                 # FastAPI app, /health, /metrics, middleware
├── api/v1/
│   ├── router.py           # mounts all v1 routers
│   ├── deps.py             # shared dependencies (current user, workspace membership, etc.)
│   ├── auth.py             # register / login / logout / me
│   ├── workspaces.py       # workspaces + members
│   ├── invitations.py      # workspace invitations
│   ├── projects.py         # projects
│   ├── sprints.py          # sprints + lifecycle
│   └── tasks.py            # tasks + board
├── core/
│   ├── config.py           # Pydantic settings (env-driven)
│   └── security.py         # password hashing, JWT issuing/verification
├── db/
│   ├── base.py             # declarative base
│   └── session.py          # SQLAlchemy session/engine
├── models/                 # user, workspace, project, sprint, task
└── schemas/                # Pydantic request/response models
```

Frontend layout (`frontend/src/`): `api/` (typed API client), `components/`, `context/` (auth/workspace context), `hooks/`, `lib/`, `pages/`, `styles/`.

### The 5 application phases

The app was built in five incremental phases, each one a complete vertical slice:

1. **Authentication** — registration, login, logout, and an authenticated `/auth/me` profile endpoint. Passwords hashed with `bcrypt`; sessions are JWTs in an **httpOnly, SameSite=Lax** cookie (never `localStorage`).
2. **Workspaces** — workspace creation, membership, roles (`OWNER` / `MEMBER`), and email-based invitations. The workspace is the multi-tenant boundary: every workspace-scoped endpoint checks membership before returning anything, and returns `404` (not `403`) to non-members so a workspace's existence is never leaked to outsiders.
3. **Projects** — each workspace can contain multiple projects. Owners manage them (create/edit/delete); members can view. A project belongs to exactly one workspace for life. Project routes follow the same `404`-not-`403` tenant-isolation convention.
4. **Sprints** — each project can have multiple sprints with a one-directional lifecycle: `PLANNED → ACTIVE → COMPLETED`, changed only via `POST /sprints/{id}/start` and `POST /sprints/{id}/complete` (never `PATCH`). Only one sprint per project may be `ACTIVE` at a time, enforced both in the API and by a partial unique DB index on `project_id WHERE status = 'ACTIVE'`, so a race between two requests can never create two active sprints.
5. **Tasks + Kanban board** — tasks with human-readable keys (e.g. `PAY-12`), computed at read time from the project's `key` plus a per-project sequential `task_number` handed out via an atomic `UPDATE ... RETURNING` (so concurrent creates never collide, and the key is never stored as a string). Tasks live in the project backlog (`sprint_id = NULL`) or in a sprint (`TODO` / `IN_PROGRESS` / `DONE`) — the two states are always kept consistent server-side. The board uses `@dnd-kit/core` for drag-and-drop, with optimistic moves that get reconciled (or reverted, with an error banner) against the server response.

### Authentication & authorization notes

- Every workspace-scoped resource (projects, sprints, tasks) derives its tenant boundary transitively — a sprint's workspace comes from `Sprint → Project → Workspace`, never stored directly.
- Assignee/reporter fields on tasks are always validated server-side against the task's own workspace membership — the assignee dropdown only ever queries that workspace's members.
- Invitations expire after 7 days, can only be accepted once, and require the accepting account's email to match the invited email (case-insensitive). There's no email provider wired in — invitation links are returned directly by the API / shown in the UI, which is fine for local testing and does not block any DevOps stage.
- What's intentionally **not** implemented (out of scope for this milestone): comments, activity feeds, real-time collaboration.

---

## Part 2 — The DevOps platform

### DevOps objective

Turn Work Stack into a production-style DevOps/SRE project demonstrating containerization, Kubernetes, Infrastructure as Code, GCP, GKE, Helm, CI, GitOps CD, observability, security, scalability, reliability, and operational readiness — without introducing any tool that doesn't have a clear, singular responsibility.

### Target architecture

**Delivery path:**

```
Developer
  │  git push
  ▼
GitHub  ──────────────────────────────────────────────────────────────┐
  │  PR / push to main                                                 │
  ▼                                                                     │
GitHub Actions (CI)                                                    │
  ├─ backend tests, frontend tests, TypeScript check, Helm lint/template│
  ├─ Docker build (linux/amd64)                                        │
  ├─ Trivy vulnerability scan (report-only)                            │
  └─ push immutable <git-sha>-tagged images ──────► Artifact Registry  │
                                                          │              │
                                                 git-SHA written to     │
                                                          ▼              │
                                              workstack-gitops repo ◄───┘
                                                          │
                                                    Argo CD polls
                                                          ▼
                                                       Helm sync
                                                          ▼
                                                          GKE
                                                          │
                                                    Work Stack app
```

**Infrastructure path (Terraform):**

```
Terraform
  ↓
GCP
├── VPC + subnet (+ secondary ranges for GKE pods/services)
├── IAM (node SA, Workload Identity SA, CI SA + WIF pool)
├── Artifact Registry
├── GKE (Standard, zonal, Spot nodes, autoscaling)
├── Cloud SQL (PostgreSQL, private IP)
└── Secret Manager
```

**Observability path (Terraform → Helm provider):**

```
Terraform
  ↓
Helm provider
  ↓
kube-prometheus-stack
├── Prometheus       (scrapes cluster + backend /metrics via ServiceMonitor)
├── Grafana          (Golden Signals dashboard, provisioned as code)
├── kube-state-metrics
└── node-exporter
(Alertmanager intentionally deferred — see Stage 8)
```

### Engineering principles

These held for the whole build, and explain most of the "why" questions below:

1. Don't introduce a tool unless it has a clear responsibility.
2. Prefer simple architecture over unnecessary complexity.
3. Don't rewrite working application code without a reason.
4. Keep application concerns separate from infrastructure concerns.
5. Keep infrastructure separate from application deployment.
6. **Terraform owns cloud infrastructure.**
7. **Argo CD owns application deployment.**
8. **Helm packages the Kubernetes application.**
9. **GitHub Actions owns CI** (never deploys to GKE directly).
10. **Prometheus collects metrics; Grafana visualizes them; Alertmanager (deferred) would handle alerts.**
11. Use immutable container image tags — never `latest`.
12. Never commit secrets.
13. Validate security server-side.
14. Prefer reproducible infrastructure (remote state, modules, `terraform plan` shows zero drift).
15. Test locally before moving to GCP (kind before GKE, Docker Compose before either).
16. Understand each Kubernetes resource before abstracting it with Helm.
17. Don't introduce service meshes, Kafka, Redis, OpenTelemetry, Loki, etc. unless a real requirement justifies them.
18. Keep costs under control while learning (Spot nodes, `db-f1-micro`, scale-to-zero runbooks, short metric retention).

### Roadmap at a glance

| Stage | Name | Status |
|---|---|---|
| 1 | Docker | ✅ Complete |
| 2 | Local Kubernetes (kind) | ✅ Complete |
| 3 | Terraform + GCP Foundation | ✅ Complete |
| 4 | GKE | ✅ Complete |
| 5 | Helm | ✅ Complete |
| 6 | GitHub Actions CI | ✅ Complete |
| 7 | Argo CD / GitOps CD | ✅ Complete |
| 8 | Observability (Prometheus + Grafana) | ✅ Complete |
| 9 | Production hardening | ⏳ Planned |

---

## Stage 1 — Docker

**Goal:** `docker compose up` runs the complete application locally — frontend, backend, and PostgreSQL — with production-quality Dockerfiles.

**What was built:**

- **`backend/Dockerfile`** — multi-stage build. Stage 1 (`builder`, `python:3.11-slim`) compiles dependencies into a venv (`build-essential` only exists in this stage). Stage 2 (`runtime`, `python:3.11-slim`) copies just the venv + app code, creates a dedicated non-root user (`app`, uid `10001`, no login shell, no home dir), and runs as that user. Includes a container-level `HEALTHCHECK` hitting `/health`. Entrypoint (`docker-entrypoint.sh`) runs `alembic upgrade head` automatically and idempotently on every start before starting `uvicorn`.
- **`frontend/Dockerfile`** — multi-stage build. Stage 1 (`node:20-alpine`) runs `npm ci` + `npm run build` (Vite production build). Stage 2 (`nginxinc/nginx-unprivileged:1.27-alpine` — a non-root Nginx image by design) serves the static build and reverse-proxies `/api/*` to the backend service (`frontend/nginx.conf`). Also has its own `HEALTHCHECK`.
- **`.dockerignore`** for both frontend and backend, keeping build contexts small (no `node_modules`, `.venv`, `__pycache__`, `.git`, etc.).
- **`docker-compose.yml`** — three services (`postgres`, `backend`, `frontend`), wired with `depends_on: condition: service_healthy` so the backend waits for Postgres to actually accept connections (not just start), and the frontend waits for the backend. All configuration is environment-driven with sane defaults, sourced from a root `.env` (see [Environment variables reference](#environment-variables-reference)). A single named volume (`postgres_data`) persists database state across restarts.
- **`docker/postgres-init/01-create-test-db.sql`** — auto-creates the `workstack_test` database on first Postgres boot, so the backend test suite (`TEST_DATABASE_URL`) works without any extra setup.

**Verified:**

- Frontend, backend, and PostgreSQL all run successfully together via `docker compose up`.
- Backend migrations run automatically and idempotently on every container start.
- Frontend's Nginx correctly proxies `/api/*` to FastAPI.
- Cookie-based authentication works end-to-end through the Nginx proxy (same-origin, so the cookie behaves simply and securely).
- All containers run as non-root.
- A fresh boot from wiped volumes (`docker compose down -v && docker compose up`) works cleanly — migrations create the schema from scratch.
- No application functionality was changed to make containerization work.

**Everyday commands:**

```bash
# First run, or after nothing has changed
docker compose up -d

# After editing a Dockerfile, requirements.txt, package.json, or app source
docker compose up -d --build

# Stop (keeps containers + the postgres_data volume for next time)
docker compose stop

# Stop and remove containers (DB volume survives)
docker compose down

# Full reset — wipes the Postgres volume too; next `up` starts from an empty DB
docker compose down -v
```

---

## Stage 2 — Local Kubernetes (kind)

**Goal:** understand and validate the Kubernetes architecture locally, with plain manifests (no Helm yet), before touching a real cloud cluster.

**Kubernetes resources** (`k8s/kind/`), all inside a dedicated `workstack` namespace:

```
k8s/kind/
├── namespace.yaml
├── configmap.yaml        # backend-config: non-secret env (JWT alg, token expiry, CORS, cookie name, invite expiry)
├── secret.yaml            # backend-secret: DATABASE_URL, SECRET_KEY (plaintext stringData — dev-only)
├── ingress.yaml           # single Ingress, ingressClassName: nginx, routes / → frontend:8080
├── kind-config.yaml        # kind cluster config: one control-plane node, ingress-ready=true label, host ports 80/443 mapped in
├── postgres/
│   ├── deployment.yaml    # Postgres 16, strategy: Recreate (PVC is RWO), pg_isready probes
│   ├── service.yaml       # ClusterIP "postgres", port 5432 — matches DATABASE_URL's host
│   └── pvc.yaml           # 1Gi RWO PersistentVolumeClaim
├── backend/
│   ├── deployment.yaml    # replicas: 1 (see below), startup/readiness/liveness probes on /health
│   ├── service.yaml       # ClusterIP, port 8000
│   ├── hpa.yaml            # HPA: 1–3 replicas, 70% avg CPU
│   └── pdb.yaml            # PDB: minAvailable 1
└── frontend/
    ├── deployment.yaml    # replicas: 2 fixed (no HPA — static file serving is cheap), probes on /
    └── service.yaml       # ClusterIP, port 8080
```

**Design decisions worth knowing:**

- **Backend is pinned to `replicas: 1`.** `docker-entrypoint.sh` runs `alembic upgrade head` unconditionally with no locking. At `replicas: 1`, a migration race against a fresh empty DB is structurally impossible; the HPA only scales up *after* the schema is already at head, so later replicas' migration runs are safe no-ops.
- **Postgres uses `strategy: Recreate`**, not the Deployment default `RollingUpdate` — its PVC is `ReadWriteOnce`, so two pods can never mount it simultaneously; Kubernetes must fully terminate the old pod before starting a new one.
- **All three probe types on the backend**: a tolerant `startupProbe` (up to ~60s, to cover migration time) gates when readiness/liveness even start being evaluated — this is the raw-Kubernetes equivalent of Compose's `depends_on: condition: service_healthy`.
- Cluster-level infra that kind doesn't ship by default is installed directly from upstream manifests (not treated as "app" YAML under `k8s/`):
  - `ingress-nginx` (for the Ingress),
  - `metrics-server`, patched with `--kubelet-insecure-tls` because kind's kubelets use self-signed certs the unmodified metrics-server wouldn't trust — without this patch, `kubectl top` and the HPA both stay stuck on `<unknown>`.

**Commands used to stand this up:**

```bash
# 1. Build the app images (from Stage 1)
docker compose build backend frontend

# 2. Create the cluster
kind create cluster --name workstack --config k8s/kind/kind-config.yaml
kubectl config use-context kind-workstack

# 3. Cluster-level infra
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=180s

kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# 4. Load locally-built images into the cluster (no registry needed at this stage)
kind load docker-image workstack-backend:latest workstack-frontend:latest --name workstack

# 5. Apply the app manifests
kubectl apply -f k8s/kind/namespace.yaml
kubectl apply -R -f k8s/kind/configmap.yaml -f k8s/kind/secret.yaml \
  -f k8s/kind/postgres/ -f k8s/kind/backend/ -f k8s/kind/frontend/ -f k8s/kind/ingress.yaml
```

**Redeploy after a code change** (backend example, same pattern for frontend):

```bash
docker compose build backend
kind load docker-image workstack-backend:latest --name workstack
kubectl rollout restart deployment/backend -n workstack
```

**Verification performed:**

1. `kubectl get pods -n workstack -o wide` → all pods `Running`/`Ready`. (The backend actually crash-looped a few times on first boot because Postgres wasn't accepting connections yet — expected, and self-healed by the `startupProbe`, not a bug.)
2. `kubectl get svc,pvc -n workstack` → all ClusterIPs up, `postgres-data` PVC `Bound`.
3. `kubectl port-forward svc/backend 8000:8000` + `curl localhost:8000/health` → confirms the backend process itself is healthy (checked directly since `/health` isn't behind `/api/v1`).
4. `curl http://localhost/` → `200`, confirms Ingress → frontend Service → Nginx.
5. Full register → cookie → `/api/v1/auth/me` through `http://localhost/api/...` — confirms Ingress → frontend Nginx proxy → backend, same-origin cookie auth intact.
6. `kubectl exec deploy/postgres -- psql ... "select count(*) from users"` before/after `kubectl delete pod -l app=postgres` → identical row count both times, confirming the PVC survives pod recreation.
7. `kubectl top pods -n workstack` + `kubectl get hpa -n workstack` → real CPU numbers, live `cpu: 4%/70%` target — confirms metrics-server is wired up and the HPA has real data to scale on.
8. `kubectl get pdb -n workstack` → backend (1 replica, `minAvailable: 1`) shows `ALLOWED DISRUPTIONS: 0`; frontend (2 replicas, `minAvailable: 1`) shows `ALLOWED DISRUPTIONS: 1` — confirms the PDBs enforce exactly what they should.

**Intentionally deferred at this stage:** a from-scratch `kind delete cluster` + reapply cycle, and a synthetic load generator to watch the HPA scale live (both left as optional hands-on exploration; the mechanism was already proven via `kubectl top`/`kubectl get hpa`).

---

## Stage 3 — Terraform + GCP foundation

**Goal:** provision the GCP infrastructure foundation with Terraform — no GKE, Cloud SQL, or Secret Manager resources yet, just the base platform.

**Structure:**

```
terraform/
├── bootstrap/                    # one-time: creates the GCS state bucket itself
│   ├── main.tf
│   ├── outputs.tf
│   └── variables.tf
├── environments/
│   └── dev/
│       ├── backend.tf            # remote state → gs://workstack-devops-vb-tfstate/dev
│       ├── main.tf               # wires all modules together
│       ├── outputs.tf
│       └── variables.tf
└── modules/
    ├── network/                  # VPC, subnet, secondary ranges, Private Service Access
    ├── artifact-registry/        # Docker repo + IAM bindings
    ├── gke/                      # (Stage 4)
    ├── cloudsql/                 # (Stage 4)
    ├── secrets/                  # (Stage 4)
    ├── github-actions-ci/        # (Stage 6)
    └── observability/            # (Stage 8)
```

Every module takes `project_id`, `region`/`zone`, and a `name_prefix` (`workstack-dev`) rather than hardcoding names, so the same modules could stand up a `prod` environment by pointing a new `environments/prod/` at them with different variables (not built yet — deliberately out of scope until it's actually needed).

**What Stage 3 itself provisioned:**

- Required GCP APIs enabled (`compute`, `artifactregistry`, `container`, `sqladmin`, `secretmanager`, `servicenetworking`, `iamcredentials`, `sts`).
- A custom **VPC** (`workstack-dev-vpc`) and **subnet** (`workstack-dev-subnet`), instead of the wide-open default VPC.
- **Artifact Registry** Docker repository (`workstack`) for the two application images.
- **Remote Terraform state** in a GCS bucket (`gs://workstack-devops-vb-tfstate/dev`), created by the separate `bootstrap/` config (state for infrastructure that manages infrastructure can't safely live in the thing it's managing).

**Deliberately not created yet at Stage 3:** GKE, Cloud SQL, Secret Manager — those belong to Stage 4.

**Bootstrap + apply commands** (adjust `project_id`/`region` in `terraform.tfvars` for your own GCP project — see [Option C](#option-c--full-cloud-stack-on-your-own-gcp-project)):

```bash
# One-time: create the remote state bucket
cd terraform/bootstrap
terraform init
terraform apply

# The actual dev environment, using that bucket as its backend
cd ../environments/dev
terraform init
terraform plan
terraform apply
```

**Verified:** `terraform plan` showed zero drift after apply; the VPC, subnet, and Artifact Registry existed exactly as declared; no GKE/Cloud SQL/Secret Manager resources existed yet; nothing was created by hand in the GCP console.

**Key Stage 3 outputs** (this project's actual values — yours will differ if you run this on your own project):

| Output | Value |
|---|---|
| Project | `workstack-devops-vb` |
| Region / Zone | `us-central1` / `us-central1-a` |
| VPC | `workstack-dev-vpc` |
| Subnet | `workstack-dev-subnet` |
| Artifact Registry | `us-central1-docker.pkg.dev/workstack-devops-vb/workstack` |
| Terraform state | `gs://workstack-devops-vb-tfstate/dev` |

---

## Stage 4 — GKE

**Goal:** provision the GKE runtime and its dependencies with Terraform, then deploy Work Stack to it, with production PostgreSQL on **Cloud SQL** instead of a Postgres pod.

**Terraform additions** (`terraform/modules/gke`, `terraform/modules/cloudsql`, `terraform/modules/secrets`):

- **GKE cluster** `workstack-dev-gke` — Standard (not Autopilot) zonal cluster in `us-central1-a`, `REGULAR` release channel, VPC-native (uses the Stage 3 VPC's secondary ranges for pod/service IPs), `gateway_api_config { channel = "CHANNEL_STANDARD" }` enabled for Gateway API.
- **Node pool** `workstack-dev-pool` — `e2-medium` **Spot** VMs (`node_spot = true`, a deliberate cost/learning tradeoff — see [Cost notes](#cost-notes)), autoscaling `min 2 / max 4`, 50GB `pd-balanced` disks, up to 32 pods/node.
- **Two GCP service accounts**: a node service account (image pulls, logging/monitoring) and a **Workload Identity**-bound backend service account (`workstack-dev-backend@...`), mapped to the in-cluster `workstack-backend` Kubernetes ServiceAccount — the backend pod authenticates to GCP with zero long-lived keys.
- **A reserved global static IP** (`workstack-dev-ingress-ip`) for the eventual public endpoint.
- **Cloud SQL for PostgreSQL** (`workstack-dev-pg`) — `db-f1-micro` tier, **private IP only** (no public IP), attached to the Stage 3 VPC via Private Service Access, `max_connections = 100` (raised from the tier's ~25 default, since SQLAlchemy's pool × the backend HPA's up to 3 replicas can exceed that under load).
- **Secret Manager** secrets — `workstack-dev-database-url`, `workstack-dev-app-secret-key`, `workstack-dev-db-password` — with per-secret IAM bindings so only the workload service account (not "everyone in the project") can read them.

**Kubernetes side** (`k8s/gke/`, applied directly with `kubectl` at this stage — Helm arrives in Stage 5):

```
k8s/gke/
├── namespace.yaml
├── csi-secrets-store-rbac.yaml     # cluster-scoped RBAC the Secrets Store CSI driver needs
├── serviceaccount.yaml              # Workload Identity–annotated KSA for the backend pod
├── secretproviderclass.yaml         # tells the CSI driver which Secret Manager secrets to sync as backend-secret
├── configmap.yaml                   # non-secret env vars
├── backend/   (deployment incl. Cloud SQL Auth Proxy sidecar, service, hpa, pdb)
├── frontend/  (deployment, service, pdb)
├── gateway.yaml                     # GKE Gateway, class gke-l7-global-external-managed, reuses the reserved static IP
└── httproute.yaml                   # routes / → frontend Service, port 8080
```

**Connectivity achieved:**

```
GKE → FastAPI → Cloud SQL Auth Proxy (sidecar) → Cloud SQL PostgreSQL (private IP)
```

**Why Cloud SQL Auth Proxy as a sidecar, not a direct connection string to the private IP:** it handles mTLS and IAM-based authorization to the instance automatically via the pod's Workload Identity, so the app code just talks to `127.0.0.1:5432` — no certificate management or IP allowlisting logic inside the application itself.

**Public access — the part that took real iteration.** The original plan (a classic `Ingress` + `ingress-gce`) never provisioned a working load balancer on this GKE cluster/version (`ingress-gce` is in maintenance mode). The fix: enabled `gateway_api_config` on the cluster in Terraform (in-place cluster update, ~9 min, zero drift afterward), removed the non-functional `ingress.yaml`/`ingressclass.yaml`, and replaced them with a `Gateway` (class `gke-l7-global-external-managed`) + `HTTPRoute`. The Gateway reuses the same Terraform-reserved static IP — no new address, no extra config needed.

```
Internet → Static IP → GKE Gateway → HTTPRoute → frontend Service → Frontend Pods
                                                        │ /api/*
                                                        ▼
                                                  backend Service → Backend Pod
                                                  ├── FastAPI
                                                  └── Cloud SQL Auth Proxy → Cloud SQL
```

**Apply order** (dependencies first):

```bash
gcloud container clusters get-credentials workstack-dev-gke \
  --zone us-central1-a --project workstack-devops-vb

kubectl apply -f k8s/gke/namespace.yaml
kubectl apply -f k8s/gke/csi-secrets-store-rbac.yaml
kubectl apply -f k8s/gke/serviceaccount.yaml
kubectl apply -f k8s/gke/secretproviderclass.yaml
kubectl apply -f k8s/gke/configmap.yaml
kubectl apply -f k8s/gke/backend/
kubectl apply -f k8s/gke/frontend/
kubectl apply -f k8s/gke/gateway.yaml
kubectl apply -f k8s/gke/httproute.yaml
```

**Verified externally** (real public internet path, not `port-forward`):

```bash
curl http://34.49.71.24/
# → 200, <title>Work Stack</title>, `via: 1.1 google` confirms it traversed Google's global LB
```

Full register → cookie → `/auth/me` → workspace creation flow, verified end-to-end through the public IP. Also verified: VPC-native networking, Workload Identity, Artifact Registry image pulls, `linux/amd64` image builds (Apple-silicon dev machine building for GKE's `amd64` nodes), Secret Manager CSI sync, HPA/PDB, and automatic recovery from Spot node preemption.

---

## Stage 5 — Helm

**Goal:** package the whole Kubernetes deployment (kind *and* GKE) as a single Helm chart, so it becomes one reviewable, versioned, parameterized unit instead of two parallel piles of raw manifests.

**Chart layout** (`helm/workstack/`):

```
helm/workstack/
├── Chart.yaml
├── values.yaml            # neutral defaults, shared by both environments
├── values-kind.yaml       # local overrides: in-cluster Postgres, plaintext Secret, nginx Ingress
├── values-gke.yaml         # cloud overrides: Cloud SQL proxy, Secret Manager CSI, Gateway/HTTPRoute, Workload Identity
└── templates/
    ├── namespace.yaml, configmap.yaml, secret.yaml, secretproviderclass.yaml, serviceaccount.yaml, csi-rbac.yaml
    ├── ingress.yaml, gateway.yaml, httproute.yaml
    ├── backend/   (deployment, service, hpa, pdb, servicemonitor)
    ├── frontend/  (deployment, service, pdb)
    └── postgres/  (deployment, service, pvc)
```

One chart, two `values-*.yaml` files, **zero templating forks between environments** — every environment-specific concern (in-cluster Postgres vs. Cloud SQL, plaintext Secret vs. Secret Manager CSI, classic Ingress vs. Gateway API) is a `{{ if }}` on a `values.yaml` boolean flag (`postgres.enabled`, `secretProvider.enabled`, `gateway.enabled`, etc.), never a second copy of a template. `templates/_helpers.tpl` deliberately forbids a fullname/prefix helper — resource names stay unprefixed (`backend`, `frontend`, `postgres`, ...) since this chart only ever runs one release per cluster.

**Validation:**

```bash
helm lint helm/workstack -f helm/workstack/values-kind.yaml
helm lint helm/workstack -f helm/workstack/values-gke.yaml

helm template helm/workstack -f helm/workstack/values-kind.yaml
helm template helm/workstack -f helm/workstack/values-gke.yaml
```

**Rollout on GKE** — critically, this had to *adopt* the live resources Stage 4's raw `kubectl apply` had created, not recreate them:

```bash
gcloud container clusters get-credentials workstack-dev-gke --zone us-central1-a --project workstack-devops-vb
helm upgrade --install workstack ./helm/workstack -n workstack -f helm/workstack/values-gke.yaml
```

**Verified:** the chart, rendered with `values-gke.yaml`, semantically matched the live GKE resources; the existing Deployments/Services/Gateway/HTTPRoute were adopted by the Helm release without being deleted and recreated; the public Gateway kept working throughout; the full application flow was re-verified post-migration; Terraform-owned infrastructure was untouched by any of this (Helm only ever touches the Kubernetes API, never GCP resources directly).

**Known limitation (non-blocking):** `values-kind.yaml` is lint- and template-validated in CI but hasn't been installed on a running local `kind` cluster in this session — see [Option B](#option-b--local-kubernetes-with-kind) below for that install command.

---

## Stage 6 — GitHub Actions CI

**Goal:** a CI pipeline that tests, validates, builds, scans, and publishes artifacts — and stops there. CI never deploys to GKE; that boundary belongs to Argo CD (Stage 7).

**PR validation** (`.github/workflows/pr.yml` → the reusable `_validate.yml`), on every pull request into `main`, **using zero GCP credentials**:

- Backend tests: `pytest`, against a real `postgres:16-alpine` service container (not mocked).
- Frontend tests: `vitest run`.
- Frontend build: `npm run build` (which is `tsc -b && vite build` — this covers TypeScript validation too, since it fails on type errors before Vite even starts).
- `helm lint` against both `values-kind.yaml` and `values-gke.yaml`.
- `helm template` against both values files (catches template errors that `lint` alone can miss).
- Docker build validation for both images (`push: false` — proves the Dockerfiles build, without publishing anything).

**Main-branch pipeline** (`.github/workflows/main.yml`), on every push to `main`:

1. Re-runs the full `_validate.yml` suite against the merge commit.
2. **`build-and-push`** (matrix: `backend`, `frontend`) — builds `linux/amd64` images with `docker buildx` (`load: true`, not pushed yet), scans each with **Trivy** (`format: table`, `severity: CRITICAL,HIGH`, `exit-code: "0"` — report-only for now: base-image CVEs in `python:3.11-slim`/`node:20-alpine` aren't yet on a patching cadence, so a hard fail here would block every merge on day one), then authenticates to GCP via `google-github-actions/auth` using **Workload Identity Federation** — GitHub's own OIDC token, exchanged for a short-lived credential impersonating `workstack-ci@workstack-devops-vb.iam.gserviceaccount.com`, valid only for this repo and `refs/heads/main` — and pushes to Artifact Registry tagged with the immutable **git SHA** (never `latest`).
3. **`update-gitops`** (depends on `build-and-push` completing, so it only runs once both images have actually landed) — checks out the separate `workstack-gitops` repository using a scoped PAT, bumps `backend.image.tag`/`frontend.image.tag` in `environments/gke/image-tags.yaml` to the new SHA via `yq`, commits, and pushes. **This step never touches GCP or the Kubernetes API** — it only ever talks to GitHub, which is what makes "CI must not deploy to GKE" true by construction rather than by convention.

**GCP identity for CI** (`terraform/modules/github-actions-ci/`): a Workload Identity Federation pool (`github-actions-pool`) + OIDC provider (`github-actions-provider`), with an `attribute_condition` restricting it to `assertion.repository == "vansh1999/workstack"`, plus a dedicated service account (`workstack-ci@...`) granted **only** `roles/artifactregistry.writer` on the one repository — no broader project role, no service-account key file anywhere.

**Images produced:**

```
us-central1-docker.pkg.dev/workstack-devops-vb/workstack/workstack-backend:<git-sha>
us-central1-docker.pkg.dev/workstack-devops-vb/workstack/workstack-frontend:<git-sha>
```

**Verified:** a real PR run passed backend/frontend tests, Helm lint/template, and Docker build validation with zero GCP credentials used; a real push to `main` produced both images tagged with the merge commit SHA (`3a5b3c1...`), scanned by Trivy, pushed to Artifact Registry via WIF (no key), with `latest` used nowhere. Bugs hit and fixed along the way: an invalid Trivy action tag, a missing `security-events` permission, and no GitHub Advanced Security available on a private repo (resolved by keeping Trivy output log-only instead of attempting a SARIF/code-scanning upload).

---

## Stage 7 — Argo CD / GitOps CD

**Goal:** GitOps-based continuous deployment. GitHub Actions builds and pushes images and stops; **Argo CD owns reconciling the cluster to match git.**

**GitOps repository** — a second, separate repository, `workstack-gitops`, deliberately minimal:

```
workstack-gitops/
├── argocd/
│   └── application.yaml        # the Argo CD Application manifest
└── environments/
    └── gke/
        └── image-tags.yaml     # ONLY backend.image.tag / frontend.image.tag
```

**Why a second repo instead of a folder in this one:** a same-repo "GitOps folder" that CI commits back into is functionally a monorepo with an awkward internal loop (CI pushing to the branch that triggered it risks re-triggering `on: push`). A separate repo cleanly draws the line between "what can build/push an image" (this repo's CI) and "what is currently deployed" (the GitOps repo's state) — the standard pattern, and worth the one extra PAT it costs.

**Argo CD installation** — the official Helm chart, installed **imperatively**, one time, not Terraform-managed (deliberately: wiring Argo CD's own bootstrap through `terraform apply` would blur the "Terraform owns infra / Argo CD owns app deployment" boundary this whole roadmap is built around):

```bash
kubectl create namespace argocd
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd -n argocd
```

The one necessarily-manual, one-time bootstrap step (Argo CD can't sync its own first `Application` object into existence):

```bash
kubectl apply -f workstack-gitops/argocd/application.yaml
```

After that single manual act, every subsequent change — a new image tag, a chart update — flows through git, never through another manual `kubectl apply`.

**The Argo CD `Application`** is a single **multi-source** application (no `ApplicationSet` — that pattern exists to template *many* Applications from one root; this project has exactly one):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: workstack
  namespace: argocd
spec:
  project: default
  sources:
    - repoURL: git@github.com:vansh1999/workstack.git
      targetRevision: main
      path: helm/workstack
      helm:
        valueFiles:
          - values-gke.yaml
          - $values/environments/gke/image-tags.yaml
    - repoURL: git@github.com:vansh1999/workstack-gitops.git
      targetRevision: main
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: workstack
  syncPolicy:
    automated:
      prune: true
      selfHeal: false
    syncOptions:
      - CreateNamespace=false
```

The chart source tracks `main` (chart structure changes rarely, and does so the normal way — a commit to the app repo); the image tags come from the GitOps repo's values file, layered on top at sync time. No chart is duplicated into the GitOps repo — Stage 6's CI already lint/template-validates it.

**Sync policy — the interesting tradeoff:** `prune: true` (orphaned resources get cleaned up, matching "git is truth"); `automated` with no manual trigger required (a GitOps-repo commit deploys itself); **`selfHeal: false`, deliberately.** With `selfHeal: true`, Argo CD would continuously fight the cost-saving runbook below (scaling to 0 replicas overnight, resizing the node pool to 0) by reverting it back to the git-declared state. With it `false`, manual scale-to-zero sits untouched between deploys — drift shows up as `OutOfSync` in the UI (visible, not silent) but isn't auto-corrected until the next real commit. `ignoreDifferences` was added for the backend/frontend Deployments' `spec.replicas` (the HPA and the cost-saving runbook both write this field) and for the GKE-injected NEG annotation, so `OutOfSync` stays meaningful for things that actually matter.

**Rollback**, using git as the audit log instead of local Helm release history:

```bash
cd workstack-gitops
git revert <sha-of-the-bad-tag-bump> --no-edit
git push
# then either wait for the next Argo CD poll, or force it immediately:
argocd app sync workstack
```

**Cutover from Stage 5's plain Helm release** (a Helm-CLI-owned release and an Argo CD-owned Application can't cleanly co-own the same objects — in-place "adoption" requires manually stripping `meta.helm.sh/*` annotations off every object, which isn't a well-supported path):

```bash
helm uninstall workstack -n workstack     # brief, planned downtime
kubectl apply -f workstack-gitops/argocd/application.yaml
```

**Terraform changes required for this stage: none.** Argo CD needs zero GCP-facing permissions — it only talks to the in-cluster Kubernetes API (via its own Helm chart's RBAC) and to two GitHub remotes. Nothing in its install or operation touches a `google_*` Terraform resource.

**Verified end-to-end:** GitOps repo live and cloneable; Argo CD installed and watching both repos; cutover from the plain Helm release completed with zero functional regression (auth flow, Cloud SQL connectivity, and the public Gateway all re-verified); a real merge to `main` triggered `update-gitops`, which committed the new SHA automatically with no manual step, and Argo CD deployed pods running that exact image (`kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'` confirmed the SHA); rollback tested for real — reverted to an older tag, confirmed old-image pods and traffic, then rolled forward again; GitHub Actions was confirmed to never touch GKE at any point in the whole flow.

**Where to watch it happen:**

```bash
kubectl get pods -n workstack -w
kubectl port-forward svc/argocd-server -n argocd 8080:443
# open https://localhost:8080 (self-signed cert — expected)
# user: admin
# password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

---

## Stage 8 — Observability

**Goal:** observe the application and the cluster through the SRE **four golden signals** — Traffic, Latency, Errors, Saturation — using Prometheus + Grafana, provisioned as infrastructure (Terraform), kept strictly separate from the app's own Helm chart.

**Provisioning** (`terraform/modules/observability/`, wired into `terraform/environments/dev/main.tf` as `module "observability"`): a dedicated `monitoring` Kubernetes namespace, and a single `helm_release` (via Terraform's own Helm/Kubernetes providers, authenticated with the same `gcloud` credentials the `google` provider already uses — no separate kubeconfig or service-account key) installing the community **`kube-prometheus-stack`** chart:

- **Prometheus** — 3-day metric retention, a 10Gi `ReadWriteOnce` PVC (so Spot-node preemption or pod restarts don't wipe history), resource requests/limits sized for a small cluster (`100m`/`256Mi` request, `500m`/`512Mi` limit). `serviceMonitorSelectorNilUsesHelmValues`/`podMonitorSelectorNilUsesHelmValues`/`ruleSelectorNilUsesHelmValues` all set to `false`, so Prometheus discovers **every** `ServiceMonitor` cluster-wide instead of only ones labeled with this specific Helm release name — meaning the app chart's own `ServiceMonitor` is picked up with zero coordination required.
- **`kube-state-metrics`** and **`node-exporter`** — enabled, for cluster/node-level metrics (pod count, restarts, deployment availability, node CPU/memory).
- **`kubeControllerManager`/`kubeScheduler`/`kubeEtcd`/`kubeProxy` scraping — explicitly disabled.** GKE's control plane is Google-managed and isn't scrapable; leaving these on would just create permanently-`down` targets and alert noise.
- **Grafana** — Terraform-generated random admin password (`random_password`, not the chart's well-known default `prom-operator`), retrievable via `terraform output -raw grafana_admin_password`. No persistent volume for Grafana itself: dashboards are provisioned **as code** (below), so there's nothing stateful in the Grafana pod worth persisting. Resources sized at `50m`/`256Mi` request, `300m`/`512Mi` limit (bumped up from an initial `256Mi` limit that caused real OOM pressure and liveness-probe restarts — observed RSS with the chart's sidecar containers running is closer to ~400Mi).
- **A Golden-Signals dashboard provisioned as code** — a `kubernetes_config_map` (Terraform) labeled `grafana_dashboard=1`, which the chart's built-in Grafana sidecar watches for and loads automatically. No manual "import dashboard JSON" step, ever.
- **Alertmanager: intentionally disabled** for this stage, per the roadmap — deferred to Stage 9. Loki, Tempo, OpenTelemetry, and Elasticsearch are likewise intentionally out of scope for now.

**Application side** (`backend/`, `helm/workstack/`):

- `prometheus-fastapi-instrumentator` added to the backend, exposing a Prometheus-compatible `/metrics` endpoint.
- The backend's Kubernetes Service names its metrics port explicitly for Prometheus discovery.
- `helm/workstack/templates/backend/servicemonitor.yaml` — a `ServiceMonitor` CRD object (gated behind `serviceMonitor.enabled`, on for GKE, off for kind unless the observability stack is separately installed there) telling Prometheus to scrape that port on an interval.

**Four golden signals, concretely covered:**

| Signal | What's shown |
|---|---|
| **Traffic** | requests/sec |
| **Latency** | p50 / p95 / p99 request duration |
| **Errors** | 4xx rate, 5xx rate, overall error rate |
| **Saturation** | pod CPU/memory usage, pod capacity, HPA utilization |

Plus Kubernetes/node resource metrics (CPU, memory, pod count, restarts, deployment availability, node health) via `kube-state-metrics` + `node-exporter`.

**Verified:** Prometheus confirmed actually scraping the backend target (visible as `UP` in the Prometheus UI); real `/health` and `/metrics` traffic showed up live in Prometheus after hitting the public app endpoint; the "Work Stack — Golden Signals" Grafana dashboard rendered that live traffic across all four signals; no public Prometheus or Grafana endpoint was exposed (both accessed only via `kubectl port-forward`); Argo CD continued managing the app chart unaffected — the observability stack lives entirely outside `helm/workstack/`.

**Accessing it:**

```bash
kubectl port-forward svc/kube-prometheus-stack-prometheus -n monitoring 9090:9090 &
# → http://localhost:9090/targets — look for workstack/backend, state UP

kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3000:80 &
terraform -chdir=terraform/environments/dev output -raw grafana_admin_password; echo
# → http://localhost:3000, log in as `admin` with that password
# "Work Stack — Golden Signals" dashboard is already there — no import needed.
# Hit http://34.49.71.24 a few times first so there's traffic on the graphs.
```

**Ownership after Stage 8:**

```
Terraform     → Prometheus / Grafana / kube-state-metrics / node-exporter (the "monitoring" namespace)
Helm + ArgoCD → the Work Stack ServiceMonitor (lives inside the app chart)
Application   → exposes /metrics
Prometheus    → collects metrics
Grafana       → visualizes metrics
```

---

## Stage 9 — Production hardening (planned)

Not yet started. Once the full platform works end-to-end (it does, as of Stage 8), the roadmap calls for tightening these areas:

**Security**
- Least-privilege IAM review across every service account created so far.
- `NetworkPolicy` objects (none exist yet — every pod can currently reach every other pod in-cluster).
- Extend container scanning from "report-only" to an actual enforced gate.

**Reliability**
- Revisit probe tuning, resource requests/limits, and HPA/PDB thresholds under real load rather than idle defaults.
- Exercise rolling deployments deliberately (not just observe them happen incidentally during a normal deploy).

**Infrastructure**
- Dev/prod environment separation (`terraform/environments/prod/`, using the same modules with different variables).
- A real Cloud SQL backup/PITR strategy (currently relies on Cloud SQL defaults, not an explicit policy).
- Revisit GKE configuration choices (e.g. Spot-node tradeoffs) if/when a "prod" environment is added.

**Operations**
- Formal SLOs/SLIs on top of the Stage 8 golden-signals dashboard.
- Alertmanager rules for: high error rate, high latency, unavailable pods, restart loops, high CPU, high memory, insufficient replicas.
- Written runbooks and deliberate failure-injection tests: kill a backend pod, spike traffic, deploy a bad image, break DB connectivity — observe the alert, then recover/roll back — and record what was learned each time.

This section stays here as the explicit "not done yet" boundary — the goal is to be honest about what this project currently demonstrates versus what a genuinely production-grade version of it would still need.

---

## Repository structure

```
workstack/
├── backend/                    # FastAPI application (Stage 1+)
│   ├── app/                    # routers, models, schemas, core config/security
│   ├── alembic/                # DB migrations
│   ├── tests/                  # pytest suite
│   ├── Dockerfile
│   ├── docker-entrypoint.sh    # runs `alembic upgrade head`, then starts uvicorn
│   └── requirements.txt
├── frontend/                    # React + TypeScript app (Stage 1+)
│   ├── src/                     # api/, components/, context/, hooks/, lib/, pages/, styles/
│   ├── Dockerfile
│   ├── nginx.conf               # serves the build, proxies /api/* to the backend
│   └── package.json
├── docker/
│   └── postgres-init/          # auto-creates the test database on first Postgres boot
├── docker-compose.yml            # Stage 1: local 3-tier stack
├── k8s/                          # Stage 2 & 4: raw Kubernetes manifests
│   ├── kind/                    # local cluster (in-cluster Postgres, nginx Ingress)
│   └── gke/                     # cloud cluster (Cloud SQL proxy, Secret Manager CSI, Gateway API)
├── helm/
│   └── workstack/                # Stage 5: the one chart for both environments
│       ├── values.yaml, values-kind.yaml, values-gke.yaml
│       └── templates/
├── terraform/                    # Stage 3, 4, 6, 8: all cloud infrastructure
│   ├── bootstrap/                # one-time: GCS remote-state bucket
│   ├── environments/dev/         # wires every module together for the dev environment
│   └── modules/
│       ├── network/ artifact-registry/ gke/ cloudsql/ secrets/
│       ├── github-actions-ci/    # Workload Identity Federation for CI
│       └── observability/         # kube-prometheus-stack via the Helm provider
├── .github/
│   └── workflows/
│       ├── pr.yml                 # PR validation trigger
│       ├── main.yml                # main-branch build/scan/push/update-gitops
│       └── _validate.yml           # reusable: tests, lint, Helm validation, Docker build checks
├── .env.example                    # Docker Compose configuration template
└── README.md                        # this file
```

The **GitOps repository** (`workstack-gitops`, Stage 7) is intentionally separate from this repository — see [Stage 7](#stage-7--argo-cd--gitops-cd) for why, and its own minimal layout.

---

## Clone & run it yourself

There are three ways to run this project, from "just the app, two minutes" to "the entire cloud platform on your own GCP billing account."

### Option A — Docker Compose (fastest, no cloud needed)

This is Stage 1 exactly, and the easiest way to just see the application working.

**Prerequisites:** Docker (with Compose).

```bash
git clone <this-repo-url> workstack
cd workstack

cp .env.example .env
# defaults in .env.example already work for local dev — edit only if you want
# different ports, or want to set a real SECRET_KEY:
python3 -c "import secrets; print(secrets.token_hex(32))"

docker compose up -d --build
```

- Frontend: **http://localhost:5173**
- Backend API: **http://localhost:8000/api/v1** (health check at `http://localhost:8000/health`)
- Register an account, then create a workspace — you'll land on `/onboarding` with no workspaces yet, and `/` redirects into your workspace once you have one.

Stop / reset:

```bash
docker compose stop        # keep containers + DB volume
docker compose down        # remove containers, keep the DB volume
docker compose down -v     # full reset — wipes the DB volume too
```

**Running the app without Docker for the backend/frontend** (only Postgres in a container) — useful for active development with hot reload:

```bash
docker compose up -d postgres

# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# frontend, in a second terminal
cd frontend
npm install
npm run dev
```

Tests:

```bash
cd backend && pytest
cd frontend && npm run test
```

### Option B — Local Kubernetes with kind

This is Stage 2 + Stage 5's chart, run against a local `kind` cluster — no cloud account needed.

**Prerequisites:** Docker, [`kind`](https://kind.sigs.k8s.io/), `kubectl`, `helm`.

```bash
kind create cluster --name workstack --config k8s/kind/kind-config.yaml
kubectl config use-context kind-workstack

# cluster-level infra kind doesn't ship by default
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=180s

kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# build and load the app images (no registry needed for kind)
docker build -t workstack-backend:v0.1.0 ./backend
docker build -t workstack-frontend:v0.1.0 ./frontend
kind load docker-image workstack-backend:v0.1.0 --name workstack
kind load docker-image workstack-frontend:v0.1.0 --name workstack

# install via the Helm chart (creates the workstack namespace itself)
helm upgrade --install workstack ./helm/workstack -n workstack --create-namespace \
  -f helm/workstack/values-kind.yaml
```

App: **http://localhost** (port 80, mapped in `kind-config.yaml`).

Redeploy after a code change:

```bash
docker build -t workstack-backend:v0.1.0 ./backend
kind load docker-image workstack-backend:v0.1.0 --name workstack
kubectl rollout restart deployment/backend -n workstack
```

Tear down:

```bash
helm uninstall workstack -n workstack --kube-context kind-workstack   # app only
kind delete cluster --name workstack                                    # everything
```

### Option C — Full cloud stack on your own GCP project

This reproduces Stages 3–8 — real GCP infrastructure, GKE, Cloud SQL, Argo CD, Prometheus/Grafana. It requires **your own GCP project with billing enabled**, and will incur real (small) cloud costs — see [Cost notes](#cost-notes). Every name below (`workstack-devops-vb`, `34.49.71.24`, the WIF pool numbers, etc.) is specific to the author's project; substitute your own project ID and re-run `terraform apply` to get your own values.

**Prerequisites:** a GCP project with billing enabled, `gcloud` CLI authenticated (`gcloud auth login` + `gcloud auth application-default login`), Terraform ≥ 1.5, `kubectl`, `helm`, `docker` (with `buildx`).

```bash
# 1. One-time: create the remote-state bucket
cd terraform/bootstrap
terraform init && terraform apply

# 2. Provision everything: VPC, GKE, Cloud SQL, Artifact Registry, Secret
#    Manager, the CI Workload Identity pool, and the observability stack
cd ../environments/dev
# set your own project_id/region/zone in terraform.tfvars first
terraform init && terraform plan && terraform apply

# 3. Point kubectl at the new cluster
gcloud container clusters get-credentials <cluster_name> --zone <zone> --project <project_id>
#   (Terraform prints the exact command as `get_credentials_command` in its outputs)

# 4. Build and push the app images for the first time
docker build --platform linux/amd64 -t <region>-docker.pkg.dev/<project_id>/workstack/workstack-backend:v0.1.0 ./backend
docker build --platform linux/amd64 -t <region>-docker.pkg.dev/<project_id>/workstack/workstack-frontend:v0.1.0 ./frontend
docker push <region>-docker.pkg.dev/<project_id>/workstack/workstack-backend:v0.1.0
docker push <region>-docker.pkg.dev/<project_id>/workstack/workstack-frontend:v0.1.0

# 5. First install via Helm directly (before Argo CD takes over in step 7)
helm upgrade --install workstack ./helm/workstack -n workstack -f helm/workstack/values-gke.yaml

# 6. Verify
curl http://$(terraform -chdir=terraform/environments/dev output -raw ingress_static_ip)/

# 7. (Optional, Stage 7) install Argo CD and hand ongoing deploys to it —
#    see the full walkthrough in [Stage 7](#stage-7--argo-cd--gitops-cd),
#    including creating your own `workstack-gitops` repo.
kubectl create namespace argocd
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd -n argocd
```

From here on, day-to-day deploys work like this:

```bash
# If you only changed a chart template or values-gke.yaml (replicas, resources, env vars):
gcloud container clusters get-credentials <cluster_name> --zone <zone> --project <project_id>
helm upgrade --install workstack ./helm/workstack -n workstack -f helm/workstack/values-gke.yaml

# If you changed application code — a new image tag is required first,
# otherwise Helm sees the same tag as already deployed and does nothing:
docker build --platform linux/amd64 -t <region>-docker.pkg.dev/<project_id>/workstack/workstack-backend:v0.1.1 ./backend
docker push <region>-docker.pkg.dev/<project_id>/workstack/workstack-backend:v0.1.1
helm upgrade --install workstack ./helm/workstack -n workstack -f helm/workstack/values-gke.yaml \
  --set backend.image.tag=v0.1.1
```

Or, once Argo CD is wired up (Stage 7), the normal path is simply: **push to `main`** — CI builds, scans, and pushes the image, then commits the new tag to your GitOps repo, and Argo CD rolls it out on its own.

---

## Environment variables reference

**Root `.env`** (used by `docker-compose.yml`; copy from `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` | `workstack` | Postgres superuser for the compose container |
| `POSTGRES_PASSWORD` | `workstack` | Postgres password (dev-only default — change for anything beyond local dev) |
| `POSTGRES_DB` | `workstack` | Default database name |
| `SECRET_KEY` | `changeme-...` | JWT signing key — **generate a real one**, see command below |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Session cookie/JWT lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s) |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Used to build invitation links |
| `BACKEND_PORT` | `8000` | Host port mapped to the backend container |
| `FRONTEND_PORT` | `5173` | Host port mapped to the frontend container (container listens on 8080) |

Generate a real `SECRET_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**`backend/.env`** (only needed when running the backend natively, outside Docker; copy from `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://workstack:workstack@localhost:5432/workstack` |
| `TEST_DATABASE_URL` | `postgresql+psycopg://workstack:workstack@localhost:5432/workstack_test` — used by `pytest` |
| `SECRET_KEY` | Same as above |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Same as above |
| `CORS_ORIGINS` | Same as above |

On Kubernetes, the equivalents are the `backend-config` ConfigMap (non-secret) and `backend-secret` (secret — plaintext `Secret` on kind, synced from **Secret Manager** via the Secrets Store CSI driver on GKE).

---

## Operational runbooks

These are real commands used to operate the GKE environment day-to-day — not aspirational.

### Stop / start the GKE stack to save cost

**Stop everything overnight:**

```bash
gcloud container clusters get-credentials workstack-dev-gke --zone us-central1-a --project workstack-devops-vb

# Order matters — remove the HPA and scale to 0 *before* resizing the node
# pool, or the cluster autoscaler will just spin nodes back up to satisfy
# pods that still want to run.
kubectl -n workstack delete hpa backend
kubectl -n workstack scale deployment backend frontend --replicas=0

gcloud container clusters resize workstack-dev-gke \
  --node-pool=workstack-dev-pool --num-nodes=0 \
  --zone=us-central1-a --project=workstack-devops-vb --quiet

gcloud sql instances patch workstack-dev-pg \
  --activation-policy=NEVER --project=workstack-devops-vb
```

**Resume:**

```bash
gcloud container clusters get-credentials workstack-dev-gke --zone us-central1-a --project workstack-devops-vb

gcloud sql instances patch workstack-dev-pg \
  --activation-policy=ALWAYS --project=workstack-devops-vb   # ~2-3 min to become RUNNABLE

gcloud container clusters resize workstack-dev-gke \
  --node-pool=workstack-dev-pool --num-nodes=2 \
  --zone=us-central1-a --project=workstack-devops-vb --quiet

# Re-applying Helm restores replicas + the HPA to their declared state.
# (If Argo CD owns the app — Stage 7 — a sync does this instead: `argocd app sync workstack`.)
helm upgrade --install workstack ./helm/workstack -n workstack -f helm/workstack/values-gke.yaml

kubectl -n workstack get pods -w
curl -I http://34.49.71.24/
```

Leave the GKE cluster, VPC, Artifact Registry, and reserved static IP alone during a stop — don't run `terraform destroy` for a routine pause.

### Rolling back a deployment

**Pre-Argo-CD (plain Helm):**

```bash
helm rollback workstack <REVISION> -n workstack
```

**Post-Argo-CD (GitOps):**

```bash
cd workstack-gitops
git revert <sha-of-the-bad-deploy-commit> --no-edit
git push
# Argo CD deploys the previous image tag on its own on the next poll,
# or immediately via: argocd app sync workstack
```

### Full teardown

For decommissioning the whole cloud environment permanently:

```bash
# 1. Remove the Argo CD Application (cascades, releases the load balancer cleanly)
kubectl delete -f workstack-gitops/argocd/application.yaml

# 2. Remove Argo CD itself (it was installed imperatively, never in Terraform state)
helm uninstall argocd -n argocd

# 3. Destroy all Terraform-managed infrastructure (GKE, Cloud SQL, VPC,
#    Artifact Registry, Secret Manager, observability stack, CI WIF —
#    no deletion-protection blockers on any of it)
terraform -chdir=terraform/environments/dev destroy

# 4. Destroy the remote-state bucket itself
terraform -chdir=terraform/bootstrap destroy

# 5. Sanity-check the GCP console for anything left behind, then, if you
#    want to guarantee zero further billing (30-day undelete window as a
#    safety net):
gcloud projects delete <project_id>

# Local environments
kind delete cluster --name workstack
docker compose down -v
```

---

## Ownership boundaries (who manages what)

A recurring theme worth stating explicitly, since it's the thing an interviewer is most likely to probe:

| Concern | Owner |
|---|---|
| Cloud infrastructure (VPC, GKE cluster/node pool, Cloud SQL, Artifact Registry, Secret Manager, IAM/Workload Identity, the observability stack's Helm release) | **Terraform** |
| Kubernetes application deployment (Deployments, Services, HPA, PDB, Gateway/HTTPRoute, Secret sync) | **Argo CD** (via Helm rendering) |
| Packaging the Kubernetes application as one unit | **Helm** (`helm/workstack`) |
| Test/build/scan/publish on every push | **GitHub Actions** — never touches GKE |
| "What's currently deployed" (image tags) | **the `workstack-gitops` repo**, read by Argo CD |
| Metric collection | **Prometheus** |
| Visualization | **Grafana** |
| Alerting (deferred to Stage 9) | **Alertmanager** |

Terraform and Argo CD deliberately never manage the same application resources at the same time — Terraform stops at "the cluster exists and can run workloads"; everything inside the `workstack` namespace after that is Argo CD's job.

---

## Cost notes

This was built and operated cost-consciously throughout, on a solo learner's budget:

- **GKE Standard, not Autopilot**, with a `min 2 / max 4` autoscaling **Spot** node pool (`e2-medium`) — Spot VMs are meaningfully cheaper than on-demand, at the cost of occasional preemption (observed and recovered from automatically during Stage 4 verification).
- **Cloud SQL on `db-f1-micro`** — the smallest tier, with `max_connections` raised manually since the tier's default (~25) is too low for the app's connection pool × HPA replica count, but everything else left at the small-instance default.
- **Prometheus retention set to 3 days**, not the chart's longer default — this is a learning cluster, not a system that needs months of metric history.
- **No public Prometheus/Grafana endpoint** — avoids exposing (and having to secure) an extra public surface for a component that only needs to be checked occasionally via `port-forward`.
- **A public global external load balancer (the GKE Gateway) is the single most expensive always-on line item**, at roughly **$18–21/month** whenever it's provisioned — which is why the [stop/start runbook](#stop--start-the-gke-stack-to-save-cost) exists and is used routinely between sessions, rather than leaving the whole stack running 24/7. With the app deployed and the LB up, the running total is roughly **$60–65/month**; with everything scaled down (app pods, node pool, and Cloud SQL all stopped) it drops close to just the reserved static IP + disk costs.
- **Alertmanager, Loki, Tempo, OpenTelemetry, and Elasticsearch are all intentionally deferred** — each is a real, if modest, ongoing resource cost with no corresponding learning value yet at this project's current scope.

---

## What I can explain about this system

By the end of this project, the goal is to be able to talk through, from first principles, in a DevOps/SRE interview:

- Why Docker, why Kubernetes, why GKE, why Terraform, why Helm, why GitHub Actions, why Argo CD, why Prometheus, why Grafana, why Cloud SQL — for each one, a real reason, not "because it's standard."
- How a request actually reaches the application (`Internet → static IP → GKE Gateway → HTTPRoute → frontend Service → frontend pod → (for /api/*) → backend Service → backend pod → Cloud SQL Auth Proxy → Cloud SQL`).
- How a deployment actually happens (`git push → GitHub Actions build/scan/push → workstack-gitops commit → Argo CD sync → rolling Kubernetes update, respecting readiness probes and the PDB`).
- How rollback happens, both the old way (`helm rollback`) and the current way (`git revert` in the GitOps repo).
- How scaling happens (the backend HPA on CPU utilization; the frontend fixed at 2 replicas since it's just static file serving).
- How failures are detected today (Prometheus scraping `/metrics` and kube-state-metrics/node-exporter, visualized on the four-golden-signals Grafana dashboard) and how that's meant to extend into Stage 9 (Alertmanager rules, SLOs, failure-injection drills).
- How secrets are handled (Secret Manager + the Secrets Store CSI driver on GKE, Workload Identity instead of any downloaded key, a plaintext dev-only `Secret` on kind, GitHub OIDC/Workload Identity Federation for CI — never a long-lived credential committed anywhere).
- How the whole environment could be recreated from nothing (`terraform apply` from the bootstrap state bucket up through every module, then a Helm install / Argo CD bootstrap) — and, just as importantly, how to tear it all back down cleanly (see [Full teardown](#full-teardown)).
