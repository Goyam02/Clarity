"""Central application configuration. Env-driven; no secrets hardcoded."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    CLARITY_AI_MODE: str = "mock"  # mock | azure
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "sqlite:///./clarity.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth (dev-friendly; production should set JWT_SECRET + use real IdP)
    JWT_SECRET: str = "dev-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    DEV_AUTH_ALLOW_HEADER: bool = True

    # Azure / Foundry (all optional for local mock mode)
    AZURE_AI_PROJECT_ENDPOINT: str = ""
    AZURE_FOUNDRY_PROJECT_ENDPOINT: str = ""
    AZURE_FOUNDRY_MODEL: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    PLANNER_AGENT_ID: str = ""
    QUESTION_GENERATOR_AGENT_ID: str = ""
    EVALUATOR_AGENT_ID: str = ""
    INTERVIEWER_AGENT_ID: str = ""
    COMPANY_INTEL_AGENT_ID: str = ""

    AZURE_SEARCH_ENDPOINT: str = ""
    AZURE_SEARCH_INDEX: str = "clarity-corpus"
    AZURE_SEARCH_API_KEY: str = ""

    AZURE_STORAGE_ACCOUNT: str = ""
    AZURE_STORAGE_CONTAINER: str = "clarity"
    AZURE_STORAGE_CONNECTION_STRING: str = ""

    APPLICATIONINSIGHTS_CONNECTION_STRING: str = ""

    GITHUB_API_BASE_URL: str = "https://api.github.com"
    CODEFORCES_API_BASE_URL: str = "https://codeforces.com/api"

    @property
    def ai_mode(self) -> str:
        return self.CLARITY_AI_MODE.lower()

    @property
    def is_mock(self) -> bool:
        return self.ai_mode != "azure"

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith(("postgresql", "postgres"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
