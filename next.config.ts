import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

// withSentryConfig funciona mesmo sem nenhuma variável de ambiente do Sentry
// configurada — nesse caso o SDK simplesmente não envia nada (ver
// dsn/enabled condicionais em src/instrumentation-client.ts,
// src/sentry.server.config.ts e src/sentry.edge.config.ts) e o upload de
// source maps é pulado (precisa de SENTRY_AUTH_TOKEN). Não quebra o build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Só imprime logs de upload de source maps no CI, pra não poluir o build local.
  // Sem SENTRY_AUTH_TOKEN o upload de source maps é pulado automaticamente
  // (só um aviso, não quebra o build).
  silent: !process.env.CI,
});
