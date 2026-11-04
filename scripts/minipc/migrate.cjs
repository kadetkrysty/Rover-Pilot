#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before running RoverOS migrations.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });

  try {
    await migrate(drizzle(pool), {
      migrationsFolder: process.env.ROVEROS_MIGRATIONS_DIR || path.resolve(process.cwd(), "migrations"),
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("RoverOS database migration failed:", error?.message || "unknown error");
  process.exitCode = 1;
});
