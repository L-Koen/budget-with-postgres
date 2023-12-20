CREATE TABLE IF NOT EXISTS envelopes_db (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    amount FLOAT NOT NULL CHECK (amount >= 0)
);