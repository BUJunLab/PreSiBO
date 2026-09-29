import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import process from "node:process";

dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url))
});

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AppConfig {
  port: number;
  corsOrigin: string;
  dataScope: "lite" | "full";
  database: DatabaseConfig;
}

const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g;

function stripInvisible(value: string | undefined): string {
  return (value ?? "").replace(INVISIBLE_CHARS, "").trim();
}

function normalizeDatabaseName(value: string | undefined): string {
  const cleaned = stripInvisible(value);
  if (!cleaned) {
    return "presibo1";
  }

  const [databaseName] = cleaned.split(".");
  return databaseName || "presibo1";
}

function required(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required. Set it in the environment.`);
  }

  return value;
}

function readDataScope(value: string | undefined): "lite" | "full" {
  const scope = stripInvisible(value).toLowerCase();
  if (!scope || scope === "lite") {
    return "lite";
  }
  if (scope === "full") {
    return "full";
  }

  throw new Error("PRESIBO_DATA_SCOPE must be either 'lite' or 'full'.");
}

let cachedConfig: AppConfig | undefined;

export function loadAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    port: Number(process.env.PORT ?? 3001),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    dataScope: readDataScope(process.env.PRESIBO_DATA_SCOPE),
    database: {
      host: required(stripInvisible(process.env.DB_HOST), "DB host"),
      port: Number(process.env.DB_PORT ?? 3306),
      user: required(stripInvisible(process.env.DB_USER), "DB user"),
      password: stripInvisible(process.env.DB_PASSWORD),
      database: normalizeDatabaseName(process.env.DB_NAME)
    }
  };

  return cachedConfig;
}
