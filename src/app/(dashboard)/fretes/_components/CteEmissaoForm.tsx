"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { cancelarCteAcao, cartaCorrecaoCteAcao, emitirCteAcao } from "../cteEmissaoActions";

// Fase P0.2 (plano FNI_Plano_Implementacao_P0.md) — "o coração do P0": emitir
// CT-e pela própria plataforma (caminho novo), ao lado do upload de XML já
// emitido em outro lugar (caminho antigo, em FretesDocumentos.tsx, que
// continua existindo sem mudanças). Provedor real ainda não existe (sem
// Focus NFe/certificado A1/cliente-piloto — decisão do Daniel na P0.1); tudo
// roda no provedor Simulador em homologação até lá.

export type ParceiroSalvo = {
  papel: "remetente" | "destinatario" | "tomador";
  cnpjCpf: string;
  razaoSocial: string;
  ie: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
};

type BlocoParceiro = {
  cnpjCpf: string;
  razaoSocial: string;
  ie: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

const BLOCO_VAZIO: BlocoParceiro = {
  cnpjCpf: "",
  razaoSocial: "",
  ie: "",
  logradouro: "",
  numero: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
};

const PAPEL_TOMADOR_LABEL: Record<string, string> = {
  remetente: "Remetente",
  expedidor: "Expedidor",
  recebedor: "Recebedor",
  destinatario: "Destinatário",
  outros: "Outros",
};

function CampoParceiro({
  titulo,
  prefixo,
  parceiros,
  valor,
  onChange,
}: {
  titulo: string;
  prefixo: string;
  parceiros: ParceiroSalvo[];
  valor: BlocoParceiro;
  onChange: (novo: BlocoParceiro) => void;
}) {
  function set<K extends keyof BlocoParceiro>(campo: K, v: string) {
    onChange({ ...valor, [campo]: v });
  }

  function reaproveitar(cnpjCpf: string) {
    const p = parceiros.find((x) => x.cnpjCpf === cnpjCpf);
    if (!p) return;
    onChange({
      cnpjCpf: p.cnpjCpf,
      razaoSocial: p.razaoSocial,
      ie: p.ie ?? "",
      logradouro: p.logradouro ?? "",
      numero: p.numero ?? "",
      bairro: p.bairro ?? "",
      municipio: p.municipio ?? "",
      uf: p.uf ?? "",
      cep: p.cep ?? "",
    });
  }

  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase text-slate-500">{titulo}</legend>
      {parceiros.length > 0 && (
        <select
          className="input mb-2 text-xs"
          defaultValue=""
          onChange={(e) => e.target.value && reaproveitar(e.target.value)}
        >
          <option value="">Reaproveitar cadastro salvo...</option>
          {parceiros.map((p) => (
            <option key={p.cnpjCpf} value={p.cnpjCpf}>
              {p.cnpjCpf} — {p.razaoSocial}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          name={`${prefixo}_cnpj_cpf`}
          value={valor.cnpjCpf}
          onChange={(e) => set("cnpjCpf", e.target.value)}
          placeholder="CNPJ/CPF"
          required
          className="input text-xs"
        />
        <input
          name={`${prefixo}_ie`}
          value={valor.ie}
          onChange={(e) => set("ie", e.target.value)}
          placeholder="Inscrição estadual"
          className="input text-xs"
        />
      </div>
      <input
        name={`${prefixo}_razao_social`}
        value={valor.razaoSocial}
        onChange={(e) => set("razaoSocial", e.target.value)}
        placeholder="Razão social"
        required
        className="input mt-2 w-full text-xs"
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <input
          name={`${prefixo}_logradouro`}
          value={valor.logradouro}
          onChange={(e) => set("logradouro", e.target.value)}
          placeholder="Logradouro"
          className="input col-span-2 text-xs"
        />
        <input
          name={`${prefixo}_numero`}
          value={valor.numero}
          onChange={(e) => set("numero", e.target.value)}
          placeholder="Número"
          className="input text-xs"
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <input
          name={`${prefixo}_bairro`}
          value={valor.bairro}
          onChange={(e) => set("bairro", e.target.value)}
          placeholder="Bairro"
          className="input text-xs"
        />
        <input
          name={`${prefixo}_municipio`}
          value={valor.municipio}
          onChange={(e) => set("municipio", e.target.value)}
          placeholder="Município"
          className="input text-xs"
        />
        <input
          name={`${prefixo}_uf`}
          value={valor.uf}
          onChange={(e) => set("uf", e.target.value.toUpperCase())}
          placeholder="UF"
          maxLength={2}
          className="input text-xs uppercase"
        />
        <input
          name={`${prefixo}_cep`}
          value={valor.cep}
          onChange={(e) => set("cep", e.target.value)}
          placeholder="CEP"
          className="input text-xs"
        />
      </div>
    </fieldset>
  );
}

export function CteEmissaoForm({
  freteId,
  empresaId,
  fiscalConfigurado,
  municipioInicioPadrao,
  ufInicioPadrao,
  municipioFimPadrao,
  ufFimPadrao,
  parceiros,
  chavesNfePadrao,
}: {
  freteId: string;
  empresaId: string;
  fiscalConfigurado: boolean;
  municipioInicioPadrao: string;
  ufInicioPadrao: string;
  municipioFimPadrao: string;
  ufFimPadrao: string;
  parceiros: ParceiroSalvo[];
  chavesNfePadrao: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [remetente, setRemetente] = useState(BLOCO_VAZIO);
  const [destinatario, setDestinatario] = useState(BLOCO_VAZIO);
  const [tomador, setTomador] = useState(BLOCO_VAZIO);
  const [tomadorPapel, setTomadorPapel] = useState("destinatario");
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!fiscalConfigurado) {
    return (
      <p className="text-xs text-slate-400">
        Configure os dados fiscais em <a href="/fiscal" className="text-frota-600 hover:underline">Fiscal</a> antes
        de emitir CT-e pela plataforma.
      </p>
    );
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-secondary w-full text-xs">
        + Emitir CT-e (novo)
      </button>
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await emitirCteAcao(freteId, empresaId, formData);
      if (resultado.erro) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
      } else if (resultado.sucesso) {
        setMensagem({ tipo: "sucesso", texto: `CT-e nº ${resultado.sucesso.numeroCte} autorizado.` });
        formRef.current?.reset();
        setRemetente(BLOCO_VAZIO);
        setDestinatario(BLOCO_VAZIO);
        setTomador(BLOCO_VAZIO);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Emitir CT-e</span>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-slate-400 hover:underline">
          fechar
        </button>
      </div>

      <CampoParceiro titulo="Remetente" prefixo="remetente" parceiros={parceiros.filter((p) => p.papel === "remetente")} valor={remetente} onChange={setRemetente} />
      <CampoParceiro titulo="Destinatário" prefixo="destinatario" parceiros={parceiros.filter((p) => p.papel === "destinatario")} valor={destinatario} onChange={setDestinatario} />

      <div>
        <CampoParceiro titulo="Tomador do serviço" prefixo="tomador" parceiros={parceiros.filter((p) => p.papel === "tomador")} valor={tomador} onChange={setTomador} />
        <select
          name="tomador_papel"
          value={tomadorPapel}
          onChange={(e) => setTomadorPapel(e.target.value)}
          className="input mt-2 text-xs"
        >
          {Object.entries(PAPEL_TOMADOR_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              Tomador é o {label.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-slate-500">Prestação</legend>
        <div className="grid grid-cols-2 gap-2">
          <input name="municipio_inicio" defaultValue={municipioInicioPadrao} placeholder="Município início" required className="input text-xs" />
          <input name="uf_inicio" defaultValue={ufInicioPadrao} placeholder="UF início" maxLength={2} required className="input text-xs uppercase" />
          <input name="municipio_fim" defaultValue={municipioFimPadrao} placeholder="Município fim" required className="input text-xs" />
          <input name="uf_fim" defaultValue={ufFimPadrao} placeholder="UF fim" maxLength={2} required className="input text-xs uppercase" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input name="cfop" placeholder="CFOP (ex: 6353)" required className="input text-xs" />
          <input name="natureza_operacao" placeholder="Natureza da operação" required className="input text-xs" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input name="valor_prestacao" type="number" step="0.01" placeholder="Valor da prestação" required className="input text-xs" />
          <input name="valor_receber" type="number" step="0.01" placeholder="Valor a receber (opcional)" className="input text-xs" />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-slate-500">ICMS</legend>
        <div className="grid grid-cols-4 gap-2">
          <input name="icms_cst" placeholder="CST" required className="input text-xs" />
          <input name="icms_base" type="number" step="0.01" placeholder="Base" className="input text-xs" />
          <input name="icms_aliquota" type="number" step="0.01" placeholder="Alíquota %" className="input text-xs" />
          <input name="icms_valor" type="number" step="0.01" placeholder="Valor ICMS" className="input text-xs" />
        </div>
      </fieldset>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Chaves de NF-e da carga (uma por linha ou separadas por vírgula)</label>
        <textarea name="chaves_nfe" rows={2} defaultValue={chavesNfePadrao} className="input w-full text-xs" placeholder="44 dígitos cada" />
        {chavesNfePadrao && <p className="mt-1 text-[11px] text-slate-400">Pré-preenchido com as NF-e do romaneio deste frete.</p>}
      </div>

      <button type="submit" disabled={isPending} className="btn-primary w-full text-xs">
        {isPending ? "Emitindo..." : "Emitir CT-e"}
      </button>
      {mensagem && (
        <p className={`text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>
      )}
    </form>
  );
}

export function AcoesCteEmitido({ cteId, empresaId }: { cteId: string; empresaId: string }) {
  const [modo, setModo] = useState<"nenhum" | "cancelar" | "correcao">("nenhum");
  const [texto, setTexto] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    setMensagem(undefined);
    startTransition(async () => {
      const resultado =
        modo === "cancelar" ? await cancelarCteAcao(cteId, empresaId, texto) : await cartaCorrecaoCteAcao(cteId, empresaId, texto);
      if (resultado.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else {
        setMensagem({ tipo: "sucesso", texto: resultado.ok ?? "Feito." });
        setModo("nenhum");
        setTexto("");
      }
    });
  }

  if (modo === "nenhum") {
    return (
      <div className="mt-1 flex gap-2">
        <button type="button" onClick={() => setModo("cancelar")} className="text-[11px] text-red-600 hover:underline">
          Cancelar CT-e
        </button>
        <button type="button" onClick={() => setModo("correcao")} className="text-[11px] text-frota-600 hover:underline">
          Carta de correção
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={modo === "cancelar" ? "Justificativa do cancelamento (mín. 15 caracteres)" : "Texto da carta de correção (mín. 15 caracteres)"}
        rows={2}
        className="input w-full text-xs"
      />
      <div className="flex gap-2">
        <button type="button" disabled={isPending} onClick={confirmar} className="btn-secondary text-[11px]">
          {isPending ? "Enviando..." : "Confirmar"}
        </button>
        <button type="button" onClick={() => setModo("nenhum")} className="text-[11px] text-slate-400 hover:underline">
          cancelar ação
        </button>
      </div>
      {mensagem && <p className={`text-[11px] ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>}
    </div>
  );
}
