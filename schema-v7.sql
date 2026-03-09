-- Schema v7: Add saved_indefinitely flag for gallery retention
-- Run: wrangler d1 execute handy-beaver-db --file=./schema-v7.sql

-- Add column for indefinite save
ALTER TABLE visualizer_usage ADD COLUMN saved_indefinitely INTEGER DEFAULT 0;

-- Index for cleanup job (find expired items)
CREATE INDEX IF NOT EXISTS idx_visualizer_usage_expires 
ON visualizer_usage(saved_indefinitely, created_at);
