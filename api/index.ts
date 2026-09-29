import type { Request, Response } from "express";

type AppHandler = (request: Request, response: Response) => unknown;

let appPromise: Promise<AppHandler> | undefined;

function loadApp(): Promise<AppHandler> {
  return import("../apps/backend/src/app.js").then(({ buildApp }) => buildApp());
}

export default async function handler(request: Request, response: Response) {
  const app = await (appPromise ??= loadApp());
  return app(request, response);
}
