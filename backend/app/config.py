"""ClearDesk Application Configuration.

Loads settings from environment variables and .env file.
"""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API Metadata
    app_name: str = "ClearDesk API"
    app_version: str = "0.1.0"
    environment: str = "development"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Google Gemini API
    gemini_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    embed_model: str = "text-embedding-004"

    # Database and Storage
    database_url: str = "sqlite:///./cleardesk.db"
    chroma_dir: str = "./chroma_data"
    storage_dir: str = "./storage"

    # External Tool Binaries (optional overrides for Windows)
    tesseract_path: str = ""
    libreoffice_path: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        """Parse comma-separated string of origins into a list."""
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                # JSON-formatted list
                import json
                try:
                    return json.loads(value)
                except Exception:
                    pass
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
