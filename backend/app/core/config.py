"""Central application configuration. Env-driven; no secrets hardcoded."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # PostgreSQL is the primary database (docker compose provides it locally).
    # SQLite remains supported only for the test suite (tests/conftest.py pins it).
    DATABASE_URL: str = "postgresql+psycopg2://clarity:clarity@localhost:5432/clarity"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth (dev-friendly; production should set JWT_SECRET + use real IdP)
    JWT_SECRET: str = "dev-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    DEV_AUTH_ALLOW_HEADER: bool = True

    # --- Microsoft Foundry (required: every agent calls the real service) ---
    # Project endpoint, e.g. https://<resource>.services.ai.azure.com/api/projects/<project>
    # Auth is Entra ID via DefaultAzureCredential: `az login` locally,
    # Managed Identity on Azure. No keys are used or accepted.
    AZURE_FOUNDRY_PROJECT_ENDPOINT: str = ""
    # Model deployment name inside the Foundry project (e.g. gpt-4o-mini).
    AZURE_FOUNDRY_MODEL_DEPLOYMENT: str = ""
    # Foundry agent resource names (one deployed agent per Clarity agent).
    PLANNER_AGENT: str = "planner"
    QUESTION_GENERATOR_AGENT: str = "question-generator"
    EVALUATOR_AGENT: str = "evaluator"
    INTERVIEWER_AGENT: str = "interviewer"
    COMPANY_INTEL_AGENT: str = "company-intel"
    # Web research: a Foundry agent with "Grounding with Bing Search" attached
    # (Bing Search APIs retired Aug 2025 — grounding tool is the sanctioned path).
    # Empty name disables web research; CSV corpus alone is used (see
    # services/web_corpus.py).
    WEB_RESEARCH_AGENT: str = "company-intel"
    # Re-search a company's web-sourced questions at most once per TTL.
    WEB_RESEARCH_TTL_DAYS: int = 14
    FOUNDRY_TIMEOUT_SECONDS: int = 60
    FOUNDRY_MAX_RETRIES: int = 3

    # Foundry IQ / Search (retrieval augmentation; optional)
    AZURE_SEARCH_ENDPOINT: str = ""
    AZURE_SEARCH_INDEX: str = "clarity-corpus"
    AZURE_SEARCH_API_KEY: str = ""

    # Blob
    AZURE_STORAGE_ACCOUNT: str = ""
    AZURE_STORAGE_CONTAINER: str = "clarity"
    AZURE_STORAGE_CONNECTION_STRING: str = ""

    # Application Insights
    APPLICATIONINSIGHTS_CONNECTION_STRING: str = ""

    # External APIs
    GITHUB_API_BASE_URL: str = "https://api.github.com"
    CODEFORCES_API_BASE_URL: str = "https://codeforces.com/api"

    # Google sign-in (optional; endpoints 501 until client credentials set)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/auth/google/callback"

    # Per-company problem-frequency corpus (LeetCode-style CSV seed data)
    COMPANY_CORPUS_DIR: str = "../data/company-corpus/companies"

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith(("postgresql", "postgres"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
