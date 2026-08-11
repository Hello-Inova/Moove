import * as Sentry from "@sentry/nextjs";

// Sem SENTRY_DSN configurado, o SDK fica desabilitado (não envia nada).
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
