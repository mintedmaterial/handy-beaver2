-- Schema v6: AI Visualizer Usage Tracking
-- Run: wrangler d1 execute handy-beaver-db --file=./schema-v6.sql

-- Visualizer usage tracking
CREATE TABLE IF NOT EXISTS visualizer_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  image_key TEXT NOT NULL,           -- R2 key of input image
  prompt TEXT NOT NULL,
  result_key TEXT,                   -- R2 key of generated image
  result_url TEXT,                   -- Public URL with watermark
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Index for daily usage lookups
CREATE INDEX IF NOT EXISTS idx_visualizer_usage_customer_date 
ON visualizer_usage(customer_id, created_at);

-- Daily usage limits by customer status
-- lead/prospect: 3/day
-- active (project in progress): 10/project (tracked via job_id)
-- admin: unlimited
