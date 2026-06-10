import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../lib/db.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

async function run() {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    console.log(`Running migration ${file}...`);
    await pool.query(sql);
  }

  console.log("Migrations complete.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
