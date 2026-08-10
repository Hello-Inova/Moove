# Instruções do projeto Moove

## Responsividade mobile — regra permanente

Sempre que criar, editar ou ajustar qualquer componente/página de layout
(sidebar, cards, formulários, tabelas, grids, modais, mapas, etc.), aplicar
também os ajustes de responsividade para telas pequenas (celular) na mesma
mudança — não deixar para depois nem tratar como tarefa separada.

Convenções já usadas no projeto:
- Tailwind mobile-first: estilos sem prefixo = mobile; `sm:`/`md:`/`lg:` para
  telas maiores.
- Grids que viram colunas únicas no mobile: `grid-cols-1 sm:grid-cols-2` (ou
  `sm:grid-cols-3`), nunca `grid-cols-2`/`grid-cols-3` fixo.
- Linhas com `flex` que podem estourar em telas estreitas: usar `flex-wrap`
  e `gap` em vez de `justify-between` puro sem quebra.
- Sidebar (`AppHeader`) já segue o padrão: `hidden md:block` pra versão fixa
  desktop + gaveta deslizante no mobile — reaproveitar esse padrão em vez de
  inventar um novo pra cada tela.
- Tabelas/listas longas: preferir cards empilháveis a `<table>` sem wrapper
  de scroll horizontal.
- Botões de ação em linha (editar/excluir/etc.) devem quebrar linha
  (`flex-wrap`) em vez de forçar scroll horizontal no mobile.
- Testar sempre pelo menos em ~360–390px de largura (celular comum) antes de
  considerar o ajuste concluído.
