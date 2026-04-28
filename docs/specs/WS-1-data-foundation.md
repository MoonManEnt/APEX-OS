# WS-1 — Data Foundation

## Goal

Deliver the first operational slice of APEX data flow:
- fetch source
- normalize raw scrape
- classify event
- persist canonical event records

## Initial interfaces

### Raw scrape input
See `apps/api/app/models/ingestion.py` → `RawScrapePayload`

### Classification output
See `apps/api/app/models/ingestion.py` → `ClassificationResult`

## Immediate next implementation tasks

1. wire async database session and migrations
2. persist `raw_scrapes` using `normalize_raw_scrape`
3. call Anthropic from `classify_raw_scrape`
4. validate LLM output against `ClassificationResult`
5. persist `events` + `event_classifications`
6. enqueue `feed.publish`

## Guardrails

- raw scrape is not truth
- classification is not truth until validated and persisted
- event output must preserve source lineage
- property/event/action chain outranks generic CRM modeling
