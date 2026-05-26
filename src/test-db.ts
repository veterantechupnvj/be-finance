import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const result = await pool.query("SELECT NOW()");
  console.log("✅ Connected!", result.rows[0]);
  await pool.end();
}

main().catch(console.error);
