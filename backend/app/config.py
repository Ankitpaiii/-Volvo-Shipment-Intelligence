from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./volvo_shipments.db"
    gap_check_interval_seconds: int = 30
    gps_simulation_interval_seconds: int = 15
    anthropic_api_key: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
