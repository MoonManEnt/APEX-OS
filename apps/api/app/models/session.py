from pydantic import BaseModel


class OperatorSession(BaseModel):
    operator_id: str
    operator_name: str
    role: str = 'principal_operator'
    auth_mode: str = 'dev_session'
    permissions: list[str] = []
