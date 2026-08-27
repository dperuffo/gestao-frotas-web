import Link from "next/link";

// Fase 27.35 — achado real: cliente novo não entendia por onde começar.
// Achava que precisava "carregar" postos revendedores, cadastrar veículos e
// motoristas ANTES de conseguir usar a Roteirização/Postos — o que não é
// verdade: consulta de rota e de posto/UF já funciona com a base pública de
// preços ANP, mesmo sem nenhum cadastro. Este card resume, logo na
// primeira tela que o usuário vê (Dashboard), o que É de fato necessário
// pra operar (veículos e motoristas — usados em abastecimentos, manutenção,
// centro de custo etc.) e deixa explícito que carregar a rede própria de
// postos é OPCIONAL. Some sozinho assim que veículos e motoristas já
// estiverem cadastrados (não incomoda quem já está operando).
// Fase UX-Navegacao (27/08/2026, pedido do Daniel: "ajustes da experiência
// do usuário e navegação", item do roadmap "onboarding guiado") — os 2
// passos abaixo (centro de custo e equipe) foram adicionados aos 3
// originais da Fase 27.35. Continuam OPCIONAIS de propósito, igual postos
// próprios: nenhum dos dois bloqueia o cliente de operar (abastecimento,
// roteirização etc. funcionam sem centro de custo nem equipe extra), só
// aprofundam o uso da plataforma pra quem quer ratear despesas por centro
// de custo ou dividir o acesso com outras pessoas.
export function PrimeirosPassos({
  totalVeiculos,
  totalMotoristas,
  totalPostosProprios,
  totalCentrosCusto,
  totalVinculosEquipe,
}: {
  totalVeiculos: number;
  totalMotoristas: number;
  totalPostosProprios: number;
  totalCentrosCusto?: number;
  totalVinculosEquipe?: number;
}) {
  const veiculosOk = totalVeiculos > 0;
  const motoristasOk = totalMotoristas > 0;

  // Essenciais pra operação (abastecimento, manutenção, centro de custo
  // etc.) — postos próprios, centro de custo e equipe ficam de fora dessa
  // condição de saída porque são opcionais (ver comentário acima).
  if (veiculosOk && motoristasOk) return null;

  return (
    <div className="mb-6 card border-frota-100 bg-frota-50/40 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">🚀 Primeiros passos na plataforma</h2>
      <p className="mb-3 text-xs text-slate-500">
        O essencial pra começar a operar. Você já pode consultar rotas e preços de combustível agora
        mesmo — não precisa esperar terminar esta lista.
      </p>
      <ul className="space-y-2">
        <PassoItem
          feito={veiculosOk}
          titulo="Cadastre os veículos da frota"
          descricao={
            veiculosOk
              ? `${totalVeiculos} veículo(s) cadastrado(s).`
              : "Necessário pra registrar abastecimentos, manutenção e custos por veículo."
          }
          href="/veiculos/novo"
          textoAcao="Cadastrar veículo"
        />
        <PassoItem
          feito={motoristasOk}
          titulo="Cadastre os motoristas"
          descricao={
            motoristasOk
              ? `${totalMotoristas} motorista(s) cadastrado(s).`
              : "Necessário pra vincular abastecimentos e acompanhar CNH/desempenho por motorista."
          }
          href="/motoristas/novo"
          textoAcao="Cadastrar motorista"
        />
        <PassoItem
          feito={totalPostosProprios > 0}
          opcional
          titulo="Carregue os postos revendedores do seu relacionamento"
          descricao={
            totalPostosProprios > 0
              ? `${totalPostosProprios} posto(s) próprio(s) cadastrado(s).`
              : "Opcional: sem isso, Roteirização e consulta de Postos já funcionam com a base pública de preços ANP (por UF/município). Carregar sua rede própria traz os preços realmente negociados com seus postos."
          }
          href="/postos/importar"
          textoAcao="Importar planilha de postos"
        />
        <PassoItem
          feito={(totalCentrosCusto ?? 0) > 0}
          opcional
          titulo="Configure centros de custo"
          descricao={
            (totalCentrosCusto ?? 0) > 0
              ? `${totalCentrosCusto} centro(s) de custo cadastrado(s).`
              : "Opcional: agrupa veículos por filial, obra ou setor pra ratear despesas nos relatórios financeiros."
          }
          href="/centros-custo"
          textoAcao="Configurar centros de custo"
        />
        <PassoItem
          feito={(totalVinculosEquipe ?? 0) > 1}
          opcional
          titulo="Convide sua equipe"
          descricao={
            (totalVinculosEquipe ?? 0) > 1
              ? `${totalVinculosEquipe} pessoa(s) com acesso à conta.`
              : "Opcional: divida o acesso com outros gestores, cada um com sua própria permissão."
          }
          href="/minha-equipe"
          textoAcao="Convidar pessoa"
        />
      </ul>
    </div>
  );
}

function PassoItem({
  feito,
  opcional,
  titulo,
  descricao,
  href,
  textoAcao,
}: {
  feito: boolean;
  opcional?: boolean;
  titulo: string;
  descricao: string;
  href: string;
  textoAcao: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg bg-white p-3">
      <span className={`mt-0.5 text-lg ${feito ? "" : "opacity-40"}`} aria-hidden>
        {feito ? "✅" : "⬜"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">
          {titulo} {opcional && <span className="font-normal text-slate-400">(opcional)</span>}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>
      </div>
      {!feito && (
        <Link href={href} className="btn-secondary shrink-0 whitespace-nowrap text-xs">
          {textoAcao}
        </Link>
      )}
    </li>
  );
}
