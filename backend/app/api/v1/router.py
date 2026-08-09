from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.invitations import router as invitations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.sprints import project_sprints_router, router as sprints_router
from app.api.v1.tasks import project_tasks_router, router as tasks_router
from app.api.v1.workspaces import router as workspaces_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(workspaces_router)
api_router.include_router(invitations_router)
api_router.include_router(projects_router)
api_router.include_router(project_sprints_router)
api_router.include_router(sprints_router)
api_router.include_router(project_tasks_router)
api_router.include_router(tasks_router)
