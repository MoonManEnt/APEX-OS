-- Account Workspace: add fields to properties for operator enrichment
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS sqft INTEGER,
  ADD COLUMN IF NOT EXISTS noi_cents INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS brands TEXT[] NOT NULL DEFAULT '{}';
