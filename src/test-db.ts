import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  const result = await pool.query("SELECT NOW()");
  console.log("✅ Connected!", result.rows[0]);
  await pool.end();
}

main().catch(console.error);
