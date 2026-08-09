from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://workstack:workstack@localhost:5432/workstack"
    TEST_DATABASE_URL: str = "postgresql+psycopg://workstack:workstack@localhost:5432/workstack_test"

    SECRET_KEY: str = "changeme-generate-a-real-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    CORS_ORIGINS: str = "http://localhost:5173"

    COOKIE_NAME: str = "access_token"
    # Cookies must be sent over HTTPS in production; disabled for local http dev.
    COOKIE_SECURE: bool = False

    # Used to build invitation URLs. No email provider yet, so these are
    # returned directly in the API response for local/manual testing.
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    INVITATION_EXPIRE_HOURS: int = 24 * 7

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
