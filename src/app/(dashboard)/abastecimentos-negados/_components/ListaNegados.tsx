"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import { decidirAbastecimentoNegadoAcao, type AbastecimentoNegado } from "../actions";

function formatarCpf(cpf: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : (cpf ?? "—");
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function restante(expiraEm: string, agora: number) {
  const seg = Math.max(0, Math.floor((new Date(expiraEm).getTime() - agora) / 1000));
  return { seg, texto: `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}` };
}

const ROTULO_SITUACAO: Record<AbastecimentoNegado["situacao"], string> = {
  pendente: "Aguardando decisão",
  liberado: "Liberado",
  recusado: "Recusado",
  expirado: "Expirado",
};

const COR_SITUACAO: Record<AbastecimentoNegado["situacao"], string> = {
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  liberado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  recusado: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  expirado: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function Cartao({ item, agora }: { item: AbastecimentoNegado; agora: number }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const tempo = restante(item.otp_expira_em, agora);
  const vencido = item.situacao === "pendente" && tempo.seg === 0;

  function decidir(decisao: "liberado" | "recusado") {
    setErro(null);
    startTransition(async () => {
      const r = await decidirAbastecimentoNegadoAcao(item.id, decisao, justificativa);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Código {item.codigo_abastecimento}</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {item.placa} — {item.motorista_nome}
          </p>
          <p className="text-xs text-slate-500">CPF {formatarCpf(item.motorista_cpf)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_SITUACAO[item.situacao]}`}>
          {ROTULO_SITUACAO[item.situacao]}
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        {item.posto_nome ?? "Posto"} · {formatarData(item.criado_em)}
        {item.valor_total_combustivel != null &&
          ` · ${item.combustivel ?? ""} ${item.litros ?? ""} L · R$ ${Number(item.valor_total_combustivel).toFixed(2)}`}
      </p>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
          <ShieldAlert className="h-4 w-4" /> Regras impactadas
        </p>
        <ul className="space-y-1.5">
          {(item.regras_violadas ?? []).map((v, i) => (
            <li key={`${v.codigo}-${i}`} className="rounded-lg bg-red-50 px-3 py-2 text-sm dark:bg-red-950/40">
              <span className="font-medium text-red-700 dark:text-red-300">{v.titulo}</span>
              <span className="block text-slate-600 dark:text-slate-300">{v.detalhe}</span>
            </li>
          ))}
        </ul>
      </div>

      {item.situacao === "pendente" && !vencido && (
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <p className="flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-200">
            <Clock className="h-4 w-4" /> Validade do pedido: {tempo.texto} restantes
          </p>
          <textarea
            className="input min-h-[60px]"
            placeholder="Justificativa (obrigatória para liberar)"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={pendente} onClick={() => decidir("liberado")}>
              Liberar abastecimento
            </button>
            <button className="btn-secondary" disabled={pendente} onClick={() => decidir("recusado")}>
              Manter negado
            </button>
          </div>
        </div>
      )}

      {(item.situacao === "expirado" || vencido) && (
        <p className="text-sm text-slate-500">O prazo deste pedido expirou — não é mais possível liberar.</p>
      )}

      {item.liberacao_decisao && (
        <p className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          {item.liberacao_decisao === "liberado" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          )}
          <span>
            {item.liberacao_decisao === "liberado" ? "Liberado" : "Mantido negado"} por {item.liberacao_decidida_por}
            {item.liberacao_decidida_em && ` em ${formatarData(item.liberacao_decidida_em)}`}
            {item.liberacao_justificativa && ` — "${item.liberacao_justificativa}"`}
          </span>
        </p>
      )}
    </div>
  );
}

export function ListaNegados({ itens }: { itens: AbastecimentoNegado[] }) {
  const router = useRouter();
  const [agora, setAgora] = useState(() => Date.now());
  const temPendente = itens.some((i) => i.situacao === "pendente");

  useEffect(() => {
    if (!temPendente) return;
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    const recarga = window.setInterval(() => router.refresh(), 20_000);
    return () => {
      window.clearInterval(relogio);
      window.clearInterval(recarga);
    };
  }, [temPendente, router]);

  if (itens.length === 0) {
    return <p className="card p-8 text-center text-sm text-slate-500">Nenhum abastecimento negado nos últimos 30 dias.</p>;
  }
  return (
    <div className="space-y-3">
      {itens.map((i) => (
        <Cartao key={i.id} item={i} agora={agora} />
      ))}
    </div>
  );
}
