"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X, ChevronLeft, ChevronRight } from "lucide-react";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";

export type GuideStep = {
  /** `id` do elemento na tela a ser destacado. Se não existir no momento
   * (ex: card de um estado vazio, ou seção que só aparece depois de uma
   * escolha), o passo cai automaticamente pro modo "sem destaque": a tela
   * inteira escurece e o texto some centralizado, sem quebrar o tour. */
  targetId?: string;
  title: string;
  text: string;
};

const PAD = 8;
const GAP = 16;
const MARGIN = 12;

/**
 * Botão "Instruções de Uso" + tour guiado passo a passo pelos elementos da
 * tela. Cada `GuideStep` aponta pro `id` de um elemento já existente na
 * página (nenhum elemento precisa saber que está sendo usado num tour —
 * basta ter um `id`), então isso funciona sobre a UI real, não uma cópia
 * dela: o que a pessoa vê destacado é literalmente o botão/seção que ela
 * vai usar, inclusive clicável durante o tour (só a área ao redor fica
 * bloqueada, pra evitar toque acidental em outra coisa).
 */
export function GuideTour({ steps, label = "Instruções de uso" }: { steps: GuideStep[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, steps.length]);

  if (steps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        className="inline-flex w-auto shrink-0 items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange-soft px-3.5 py-1.5 text-xs font-medium text-brand-orange-dark transition hover:bg-brand-orange-light dark:border-brand-orange/40 dark:bg-brand-orange/10 dark:text-brand-orange-light dark:hover:bg-brand-orange/20"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>

      {mounted && open
        ? createPortal(
            <TourOverlay
              steps={steps}
              index={index}
              onNext={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
              onPrev={() => setIndex((i) => Math.max(0, i - 1))}
              onClose={() => setOpen(false)}
            />,
            document.body
          )
        : null}
    </>
  );
}

function TourOverlay({
  steps,
  index,
  onNext,
  onPrev,
  onClose,
}: {
  steps: GuideStep[];
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const step = steps[index];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);

  // Localiza (e rola até) o elemento-alvo do passo atual. Se não existir ou
  // estiver escondido (ex: seção condicional que só aparece depois de outra
  // ação), cai pro modo sem destaque em vez de travar o tour.
  useEffect(() => {
    let cancelado = false;
    function medir() {
      if (cancelado) return;
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const el = step.targetId ? document.getElementById(step.targetId) : null;
      const visivel = el && el.offsetWidth > 0 && el.offsetHeight > 0;
      if (visivel) {
        el!.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          if (!cancelado) setRect(el!.getBoundingClientRect());
        }, 260);
      } else {
        setRect(null);
      }
    }
    medir();
    window.addEventListener("resize", medir);
    return () => {
      cancelado = true;
      window.removeEventListener("resize", medir);
    };
  }, [step.targetId, index]);

  // Reposiciona o cartão de instrução perto do elemento destacado (embaixo
  // se couber, senão em cima), sempre dentro da tela — mede o tamanho real
  // do cartão depois de renderizado, pra funcionar com qualquer texto e em
  // qualquer largura de tela (celular incluso).
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    function reposicionar() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = card!.offsetWidth;
      const ch = card!.offsetHeight;

      let top: number;
      let left: number;

      if (rect) {
        const espacoAbaixo = vh - rect.bottom;
        const espacoAcima = rect.top;
        top = espacoAbaixo >= ch + GAP || espacoAbaixo >= espacoAcima ? rect.bottom + GAP : rect.top - GAP - ch;
        left = rect.left;
      } else {
        top = (vh - ch) / 2;
        left = (vw - cw) / 2;
      }

      top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - ch - MARGIN));
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - cw - MARGIN));
      setCardPos({ top, left });
    }

    reposicionar();
    window.addEventListener("resize", reposicionar);
    return () => window.removeEventListener("resize", reposicionar);
  }, [rect, index]);

  const vw = viewport.w;
  const vh = viewport.h;

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Instruções de uso">
      {rect ? (
        <>
          {/* 4 tiras escurecem e bloqueiam clique ao redor do elemento em
              destaque; o próprio elemento (dentro do anel laranja) fica sem
              nenhuma camada por cima, então continua clicável normalmente
              durante o tour. */}
          <div className="fixed bg-brand-navy/70" style={{ top: 0, left: 0, width: vw, height: Math.max(0, rect.top - PAD) }} />
          <div
            className="fixed bg-brand-navy/70"
            style={{ top: rect.bottom + PAD, left: 0, width: vw, height: Math.max(0, vh - rect.bottom - PAD) }}
          />
          <div
            className="fixed bg-brand-navy/70"
            style={{ top: Math.max(0, rect.top - PAD), left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }}
          />
          <div
            className="fixed bg-brand-navy/70"
            style={{
              top: Math.max(0, rect.top - PAD),
              left: rect.right + PAD,
              width: Math.max(0, vw - rect.right - PAD),
              height: rect.height + PAD * 2,
            }}
          />
          <div
            className="fixed rounded-xl ring-4 ring-brand-orange"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-brand-navy/70" />
      )}

      <div
        ref={cardRef}
        className="fixed z-[210] w-[calc(100vw-24px)] max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : { top: -9999, left: -9999 }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-brand-orange-dark dark:text-brand-orange-light">
            Passo {index + 1} de {steps.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar instruções"
            className="text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <h3 className="mt-1 font-semibold text-brand-navy dark:text-white">{step.title}</h3>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">{step.text}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Pular
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={onPrev} className={secondaryButtonClass + " w-auto px-3 py-1.5 text-sm"} aria-label="Passo anterior">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={index === steps.length - 1 ? onClose : onNext}
              className={primaryButtonClass + " w-auto px-4 py-1.5 text-sm"}
            >
              {index === steps.length - 1 ? (
                "Concluir"
              ) : (
                <span className="inline-flex items-center gap-1">
                  Próximo
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
