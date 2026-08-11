import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captura erros não tratados em Server Components, middleware e rotas
// (route handlers) — complementa os `try/catch` já existentes nas rotas de
// API, que tratam os erros esperados; isso aqui pega o que escapar.
export const onRequestError = Sentry.captureRequestError;
