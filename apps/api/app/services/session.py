from typing import Dict, List, Optional

from fastapi import Header

from app.core.settings import settings
from app.models.session import OperatorSession


ROLE_PERMISSIONS: Dict[str, List[str]] = {
    'principal_operator': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
    'operator': ['draft:edit', 'paperclip:write'],
    'reviewer': ['draft:edit', 'draft:approve'],
    'viewer': [],
}


def _slugify(value: str) -> str:
    return ''.join(ch.lower() if ch.isalnum() else '-' for ch in value).strip('-') or 'operator'


async def get_operator_session(
    x_apex_operator_name: Optional[str] = Header(default=None),
    x_apex_operator_id: Optional[str] = Header(default=None),
    x_apex_operator_role: Optional[str] = Header(default=None),
) -> OperatorSession:
    operator_name = x_apex_operator_name or settings.default_operator_name
    operator_id = x_apex_operator_id or _slugify(operator_name)
    role = x_apex_operator_role or settings.default_operator_role
    permissions = ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS['viewer'])
    return OperatorSession(
        operator_id=operator_id,
        operator_name=operator_name,
        role=role,
        auth_mode='header_session' if x_apex_operator_name or x_apex_operator_id else 'default_session',
        permissions=permissions,
    )


def require_permission(operator: OperatorSession, permission: str) -> None:
    if permission not in operator.permissions:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail=f'Operator role {operator.role} lacks permission: {permission}')
