"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Capa de erro para qualquer falha não tratada em toda a árvore do App
 * Router (inclusive erros no próprio root layout). O Next.js exige que
 * esse arquivo defina seu próprio <html>/<body> — não reaproveita o
 * layout.tsx normal porque o erro pode ter acontecido dentro dele.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
          textAlign: "center",
          color: "#1e293b",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Algo deu errado</h1>
        <p style={{ color: "#525252", margin: 0, maxWidth: "360px" }}>
          Encontramos um erro inesperado. Nossa equipe já foi notificada. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: "8px",
            borderRadius: "10px",
            background: "#1e293b",
            color: "#fff",
            padding: "10px 18px",
            fontWeight: 500,
            cursor: "pointer",
            border: "none",
          }}
        >
          Recarregar página
        </button>
      </body>
    </html>
  );
}
