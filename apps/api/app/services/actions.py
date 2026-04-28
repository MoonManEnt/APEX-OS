import json
from typing import Optional

from anthropic import AsyncAnthropic

from app.core.settings import settings
from app.models.actions import ActionDraftRequest, ActionDraftResponse


ACTION_DRAFT_SYSTEM = """
You generate operator-reviewed commercial action drafts for APEX, a CRE intelligence operating system.
Return JSON only with keys:
- title
- body
- audience
- recommended_brand
- why_it_matters
- signal_posture
- context_notes
Keep the output commercially useful, concise, and grounded in the event signal.
Do not claim certainty you do not have.
""".strip()


def fallback_action_draft(request: ActionDraftRequest) -> ActionDraftResponse:
    event_type = request.event_type or 'market_news'
    primary_brand = request.primary_brand or 'clean_scapes'

    if event_type == 'ownership_transfer':
        audience = 'Asset manager, property manager, or transition lead'
        why = 'Ownership changes often create a real vendor review and stabilization window.'
        posture = 'High-action signal'
        title = 'Ownership transition outreach draft'
        body = (
            f"Subject: Support during the transition around {request.event_title}\n\n"
            f"I noticed the ownership transition tied to {request.event_title}. These moments often create a short window "
            f"to stabilize exterior presentation, operational cleanliness, and site security without adding friction during changeover. "
            f"If useful, we can outline a simple first-pass operating review for the property or portfolio."
        )
        notes = [
            'Confirm who is leading the transition before sending.',
            'Frame the message around stabilization and NOI protection.',
        ]
    elif event_type == 'personnel_change':
        audience = 'New executive or operating stakeholder'
        why = 'Leadership changes can reset attention and open a softer relationship entry point.'
        posture = 'Moderate-action signal'
        title = 'Relationship-opening note'
        body = (
            f"Subject: Congratulations on the new role connected to {request.event_title}\n\n"
            f"Congratulations on the leadership move reflected in {request.event_title}. As priorities settle, this can be a useful moment "
            f"to compare current operational standards against where the portfolio wants to go next. If helpful, we can share a concise view of where exterior, janitorial, or security performance often gets overlooked during leadership transitions."
        )
        notes = [
            'Lead with context and congratulations, not a hard ask.',
            'Use this as a relationship-opening touchpoint.',
        ]
    else:
        audience = 'Internal operator / growth team'
        why = 'This may be commercially relevant, but it needs human judgment before it becomes outreach.'
        posture = 'Review-before-action'
        title = 'Internal action recommendation'
        body = (
            f"Review {request.event_title} for real commercial relevance before pushing outreach. If this signal materially affects "
            f"{request.market or 'the target market'}, map it to the strongest response lane for {primary_brand}."
        )
        notes = [
            'Validate that the signal is not just market noise.',
            'Choose the best-fit brand before drafting external communication.',
        ]

    return ActionDraftResponse(
        event_id=request.event_id,
        title=title,
        body=body,
        audience=audience,
        recommended_brand=primary_brand,
        why_it_matters=why,
        signal_posture=posture,
        model_name='fallback-action-drafter',
        used_fallback=True,
        context_notes=notes,
        metadata={'event_type': event_type},
        draft_type=request.draft_type,
        draft_status='generated',
        edited_by_operator=False,
    )


async def generate_action_draft(request: ActionDraftRequest) -> ActionDraftResponse:
    if not settings.anthropic_api_key:
        return fallback_action_draft(request)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model='claude-3-5-sonnet-latest',
        max_tokens=900,
        temperature=0.2,
        system=ACTION_DRAFT_SYSTEM,
        messages=[
            {
                'role': 'user',
                'content': json.dumps(request.model_dump()),
            }
        ],
    )
    text_parts = [getattr(block, 'text', None) for block in message.content]
    text_output = '\n'.join([part for part in text_parts if part]).strip()
    if not text_output:
        return fallback_action_draft(request)

    try:
        parsed = json.loads(text_output)
        return ActionDraftResponse(
            event_id=request.event_id,
            title=parsed['title'],
            body=parsed['body'],
            audience=parsed['audience'],
            recommended_brand=parsed['recommended_brand'],
            why_it_matters=parsed['why_it_matters'],
            signal_posture=parsed['signal_posture'],
            model_name='claude-3-5-sonnet-latest',
            used_fallback=False,
            context_notes=parsed.get('context_notes', []),
            metadata={'event_type': request.event_type},
            draft_type=request.draft_type,
            draft_status='generated',
            edited_by_operator=False,
        )
    except Exception:
        return fallback_action_draft(request)
