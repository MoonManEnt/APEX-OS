# APEX Next Implementation Sequence

## What is now proven

- local infra runs
- schema initializes
- API boots
- sample event persists
- event feed renders in the newsroom shell

## Next credibility upgrade

### 1. Real ingestion source
Use `POST /ingest/google-news-cre` to ingest the first public-source CRE feed items through Google News RSS.

### 2. Real classification when configured
If `ANTHROPIC_API_KEY` is set in the API environment, classification now attempts a real Anthropic call before falling back.

### 3. Feed evolution
Once ingestion is proven, wire the web UI to subscribe to `/ws` and update on `feed.ingested` / `feed.seeded` events.

## Manual test path

### Ingest public-source items
```bash
curl -X POST 'http://127.0.0.1:8000/ingest/google-news-cre?query=commercial%20real%20estate%20Dallas'
```

### Recheck events
```bash
curl http://127.0.0.1:8000/events
```

## What to build after this
1. account/property linkage logic beyond the seed fallback
2. action rail with draft message cards
3. filter controls in the left rail
4. websocket-driven live feed updates
