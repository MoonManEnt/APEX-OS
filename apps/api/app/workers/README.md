# APEX API Workers

## WS-1 Implementation Targets

### ingestion.fetch
- fetch configured public CRE sources
- normalize raw payload into `raw_scrapes`
- calculate source hash for dedup
- enqueue `classification.run`

### classification.run
- load raw scrape payload
- call Claude classification prompt
- validate response schema
- persist `events` + `event_classifications`
- enqueue `feed.publish`

## Rule
Worker outputs are not canonical until they pass deterministic schema validation and persistence.
