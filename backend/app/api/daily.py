"""Daily plan + onboarding + problems + submissions endpoints."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_current_user_id, get_db
from app.schemas import DailyPlanRequest
from app.workflows import daily as daily_wf

router = APIRouter()


@router.post("/plan")
async def create_plan(body: DailyPlanRequest, user_id: str = Depends(get_current_user_id),
                      db: Session = Depends(get_db)):
    return await daily_wf.build_daily_plan(db, user_id, body.mood, body.time_available)
