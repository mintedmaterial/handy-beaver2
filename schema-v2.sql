-- The Handy Beaver Database Schema v2
-- Adds auth tables and enhances customer tracking

-- Admin users (GitHub OAuth)
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id TEXT UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'owner', -- owner, admin, staff
  created_at INTEGER DEFAULT (unixepoch()),
  last_login INTEGER
);

-- Customer sessions (magic link auth)
CREATE TABLE IF NOT EXISTS customer_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  last_used INTEGER
);

-- Magic link tokens (for email auth)
CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Enhance customers table with status
ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'lead'; -- lead, prospect, customer, inactive
ALTER TABLE customers ADD COLUMN total_jobs INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN total_spent REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN notes TEXT;
ALTER TABLE customers ADD COLUMN promo_code TEXT;

-- Quotes table (separate from bookings for tracking)
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  booking_id INTEGER REFERENCES bookings(id),
  labor_type TEXT NOT NULL, -- half_day, full_day
  labor_rate REAL NOT NULL,
  estimated_hours REAL,
  helper_needed INTEGER DEFAULT 0,
  helper_type TEXT, -- half_day, full_day
  helper_rate REAL,
  materials_estimate REAL DEFAULT 0,
  equipment_estimate REAL DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  discount_reason TEXT,
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, accepted, declined, expired
  valid_until INTEGER,
  sent_at INTEGER,
  viewed_at INTEGER,
  responded_at INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_admins_github ON admins(github_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON customer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_magic_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
