"""Auth + users + health endpoints."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.dependencies import get_current_user_id, get_db
from app.models import Profile, User

router = APIRouter()


class RegisterIn(BaseModel):
    email: str
    name: str = ""


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        user = User(email=body.email, name=body.name)
        db.add(user)
        db.commit()
        db.refresh(user)
        db.add(Profile(user_id=user.id))
        db.commit()
    return {"user_id": user.id, "email": user.email,
            "token": create_access_token(user.id)}


@router.get("/me")
def me(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "not found"}
    return {"user_id": user.id, "email": user.email, "name": user.name}
