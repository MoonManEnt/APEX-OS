import json
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposals import ProposalCreate, ProposalStatus, ProposedAction


_SELECT_COLS = """
    id::text as id,
    agent_id,
    agent_label,
    operator_id,
    tool_name,
    payload,
    summary,
    status,
    approval_source,
    approved_by,
    approver_note,
    rejection_reason,
    request_id::text as request_id,
    expires_at::text as expires_at,
    created_at::text as created_at,
    approved_at::text as approved_at,
    executed_at::text as executed_at,
    execution_result
"""


INSERT_PROPOSAL_SQL = text(f"""
    insert into proposed_actions (
        agent_id, agent_label, operator_id, tool_name, payload, summary, request_id, expires_at
    ) values (
        :agent_id, :agent_label, :operator_id, :tool_name,
        cast(:payload as jsonb), :summary,
        cast(:request_id as uuid), cast(:expires_at as timestamptz)
    )
    returning {_SELECT_COLS}
""")


GET_PROPOSAL_SQL = text(f"""
    select {_SELECT_COLS}
    from proposed_actions
    where id = cast(:id as uuid)
    limit 1
""")


FIND_BY_IDEMPOTENCY_SQL = text(f"""
    select {_SELECT_COLS}
    from proposed_actions
    where agent_id = :agent_id and request_id = cast(:request_id as uuid)
    limit 1
""")


LIST_PROPOSALS_SQL = text(f"""
    select {_SELECT_COLS}
    from proposed_actions
    where (cast(:status as text) is null or status = cast(:status as text))
      and (cast(:agent_id as text) is null or agent_id = cast(:agent_id as text))
    order by created_at desc
    limit :limit
""")


MARK_STATUS_SQL = text("""
    update proposed_actions
    set status = :status,
        approval_source = :approval_source,
        approved_by = :approved_by,
        approver_note = :approver_note,
        rejection_reason = :rejection_reason,
        approved_at = case when :status in ('approved','rejected') then now() else approved_at end
    where id = cast(:id as uuid)
""")


MARK_EXECUTED_SQL = text("""
    update proposed_actions
    set executed_at = now(),
        execution_result = cast(:execution_result as jsonb)
    where id = cast(:id as uuid)
""")


SWEEP_EXPIRED_SQL = text("""
    update proposed_actions
    set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning id::text as id
""")


def _row_to_model(row: dict) -> ProposedAction:
    data = dict(row)
    if isinstance(data.get('payload'), str):
        data['payload'] = json.loads(data['payload'])
    if isinstance(data.get('execution_result'), str):
        data['execution_result'] = json.loads(data['execution_result'])
    return ProposedAction(**data)


async def insert_proposal(session: AsyncSession, req: ProposalCreate) -> ProposedAction:
    result = await session.execute(
        INSERT_PROPOSAL_SQL,
        {
            'agent_id': req.agent_id,
            'agent_label': req.agent_label,
            'operator_id': req.operator_id,
            'tool_name': req.tool_name,
            'payload': json.dumps(req.payload),
            'summary': req.summary,
            'request_id': req.request_id,
            'expires_at': req.expires_at,
        },
    )
    row = result.mappings().first()
    await session.commit()
    return _row_to_model(row)


async def get_proposal(session: AsyncSession, proposal_id: str) -> Optional[ProposedAction]:
    result = await session.execute(GET_PROPOSAL_SQL, {'id': proposal_id})
    row = result.mappings().first()
    return _row_to_model(row) if row else None


async def find_by_idempotency(
    session: AsyncSession, *, agent_id: str, request_id: str
) -> Optional[ProposedAction]:
    result = await session.execute(
        FIND_BY_IDEMPOTENCY_SQL, {'agent_id': agent_id, 'request_id': request_id}
    )
    row = result.mappings().first()
    return _row_to_model(row) if row else None


async def list_proposals(
    session: AsyncSession,
    *,
    status: Optional[ProposalStatus] = None,
    agent_id: Optional[str] = None,
    limit: int = 50,
) -> list[ProposedAction]:
    result = await session.execute(
        LIST_PROPOSALS_SQL,
        {
            'status': status.value if status else None,
            'agent_id': agent_id,
            'limit': limit,
        },
    )
    rows = result.mappings().all()
    return [_row_to_model(r) for r in rows]


async def mark_status(
    session: AsyncSession,
    *,
    proposal_id: str,
    status: ProposalStatus,
    approval_source: Optional[str] = None,
    approved_by: Optional[str] = None,
    approver_note: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> None:
    await session.execute(
        MARK_STATUS_SQL,
        {
            'id': proposal_id,
            'status': status.value,
            'approval_source': approval_source,
            'approved_by': approved_by,
            'approver_note': approver_note,
            'rejection_reason': rejection_reason,
        },
    )
    await session.commit()


async def mark_executed(
    session: AsyncSession, *, proposal_id: str, execution_result: dict
) -> None:
    await session.execute(
        MARK_EXECUTED_SQL,
        {'id': proposal_id, 'execution_result': json.dumps(execution_result)},
    )
    await session.commit()


async def sweep_expired(session: AsyncSession) -> list[str]:
    result = await session.execute(SWEEP_EXPIRED_SQL)
    rows = result.mappings().all()
    await session.commit()
    return [r['id'] for r in rows]
