import * as Sentry from "@sentry/nextjs";

// Sem NEXT_PUBLIC_SENTRY_DSN configurado, o SDK fica desabilitado (não
// envia nada) — permite deixar o monitoramento pronto no código sem
// obrigar ninguém a configurar uma conta Sentry pra rodar o projeto.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  // Amostra de traces de performance — baixo em produção pra não estourar
  // a cota gratuita do Sentry.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

// Instrumenta as trocas de rota do App Router (client-side navigation).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
