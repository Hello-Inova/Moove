import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export const metadata = {
  title: "Política de Privacidade — Moove",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <Link href="/" className="inline-block">
        <Logo height={22} />
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-brand-navy dark:text-white">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Como o Moove trata dados pessoais, de localização e de crianças, em conformidade com a
        Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <div className="mt-8 space-y-6 text-neutral-800 dark:text-neutral-300 [&_h2]:mb-2 [&_h2]:mt-0 [&_p]:leading-relaxed [&_ul]:leading-relaxed dark:text-neutral-200">
        <section>
          <h2 className="text-xl font-semibold">1. Quais dados coletamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Dados cadastrais de motoristas e responsáveis: nome, e-mail, telefone e senha (armazenada com hash, nunca em texto puro).</li>
            <li>Dados do veículo do motorista: placa, modelo e documentos enviados.</li>
            <li>
              Localização geográfica em tempo real do motorista (latitude/longitude), coletada via
              GPS do navegador enquanto ele optar por compartilhar durante a rota.
            </li>
            <li>Metadados de vínculo entre responsáveis e motoristas (convites, datas, status).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Dados relacionados a crianças</h2>
          <p>
            O Moove não coleta diretamente dados cadastrais de crianças. A localização
            compartilhada refere-se ao veículo/motorista, não a um aluno específico. Ainda assim,
            tratamos essa informação com o mesmo cuidado dedicado a dados sensíveis, já que
            permite inferir a rota de transporte escolar de menores de idade.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Consentimento</h2>
          <p>
            No cadastro, tanto o motorista quanto o responsável precisam aceitar explicitamente
            esta Política de Privacidade antes de criar a conta. O motorista, adicionalmente,
            precisa habilitar manualmente o compartilhamento de localização a cada sessão de uso —
            nenhuma localização é coletada sem essa ação explícita.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Quem acessa a localização</h2>
          <p>
            A localização de um motorista só é exibida a um responsável quando existe um vínculo
            ativo entre os dois, criado a partir de um código de convite gerado pelo próprio
            motorista. O motorista pode revogar esse vínculo a qualquer momento, bloqueando o
            acesso imediatamente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Retenção e exclusão</h2>
          <p>
            Os dados são mantidos enquanto a conta estiver ativa. O usuário pode solicitar a
            exclusão de sua conta e dos dados associados a qualquer momento, respeitadas
            obrigações legais de guarda de registros (ex: histórico de cobranças).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Compartilhamento com terceiros</h2>
          <p>
            Não vendemos dados pessoais. Documentos do veículo são armazenados em um provedor de
            armazenamento compatível com S3, sob contrato, exclusivamente para fins de guarda dos
            arquivos enviados pelo motorista.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Seus direitos</h2>
          <p>
            Nos termos da LGPD, você pode solicitar acesso, correção, portabilidade ou exclusão
            dos seus dados pessoais a qualquer momento, entrando em contato pelos canais
            disponibilizados no aplicativo.
          </p>
        </section>
      </div>
    </main>
  );
}
