import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
const schemaPath = join(serverRoot, "schema.sql");

// Always use server/.env (not cwd). Does not override an already-set DATABASE_URL
// from the shell; unset it first if you need .env to win.
dotenv.config({ path: join(serverRoot, ".env") });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and adjust.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: url });
  const sql = readFileSync(schemaPath, "utf8");
  await pool.query(sql);

  const { rows: [ctx] } = await pool.query(
    `SELECT current_database() AS db, current_user AS role`
  );
  console.log(`Schema applied successfully on database "${ctx.db}" (role: ${ctx.role}).`);

  const { rows: tables } = await pool.query(
    `SELECT schemaname, tablename
     FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'todos'`
  );
  if (tables.length === 0) {
    console.warn("Could not find public.todos in pg_tables — check you are browsing the same DB.");
  } else {
    console.log("Verified: public.todos exists.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
