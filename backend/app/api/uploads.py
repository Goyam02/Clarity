"""Uploads: resume PDFs + profile screenshots (spec §3 screens 2-3).

Files are stored via storage_service (Azure Blob when configured, local dir
otherwise) and parsed by the vision/text extraction layer. No credentials for
LeetCode/GFG are ever collected — screenshots only.
"""
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.integrations.foundry import vision
from app.models import Profile
from app.services.storage_service import upload_blob

router = APIRouter()

MAX_BYTES = 8 * 1024 * 1024
ALLOWED = {"application/pdf", "image/png", "image/jpeg", "image/webp"}


def _read_upload(file: UploadFile) -> bytes:
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ClarityError("VALIDATION_ERROR", "File too large (max 8MB)", 400)
    if file.content_type not in ALLOWED:
        raise ClarityError("VALIDATION_ERROR",
                           f"Unsupported file type: {file.content_type}", 400)
    return data


@router.post("/resume")
async def upload_resume(file: UploadFile = File(...),
                        user_id: str = Depends(get_current_user_id),
                        db: Session = Depends(get_db)):
    data = _read_upload(file)
    ref = await upload_blob(file.filename or "resume.pdf", data,
                            file.content_type or "application/pdf")
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if prof:
        prof.resume_blob_ref = ref
        db.commit()
    # Extract immediately so the user sees editable chips on screen 2.
    text = vision.pdf_to_text(data)
    extracted = await vision.extract_resume(text)
    return {"blob_ref": ref, "skills": extracted.get("skills", []),
            "projects": extracted.get("projects", []),
            "summary": extracted.get("summary", ""), "needs_confirmation": True}


@router.post("/screenshot")
async def upload_screenshot(file: UploadFile = File(...),
                            user_id: str = Depends(get_current_user_id),
                            db: Session = Depends(get_db)):
    data = _read_upload(file)
    ref = await upload_blob(file.filename or "profile.png", data,
                            file.content_type or "image/png")
    extracted = await vision.extract_profile_screenshot(data, "leetcode")
    return {"blob_ref": ref, **extracted, "needs_confirmation": True}
