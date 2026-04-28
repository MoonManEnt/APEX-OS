# @apex/db — Database Package

Canonical schema, migrations, and seed data for APEX OS.

## Ownership

- Event schema, raw scrape schema, classification schema
- Seed data for 5 Gore brands
- Enum registry (brand, market, event type, pipeline status)
- Normalization notes

## Migration Order

1. Brand enum and shared enums
2. Accounts / properties / contacts base tables
3. Events / raw_scrapes / classifications
4. Actions
5. Pipeline
6. voice_notes
7. Indexes (PostGIS, GIN/JSONB)

## TODOs

- [ ] TODO(WS-1): Write Alembic initial migration for events + raw_scrapes + classifications
- [ ] TODO(WS-1): Add seed script for 5 VPG/Gore brand rows
- [ ] TODO(WS-1): Define enum registry in `enums.py`
- [ ] TODO(DB): Add PostGIS extension for geo-indexed properties
