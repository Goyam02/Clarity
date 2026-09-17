"""Problems: generate (QuestionGen) + list/get."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.question_generator import QuestionGeneratorAgent
from app.dependencies import get_current_user_id, get_db
from app.models import Problem

router = APIRouter()


class GenerateIn(BaseModel):
    pattern: str = "sliding-window"
    topic_id: str = "sliding-window"
    difficulty: str = "medium"
    company: str = ""


@router.post("/generate")
async def generate(body: GenerateIn, user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    res = await QuestionGeneratorAgent().run(body.model_dump(), user_id=user_id,
                                             workflow="problem_gen", db=db)
    out = res["output"]
    problem = Problem(title=out["title"], statement=out["statement"],
                      difficulty=out.get("difficulty", "medium"), topic_id=body.topic_id,
                      pattern=body.pattern, company_id="", source_type="generated",
                      constraints=out.get("constraints", []), examples=out.get("examples", []),
                      test_cases=out.get("test_cases", []),
                      expected_complexity=out.get("expected_complexity", {}),
                      validation_status="valid")
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return {"problem_id": problem.id, **out, "trace_id": res["trace_id"]}


@router.get("")
def list_problems(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    rows = db.query(Problem).order_by(Problem.created_at.desc()).limit(50).all()
    return {"problems": [{"id": p.id, "title": p.title, "difficulty": p.difficulty,
                          "pattern": p.pattern} for p in rows]}


@router.get("/{problem_id}")
def get_problem(problem_id: str, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        return {"error": "not found"}
    return {"id": p.id, "title": p.title, "statement": p.statement,
            "difficulty": p.difficulty, "constraints": p.constraints,
            "examples": p.examples, "pattern": p.pattern,
            "expected_complexity": p.expected_complexity}
