-- Schema v4: Add leads table for Facebook group monitoring

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'facebook', -- facebook, website, referral
  source_url TEXT, -- Link to original post
  source_group_id TEXT, -- Facebook group ID
  source_group_name TEXT,
  source_user_name TEXT, -- Facebook user who posted
  content TEXT, -- Original post content
  keywords_matched TEXT, -- JSON array of matched keywords
  response_sent INTEGER DEFAULT 0,
  response_content TEXT,
  response_sent_at INTEGER,
  converted_to_customer INTEGER DEFAULT 0,
  customer_id INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_converted ON leads(converted_to_customer);
