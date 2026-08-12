import type { ApiExterna } from "@/lib/uso-api-externa";

// Mapeamento puro de percentual → nível/cor, sem acesso a banco/env — por
// isso NÃO tem `import "server-only"` (diferente de uso-api-externa.ts):
// precisa ser importável tanto pela página server-side (/admin/uso-google)
// quanto pelo banner client-side do AdminShell, que só recebe o resumo já
// calculado via fetch em /api/admin/uso-google.

export type NivelAlerta = "ok" | "atencao" | "critico";

export function nivelPorPercentual(percentual: number, configurada: boolean): NivelAlerta {
  if (!configurada) return "ok";
  if (percentual >= 90) return "critico";
  if (percentual >= 70) return "atencao";
  return "ok";
}

export const COR_BADGE: Record<NivelAlerta, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400",
  atencao: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
  critico: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

export const COR_BARRA: Record<NivelAlerta, string> = {
  ok: "bg-green-500",
  atencao: "bg-amber-500",
  critico: "bg-red-500",
};

export const LABEL_NIVEL: Record<NivelAlerta, string> = {
  ok: "Tranquilo",
  atencao: "Atenção",
  critico: "Perto do limite",
};

/** Usado pelo banner do AdminShell — pega o pior nível entre todas as APIs
 * configuradas, pra decidir se mostra aviso e com que cor. */
export function piorNivel(itens: Array<{ api: ApiExterna; percentual: number; configurada: boolean }>): NivelAlerta {
  let pior: NivelAlerta = "ok";
  for (const item of itens) {
    const nivel = nivelPorPercentual(item.percentual, item.configurada);
    if (nivel === "critico") return "critico";
    if (nivel === "atencao") pior = "atencao";
  }
  return pior;
}
