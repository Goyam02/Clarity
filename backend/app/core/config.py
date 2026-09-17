"""Central application configuration. Env-driven; no secrets hardcoded."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "sqlite:///./clarity.db"
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

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith(("postgresql", "postgres"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
