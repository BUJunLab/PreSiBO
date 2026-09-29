import mysql from "mysql2/promise";

import { loadAppConfig } from "../config/env.js";

const appConfig = loadAppConfig();

const pool = mysql.createPool({
  host: appConfig.database.host,
  port: appConfig.database.port,
  user: appConfig.database.user,
  password: appConfig.database.password,
  database: appConfig.database.database,
  waitForConnections: true,
  connectionLimit: 8,
  decimalNumbers: true
});

export const databaseName = appConfig.database.database;

export async function queryRows(
  sql: string,
  params: readonly unknown[] = []
): Promise<Record<string, unknown>[]> {
  const [rows] = await pool.query(sql, [...params]);
  return rows as Record<string, unknown>[];
}

export async function pingDatabase(): Promise<void> {
  await pool.query("SELECT 1 AS ok");
}

export async function closePool(): Promise<void> {
  await pool.end();
}
