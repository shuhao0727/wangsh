"""Authenticated AI evaluation and ephemeral leaderboard; no new DB tables."""

from fastapi import APIRouter, Depends, Request
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException

from app.core.deps import require_registered_user
from app.db.database import get_db
from app.core.exception_handlers import generic_exception_handler
from app.schemas.ai_partner import EvaluationRequest, EvaluationResponse, LeaderboardResponse, LeaderboardSubmission
from app.services.ai_partner_evaluation import evaluate
from app.schemas.user_info import UserInfo
from app.services.ai_partner_leaderboard import get_leaderboard


class NoStoreRoute(APIRoute):
    """Cover auth/validation/error responses as well as successful responses."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            try:
                response = await original(request)
            except HTTPException as exc:
                response = await http_exception_handler(request, exc)
            except RequestValidationError as exc:
                response = await request_validation_exception_handler(request, exc)
            except Exception as exc:
                response = await generic_exception_handler(request, exc)
            response.headers["Cache-Control"] = "no-store"
            return response

        return handler


router = APIRouter(route_class=NoStoreRoute)


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def read_leaderboard(user: UserInfo = Depends(require_registered_user)):
    return await get_leaderboard(user)


@router.post("/leaderboard", response_model=LeaderboardResponse)
async def submit_leaderboard(
    submission: LeaderboardSubmission,
    user: UserInfo = Depends(require_registered_user),
):
    return await get_leaderboard(user, submission)


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_partner(
    request: EvaluationRequest,
    user: UserInfo = Depends(require_registered_user),
    db=Depends(get_db),
):
    return await evaluate(db, user, request)
