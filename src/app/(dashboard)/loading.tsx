// Fase 27.40 — achado real (investigando a lentidão de navegação reportada
// pelo Daniel): nenhuma tela do dashboard tinha um `loading.tsx`. Sem esse
// arquivo, o Next.js não tem nada pra mostrar enquanto a página de destino
// busca os dados dela — a tela ANTERIOR fica congelada na troca até tudo
// terminar de carregar, o que dá a sensação de trava/lentidão mesmo quando a
// consulta em si é rápida. Este arquivo cobre toda rota dentro de
// `(dashboard)/**` (menos o próprio layout, que o Next não envolve em
// Suspense do mesmo segmento — isso é limitação do framework, não deste
// arquivo): assim que o usuário clica num link do menu, este esqueleto
// aparece na hora, e o conteúdo real entra por cima assim que a página
// termina de buscar os dados dela.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Carregando conteúdo da página">
      <div className="space-y-2">
        <div className="h-6 w-56 rounded bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-100" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-20 bg-slate-100" />
        ))}
      </div>

      <div className="card h-64 bg-slate-100" />

      <div className="card space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
