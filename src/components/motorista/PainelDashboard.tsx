"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  School,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Route as RouteIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  MessageCircle,
  X,
} from "lucide-react";

import { secondaryButtonClass } from "@/components/ui/form-elements";
import { formatarBRL } from "@/lib/subscription/plans";
import { linkWhatsApp } from "@/lib/whatsapp";
import type {
  AlunoResumo,
  EscolaResumo,
  KmDia,
  MensalidadeResumo,
  PainelData,
} from "@/lib/painel/dashboard-data";

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Todo valor "mês de referência" (o `Date` que representa um mês inteiro,
 * não um instante) é construído com `Date.UTC` e lido com os getters `UTC*`
 * — tanto aqui quanto em `dashboard-data.ts`. Se misturasse construção/
 * leitura local com UTC, quem estivesse num fuso negativo (Brasil, UTC-3)
 * veria sempre o mês anterior: meia-noite UTC do dia 1 vira 21h do dia 31
 * do mês anterior em horário local, e ler isso com `getMonth()` local
 * devolve o mês errado. Foi exatamente esse bug que fazia o seletor mostrar
 * um mês atrás do selecionado.
 */
function formatarMesAno(data: Date): string {
  return `${MESES_PT[data.getUTCMonth()]} de ${data.getUTCFullYear()}`;
}

function formatarMesParam(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Data-calendário sem componente de hora (vencimento, dia de km rodado) —
 * sempre formatada em UTC, pelo mesmo motivo do comentário acima: esses
 * valores chegam do servidor como "meia-noite UTC do dia X". */
function formatarDataCalendario(data: Date): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Data de um instante de verdade (ex.: quando a mensalidade foi paga) —
 * aqui faz sentido mostrar no horário local de quem está vendo a tela. */
function formatarData(data: Date): string {
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type CardId =
  | "alunos"
  | "escolas"
  | "entrada"
  | "recebidos"
  | "pendentes"
  | "atrasados"
  | "km";

type CardConfig = {
  id: CardId;
  label: string;
  valor: string;
  sublinha?: string;
  icon: ReactNode;
  from: string;
  to: string;
  iconBg: string;
};

/**
 * Painel (dashboard financeiro/operacional do motorista) — 7 cards
 * resumindo o mês selecionado (`dados` já vem pronto do servidor,
 * recalculado a cada troca de mês via querystring `?mes=YYYY-MM`, ver
 * page.tsx). "Km rodados" é a única exceção: é sempre uma janela móvel dos
 * últimos 30 dias, independente do mês filtrado (ver comentário em
 * dashboard-data.ts).
 */
export function PainelDashboard({
  dados,
  motoristaChavePix,
}: {
  dados: PainelData;
  motoristaChavePix: string | null;
}) {
  const router = useRouter();
  const [cardAberto, setCardAberto] = useState<CardId | null>(null);

  const mesAtualParam = formatarMesParam(dados.mesReferencia);
  const isMesAtual = useMemo(() => {
    const hoje = new Date();
    const hojeParam = formatarMesParam(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1)));
    return mesAtualParam === hojeParam;
  }, [mesAtualParam]);

  function irParaMes(novoMes: Date) {
    router.push(`/motorista/painel?mes=${formatarMesParam(novoMes)}`);
  }

  function mesAdjacente(delta: number) {
    const totalMeses = dados.mesReferencia.getUTCFullYear() * 12 + dados.mesReferencia.getUTCMonth() + delta;
    const ano = Math.floor(totalMeses / 12);
    const mes = totalMeses % 12;
    return new Date(Date.UTC(ano, mes, 1));
  }

  // Últimos 12 meses (incluindo o atual) pro seletor — suficiente pra
  // navegar o histórico sem virar uma lista infinita. "Hoje" é lido em
  // horário local de propósito aqui (é a única leitura do calendário real
  // de quem está usando o app) — o resultado já nasce ancorado em UTC pros
  // meses ficarem consistentes com o resto do componente.
  const opcoesMes = useMemo(() => {
    const hoje = new Date();
    const totalMesesHoje = hoje.getFullYear() * 12 + hoje.getMonth();
    const lista: Date[] = [];
    for (let i = 0; i < 12; i++) {
      const total = totalMesesHoje - i;
      const ano = Math.floor(total / 12);
      const mes = total % 12;
      lista.push(new Date(Date.UTC(ano, mes, 1)));
    }
    return lista;
  }, []);

  const cards: CardConfig[] = [
    {
      id: "alunos",
      label: "Alunos vinculados",
      valor: String(dados.alunosVinculados.total),
      icon: <Users className="h-5 w-5" aria-hidden="true" />,
      from: "from-blue-500",
      to: "to-blue-600",
      iconBg: "bg-blue-400/30",
    },
    {
      id: "escolas",
      label: "Escolas vinculadas",
      valor: String(dados.escolasVinculadas.total),
      icon: <School className="h-5 w-5" aria-hidden="true" />,
      from: "from-indigo-500",
      to: "to-indigo-600",
      iconBg: "bg-indigo-400/30",
    },
    {
      id: "entrada",
      label: "Entrada prevista",
      valor: formatarBRL(dados.entradaPrevista.total),
      sublinha: "Soma das mensalidades do mês",
      icon: <Wallet className="h-5 w-5" aria-hidden="true" />,
      from: "from-cyan-500",
      to: "to-cyan-600",
      iconBg: "bg-cyan-400/30",
    },
    {
      id: "recebidos",
      label: "Pagamentos recebidos",
      valor: formatarBRL(dados.pagamentosRecebidos.total),
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
      from: "from-emerald-500",
      to: "to-emerald-600",
      iconBg: "bg-emerald-400/30",
    },
    {
      id: "pendentes",
      label: "Pagamentos pendentes",
      valor: formatarBRL(dados.pagamentosPendentes.total),
      icon: <Clock className="h-5 w-5" aria-hidden="true" />,
      from: "from-amber-500",
      to: "to-amber-600",
      iconBg: "bg-amber-400/30",
    },
    {
      id: "atrasados",
      label: "Pagamentos atrasados",
      valor: formatarBRL(dados.pagamentosAtrasados.total),
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
      from: "from-red-500",
      to: "to-red-600",
      iconBg: "bg-red-400/30",
    },
    {
      id: "km",
      label: "Km rodados",
      valor: `${dados.kmUltimos30Dias.total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`,
      sublinha: "Últimos 30 dias",
      icon: <RouteIcon className="h-5 w-5" aria-hidden="true" />,
      from: "from-orange-500",
      to: "to-orange-600",
      iconBg: "bg-orange-400/30",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Painel</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 sm:text-base">
            Resumo financeiro e operacional
          </p>
        </div>
      </div>

      {/* Filtro de mês — compacto, com setas pra navegar rápido e um menu
          próprio (não um <select> nativo, que herda a aparência crua do
          SO/navegador e destoa do resto da tela) pra pular direto pra
          qualquer um dos últimos 12 meses. */}
      <div className="flex items-center justify-between gap-1 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => irParaMes(mesAdjacente(-1))}
          aria-label="Mês anterior"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex flex-1 justify-center">
          <SeletorMes mesAtualParam={mesAtualParam} opcoesMes={opcoesMes} onSelecionar={irParaMes} />
        </div>

        <button
          type="button"
          onClick={() => irParaMes(mesAdjacente(1))}
          aria-label="Próximo mês"
          disabled={isMesAtual}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Grid compacto mesmo no celular (2 colunas) — pedido explícito pra
          não virar uma tela enorme rolando 7 cards empilhados. Valor
          quebra linha em vez de truncar (evita cortar "R$ 1.234,56" no meio
          num card estreito de ~170px em telas de ~360-390px). */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setCardAberto(card.id)}
            style={{ ["--delay" as string]: `${i * 60}ms` }}
            className={`painel-card-in flex min-h-[104px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${card.from} ${card.to} p-3 text-left text-white shadow-sm transition hover:shadow-md active:scale-[0.98] sm:min-h-[124px] sm:p-4`}
          >
            <div className={`mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${card.iconBg} sm:h-10 sm:w-10`}>
              {card.icon}
            </div>
            <p className="text-[11px] font-medium leading-snug text-white/85 sm:text-xs">{card.label}</p>
            <p className="mt-auto break-words pt-1 text-base font-bold leading-tight sm:text-2xl">{card.valor}</p>
            {card.sublinha && <p className="mt-0.5 text-[10px] text-white/75 sm:text-xs">{card.sublinha}</p>}
          </button>
        ))}
      </div>

      {cardAberto && (
        <DetalheModal
          cardId={cardAberto}
          dados={dados}
          motoristaChavePix={motoristaChavePix}
          onClose={() => setCardAberto(null)}
        />
      )}
    </div>
  );
}

/** Botão + painel próprio pro seletor de mês, no lugar de um `<select>`
 * nativo — dá pra estilizar igual ao resto do app (cores, dark mode,
 * cantos arredondados) em vez de herdar o popover cru do SO. Fecha ao
 * escolher um mês ou ao clicar fora (mesmo padrão de backdrop já usado no
 * DetalheModal logo abaixo). */
function SeletorMes({
  mesAtualParam,
  opcoesMes,
  onSelecionar,
}: {
  mesAtualParam: string;
  opcoesMes: Date[];
  onSelecionar: (mes: Date) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const mesAtual = opcoesMes.find((mes) => formatarMesParam(mes) === mesAtualParam);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800 sm:gap-2 sm:text-base"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <span className="whitespace-nowrap">{mesAtual ? formatarMesAno(mesAtual) : "Selecione o mês"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-[1900]" onClick={() => setAberto(false)} />
          <div
            role="listbox"
            aria-label="Selecionar mês"
            className="absolute left-1/2 top-full z-[1950] mt-2 max-h-72 w-48 -translate-x-1/2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          >
            {opcoesMes.map((mes) => {
              const valor = formatarMesParam(mes);
              const selecionado = valor === mesAtualParam;
              return (
                <button
                  key={valor}
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => {
                    onSelecionar(mes);
                    setAberto(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selecionado
                      ? "bg-brand-navy font-medium text-white"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  {formatarMesAno(mes)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DetalheModal({
  cardId,
  dados,
  motoristaChavePix,
  onClose,
}: {
  cardId: CardId;
  dados: PainelData;
  motoristaChavePix: string | null;
  onClose: () => void;
}) {
  const config: Record<CardId, { titulo: string; corpo: ReactNode }> = {
    alunos: { titulo: "Alunos vinculados", corpo: <ListaAlunos itens={dados.alunosVinculados.detalhes} /> },
    escolas: { titulo: "Escolas vinculadas", corpo: <ListaEscolas itens={dados.escolasVinculadas.detalhes} /> },
    entrada: {
      titulo: "Entrada prevista",
      corpo: <ListaMensalidades itens={dados.entradaPrevista.detalhes} mostrarStatus />,
    },
    recebidos: {
      titulo: "Pagamentos recebidos",
      corpo: <ListaMensalidades itens={dados.pagamentosRecebidos.detalhes} mostrarPagoEm />,
    },
    pendentes: {
      titulo: "Pagamentos pendentes",
      corpo: <ListaMensalidades itens={dados.pagamentosPendentes.detalhes} mostrarVencimento />,
    },
    atrasados: {
      titulo: "Pagamentos atrasados",
      corpo: (
        <ListaMensalidades
          itens={dados.pagamentosAtrasados.detalhes}
          mostrarVencimento
          destaqueAtraso
          motoristaChavePix={motoristaChavePix}
        />
      ),
    },
    km: { titulo: "Km rodados — últimos 30 dias", corpo: <ListaKm itens={dados.kmUltimos30Dias.detalhes} /> },
  };

  const { titulo, corpo } = config[cardId];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="painel-detalhe-titulo"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900 sm:max-h-[75vh] sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <h2 id="painel-detalhe-titulo" className="text-base font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[calc(80vh-56px)] overflow-y-auto p-4 sm:max-h-[calc(75vh-56px)]">{corpo}</div>
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-700 sm:hidden">
          <button type="button" onClick={onClose} className={secondaryButtonClass + " w-full"}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">{texto}</p>;
}

function ListaAlunos({ itens }: { itens: AlunoResumo[] }) {
  if (itens.length === 0) return <EstadoVazio texto="Nenhum aluno vinculado nesse mês." />;
  return (
    <ul className="space-y-2">
      {itens.map((a) => (
        <li key={a.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
          <p className="font-medium">{a.nome}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{a.escolaNome ?? "Sem escola definida"}</p>
        </li>
      ))}
    </ul>
  );
}

function ListaEscolas({ itens }: { itens: EscolaResumo[] }) {
  if (itens.length === 0) return <EstadoVazio texto="Nenhuma escola com aluno vinculado nesse mês." />;
  return (
    <ul className="space-y-2">
      {itens.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"
        >
          <p className="font-medium">{e.nome}</p>
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {e.alunos} {e.alunos === 1 ? "aluno" : "alunos"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Mensagem de cobrança pro WhatsApp do responsável — inclui a chave PIX do
 * motorista quando configurada (perfil → Vínculos); sem ela, manda a
 * cobrança mesmo assim, só sem a linha do PIX. */
function mensagemCobranca(m: MensalidadeResumo, chavePix: string | null): string {
  const linhas = [
    `Olá, ${m.responsavelNome}! Aqui é o motorista escolar de ${m.alunoNome}.`,
    `A mensalidade do transporte de ${formatarMesAno(m.mesReferencia)} (${formatarBRL(m.valor)}) venceu em ${formatarDataCalendario(
      m.vencimento
    )} e ainda está em aberto.`,
    chavePix ? `Você pode pagar via PIX: ${chavePix}` : null,
    "Qualquer dúvida, me chama por aqui!",
  ].filter((linha): linha is string => Boolean(linha));
  return linhas.join("\n\n");
}

function ListaMensalidades({
  itens,
  mostrarStatus,
  mostrarPagoEm,
  mostrarVencimento,
  destaqueAtraso,
  motoristaChavePix,
}: {
  itens: MensalidadeResumo[];
  mostrarStatus?: boolean;
  mostrarPagoEm?: boolean;
  mostrarVencimento?: boolean;
  destaqueAtraso?: boolean;
  motoristaChavePix?: string | null;
}) {
  if (itens.length === 0) return <EstadoVazio texto="Nada por aqui nesse mês." />;

  const rotuloStatus: Record<MensalidadeResumo["status"], string> = {
    PENDENTE: "Pendente",
    PAGO: "Pago",
    CANCELADO: "Cancelado",
  };

  return (
    <ul className="space-y-2">
      {itens.map((m) => {
        const cobrancaHref = destaqueAtraso
          ? linkWhatsApp(m.responsavelTelefone, mensagemCobranca(m, motoristaChavePix ?? null))
          : null;

        return (
          <li
            key={m.id}
            className={`rounded-xl border p-3 ${
              destaqueAtraso
                ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.alunoNome}</p>
                {m.escolaNome && (
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{m.escolaNome}</p>
                )}
              </div>
              <p className="shrink-0 font-semibold">{formatarBRL(m.valor)}</p>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {mostrarStatus && <span>{rotuloStatus[m.status]}</span>}
              {mostrarVencimento && <span>Vence em {formatarDataCalendario(m.vencimento)}</span>}
              {mostrarPagoEm && m.pagoEm && <span>Pago em {formatarData(m.pagoEm)}</span>}
            </div>
            {destaqueAtraso &&
              (cobrancaHref ? (
                <a
                  href={cobrancaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Cobrar
                </a>
              ) : (
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  Sem telefone do responsável cadastrado pra cobrar por WhatsApp.
                </p>
              ))}
          </li>
        );
      })}
    </ul>
  );
}

function ListaKm({ itens }: { itens: KmDia[] }) {
  if (itens.length === 0) return <EstadoVazio texto="Nenhuma rota encerrada nos últimos 30 dias." />;
  return (
    <ul className="space-y-1.5">
      {[...itens].reverse().map((d) => (
        <li
          key={d.data.toString()}
          className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-700"
        >
          <span className="text-sm">{formatarDataCalendario(d.data)}</span>
          <span className="text-sm font-medium">{d.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km</span>
        </li>
      ))}
    </ul>
  );
}
