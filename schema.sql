-- The Handy Beaver Database Schema

-- Customers (email-based auth)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  magic_token TEXT, -- For passwordless login
  token_expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Bookings/Jobs
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  title TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL, -- carpentry, flooring, deck, general
  status TEXT DEFAULT 'pending', -- pending, confirmed, in_progress, completed, cancelled
  scheduled_date TEXT, -- ISO date
  estimated_hours REAL,
  labor_rate REAL,
  helper_needed INTEGER DEFAULT 0,
  helper_rate REAL,
  materials_estimate REAL,
  deposit_paid REAL DEFAULT 0,
  total_paid REAL DEFAULT 0,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Messages (customer <-> business chat)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER REFERENCES bookings(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  sender TEXT NOT NULL, -- 'customer' or 'business' or 'ai'
  content TEXT NOT NULL,
  read_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Payments (Square transactions)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  square_payment_id TEXT,
  amount REAL NOT NULL,
  type TEXT NOT NULL, -- deposit, labor, materials, final
  status TEXT DEFAULT 'pending', -- pending, completed, refunded, failed
  created_at INTEGER DEFAULT (unixepoch())
);

-- Project Images (before/after + AI visualizations)
CREATE TABLE IF NOT EXISTS project_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER REFERENCES bookings(id),
  customer_id INTEGER REFERENCES customers(id),
  r2_key TEXT NOT NULL, -- R2 object key
  type TEXT NOT NULL, -- before, after, ai_visualization
  prompt TEXT, -- AI generation prompt if applicable
  created_at INTEGER DEFAULT (unixepoch())
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
