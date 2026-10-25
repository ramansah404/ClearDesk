"""ClearDesk Application Configuration.

Loads settings from environment variables and .env file.
Supports automatic persistent-disk detection (e.g. /var/data on Render).
"""

import os
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
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
    cors_origins: Union[List[str], str] = [
        "https://clear-desk-one.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    cors_origin_regex: Optional[str] = r"^https:\/\/.*(\.vercel\.app|\.onrender\.com)$"

    # Google Gemini API
    gemini_api_key: str = ""
    llm_model: str = "gemini-3.5-flash-lite"
    embed_model: str = "gemini-embedding-001"

    # Persistent Storage Paths
    data_dir: Optional[str] = None
    database_url: str = "sqlite:///./cleardesk.db"
    chroma_dir: str = "./chroma_data"
    storage_dir: str = "./storage"

    # External Tool Binaries (optional overrides for Windows)
    tesseract_path: str = ""
    libreoffice_path: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        """Parse comma-separated string of origins into a list, ensuring production Vercel domain is present."""
        origins: List[str] = []
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                import json
                try:
                    origins = json.loads(value)
                except Exception:
                    pass
            if not origins:
                origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        elif isinstance(value, list):
            origins = [str(o).strip() for o in value if str(o).strip()]
        else:
            origins = []

        # Guarantee production frontend origin is always allowed
        prod_origin = "https://clear-desk-one.vercel.app"
        if prod_origin not in origins:
            origins.append(prod_origin)

        return origins

    @model_validator(mode="after")
    def resolve_persistent_paths(self) -> "Settings":
        """Automatically resolve persistent paths if DATA_DIR is set or /var/data exists."""
        effective_data_dir = self.data_dir
        if not effective_data_dir and os.path.exists("/var/data") and os.path.isdir("/var/data"):
            effective_data_dir = "/var/data"

        if effective_data_dir:
            clean_dir = effective_data_dir.rstrip("/\\")
            if self.database_url == "sqlite:///./cleardesk.db":
                self.database_url = f"sqlite:///{clean_dir}/cleardesk.db"
            if self.chroma_dir == "./chroma_data":
                self.chroma_dir = f"{clean_dir}/chroma_data"
            if self.storage_dir == "./storage":
                self.storage_dir = f"{clean_dir}/storage"

        return self


settings = Settings()
