import "server-only";

export type VerificationPurpose = "CADASTRO" | "LOGIN";

export class EmailSendError extends Error {}

export interface Mailer {
  sendVerificationEmail(params: {
    to: string;
    nome: string;
    codigo: string;
    proposito: VerificationPurpose;
  }): Promise<void>;
}

const ASSUNTO: Record<VerificationPurpose, string> = {
  CADASTRO: "Confirme seu cadastro no Moove",
  LOGIN: "Seu código de acesso ao Moove",
};

function renderHtml(nome: string, codigo: string, proposito: VerificationPurpose): string {
  const titulo = proposito === "CADASTRO" ? "Confirme seu cadastro" : "Confirme seu login";
  const texto =
    proposito === "CADASTRO"
      ? "Use o código abaixo para confirmar seu e-mail e concluir o seu cadastro no Moove."
      : "Use o código abaixo para concluir o seu login no Moove.";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1e293b;">
      <p style="font-size:18px;font-weight:800;margin:0 0 24px;">Moove</p>
      <h1 style="font-size:20px;margin:0 0 12px;">${titulo}</h1>
      <p style="color:#404040;line-height:1.5;">Olá, ${nome.split(" ")[0]}. ${texto}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:10px;color:#1e293b;background:#f5f5f5;padding:16px 12px;border-radius:12px;text-align:center;margin:24px 0;">
        ${codigo}
      </p>
      <p style="color:#737373;font-size:13px;line-height:1.5;">
        Esse código expira em 10 minutos. Se você não solicitou isso, pode ignorar este e-mail.
      </p>
    </div>
  `;
}

class ResendMailer implements Mailer {
  async sendVerificationEmail({
    to,
    nome,
    codigo,
    proposito,
  }: Parameters<Mailer["sendVerificationEmail"]>[0]): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Moove <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: ASSUNTO[proposito],
        html: renderHtml(nome, codigo, proposito),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new EmailSendError(`Falha ao enviar e-mail de verificação (HTTP ${response.status}): ${body}`);
    }
  }
}

/**
 * Usado quando RESEND_API_KEY não está configurada (ex: ambiente local sem
 * conta no Resend ainda): em vez de falhar, imprime o código no log do
 * servidor para permitir testar o fluxo de ponta a ponta sem enviar e-mail
 * de verdade.
 */
class ConsoleMailer implements Mailer {
  async sendVerificationEmail({
    to,
    codigo,
    proposito,
  }: Parameters<Mailer["sendVerificationEmail"]>[0]): Promise<void> {
    console.log(`[email:dev] código de ${proposito} para ${to}: ${codigo}`);
  }
}

export function getMailer(): Mailer {
  return process.env.RESEND_API_KEY ? new ResendMailer() : new ConsoleMailer();
}

export async function sendVerificationEmail(
  params: Parameters<Mailer["sendVerificationEmail"]>[0]
): Promise<void> {
  return getMailer().sendVerificationEmail(params);
}
