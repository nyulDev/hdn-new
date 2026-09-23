import { neon } from '@neondatabase/serverless';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

dns.setDefaultResultOrder('ipv4first');

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env');
}

export const sql = neon(connectionString);
