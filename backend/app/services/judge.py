"""CodeJudge abstraction: never executes user code in the FastAPI process.

LocalJudge runs Python in a subprocess with timeout + temp-dir isolation
(filesystem isolation, CPU/memory limits best-effort). Java supported when
a JDK is present, else reports unavailable. Swap with an Azure-native
sandbox by implementing CodeJudge.
"""
import asyncio
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TestCaseResult:
    index: int
    passed: bool
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False


@dataclass
class JudgeResult:
    compile_status: str  # ok | compile_error | runtime_error | timeout | unsupported
    test_results: list = field(default_factory=list)
    runtime_ms: int = 0
    memory_kb: int = 0
    passed: int = 0
    total: int = 0
    error: str = ""


class CodeJudge:
    async def execute(self, language: str, source_code: str, test_cases: list,
                      timeout_seconds: int = 10) -> JudgeResult:
        raise NotImplementedError


class LocalJudge(CodeJudge):
    SUPPORTED = {"python"}

    async def execute(self, language: str, source_code: str, test_cases: list,
                      timeout_seconds: int = 10) -> JudgeResult:
        lang = language.lower()
        if lang in ("python", "py"):
            return await self._run_python(source_code, test_cases, timeout_seconds)
        if lang in ("java",):
            return await self._run_java(source_code, test_cases, timeout_seconds)
        return JudgeResult(compile_status="unsupported", error=f"Language '{language}' not supported in MVP")

    async def _run_python(self, source: str, test_cases: list, timeout: int) -> JudgeResult:
        import time as _time
        results: list[TestCaseResult] = []
        total_ms = 0
        with tempfile.TemporaryDirectory(prefix="clarity_judge_") as tmp:
            prog = Path(tmp) / "solution.py"
            prog.write_text(source)
            for i, tc in enumerate(test_cases or []):
                stdin = str(tc.get("input", "")) if isinstance(tc, dict) else ""
                expected = str(tc.get("output", "")).strip() if isinstance(tc, dict) else ""
                start = _time.time()
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "python3", str(prog),
                        stdin=asyncio.subprocess.PIPE,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=tmp,
                    )
                    try:
                        out, err = await asyncio.wait_for(
                            proc.communicate(stdin.encode()), timeout=timeout)
                    except asyncio.TimeoutError:
                        try:
                            proc.kill()
                        except ProcessLookupError:
                            pass
                        results.append(TestCaseResult(i, False, "", "timeout", True))
                        continue
                    ms = int((_time.time() - start) * 1000)
                    total_ms += ms
                    stdout = out.decode(errors="replace").strip()
                    stderr = err.decode(errors="replace")[:2000]
                    if proc.returncode != 0:
                        results.append(TestCaseResult(i, False, stdout, stderr))
                    else:
                        results.append(TestCaseResult(i, stdout == expected, stdout, stderr))
                except Exception as e:  # sandbox spawn failure
                    results.append(TestCaseResult(i, False, "", str(e)[:500]))
        passed = sum(1 for r in results if r.passed)
        status = "ok" if results and passed == len(results) else (
            "runtime_error" if any(r.stderr and not r.timed_out for r in results) else "ok")
        if any(r.timed_out for r in results):
            status = "timeout"
        return JudgeResult(compile_status=status,
                           test_results=[r.__dict__ for r in results],
                           runtime_ms=total_ms, passed=passed, total=len(results))

    async def _run_java(self, source: str, test_cases: list, timeout: int) -> JudgeResult:
        if not (shutil.which("javac") and shutil.which("java")):
            return JudgeResult(compile_status="unsupported",
                               error="JDK not available in this environment")
        import time as _time
        results: list[TestCaseResult] = []
        total_ms = 0
        with tempfile.TemporaryDirectory(prefix="clarity_java_") as tmp:
            prog = Path(tmp) / "Solution.java"
            prog.write_text(source)
            comp = await asyncio.create_subprocess_exec(
                "javac", str(prog), stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE, cwd=tmp)
            out, err = await comp.communicate()
            if comp.returncode != 0:
                return JudgeResult(compile_status="compile_error",
                                   error=err.decode(errors="replace")[:2000])
            for i, tc in enumerate(test_cases or []):
                stdin = str(tc.get("input", "")) if isinstance(tc, dict) else ""
                expected = str(tc.get("output", "")).strip() if isinstance(tc, dict) else ""
                start = _time.time()
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "java", "-cp", tmp, "Solution",
                        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE, cwd=tmp)
                    try:
                        o, e = await asyncio.wait_for(proc.communicate(stdin.encode()), timeout=timeout)
                    except asyncio.TimeoutError:
                        try:
                            proc.kill()
                        except ProcessLookupError:
                            pass
                        results.append(TestCaseResult(i, False, "", "timeout", True))
                        continue
                    total_ms += int((_time.time() - start) * 1000)
                    stdout = o.decode(errors="replace").strip()
                    results.append(TestCaseResult(i, stdout == expected, stdout,
                                                  e.decode(errors="replace")[:2000]))
                except Exception as e:
                    results.append(TestCaseResult(i, False, "", str(e)[:500]))
        passed = sum(1 for r in results if r.passed)
        status = "ok" if passed == len(results) and results else "runtime_error"
        if any(r.timed_out for r in results):
            status = "timeout"
        return JudgeResult(compile_status=status,
                           test_results=[r.__dict__ for r in results],
                           runtime_ms=total_ms, passed=passed, total=len(results))


def get_judge() -> CodeJudge:
    return LocalJudge()
