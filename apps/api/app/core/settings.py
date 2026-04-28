from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = 'postgresql://postgres:postgres@localhost:5432/apex_os'
    redis_url: str = 'redis://localhost:6379'
    anthropic_api_key: str = ''
    openai_api_key: str = ''
    session_secret: str = 'change-me-in-production'
    default_operator_name: str = 'Reginald'
    default_operator_role: str = 'principal_operator'

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False,
    )


settings = Settings()
