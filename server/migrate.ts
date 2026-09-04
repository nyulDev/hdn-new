import { sql } from './db';

async function migrate() {
  console.log('Starting migration...');

  try {
    // Create customers table
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        kode VARCHAR(20) UNIQUE,
        pt TEXT,
        nama_kapal TEXT,
        kontak TEXT,
        alamat TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Customers table created or already exists.');

    // Create estimasi table
    await sql`
      CREATE TABLE IF NOT EXISTS estimasi (
        id SERIAL PRIMARY KEY,
        judul TEXT,
        form_info JSONB,
        items JSONB,
        costs JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Estimasi table created or already exists.');

    await sql`
      CREATE TABLE IF NOT EXISTS invoice (
        id SERIAL PRIMARY KEY,
        no_quo TEXT NOT NULL,
        judul TEXT,
        customer_name TEXT,
        amount NUMERIC(18,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'belum_dibayar',
        form_info JSONB,
        items JSONB,
        costs JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Invoice table created or already exists.');

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        phone_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'viewers')),
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Users table created or already exists.');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
