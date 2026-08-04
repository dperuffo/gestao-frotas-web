"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { digitarNfeCargaAcao, enviarNfeCargaAcao, lerFotoNfeOcrAcao } from "../romaneioActions";

// Fase P0.4 (plano FNI_Plano_Implementacao_P0.md) — romaneio: NF-e do
// embarcador vinculadas ao frete. Peso/volume/valor somados formam o
// manifesto de carga; as chaves entram como sugestão pronta na hora de
// emitir o CT-e (ver CteEmissaoForm.tsx).

export type NfeCargaRow = {
  id: string;
  numeroNf: number | null;
  serieNf: string | null;
  nomeEmitente: string | null;
  valorNf: number | null;
  pesoBrutoKg: number | null;
  quantidadeVolumes: number | null;
  chaveAcesso: string;
  origem: string;
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function RomaneioCard({ freteId, empresaId, nfes }: { freteId: string; empresaId: string; nfes: NfeCargaRow[] }) {
  const totalPeso = nfes.reduce((soma, n) => soma + (n.pesoBrutoKg ?? 0), 0);
  const totalValor = nfes.reduce((soma, n) => soma + (n.valorNf ?? 0), 0);

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">📦 Romaneio (NF-e da carga)</h2>
      <p className="mb-4 text-xs text-slate-500">
        NF-e do embarcador — peso, volume e valor somados aqui viram o manifesto de carga do CT-e/MDF-e.
      </p>

      {nfes.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Indicador label="NF-e" valor={String(nfes.length)} />
          <Indicador label="Peso bruto total" valor={totalPeso > 0 ? `${totalPeso.toLocaleString("pt-BR")} kg` : "—"} />
          <Indicador label="Valor total" valor={totalValor > 0 ? formatoMoeda.format(totalValor) : "—"} />
        </div>
      )}

      <div className="mb-3 space-y-2">
        {nfes.map((n) => (
          <div key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">Nº {n.numeroNf ?? "—"} / série {n.serieNf ?? "—"}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{n.origem === "digitada" ? "digitada" : "upload"}</span>
            </div>
            <p className="text-xs text-slate-500">
              {n.nomeEmitente ?? "—"}
              {n.valorNf != null ? ` · ${formatoMoeda.format(n.valorNf)}` : ""}
              {n.pesoBrutoKg != null ? ` · ${n.pesoBrutoKg.toLocaleString("pt-BR")} kg` : ""}
              {n.quantidadeVolumes != null ? ` · ${n.quantidadeVolumes} volume(s)` : ""}
            </p>
          </div>
        ))}
        {nfes.length === 0 && <p className="text-xs text-slate-400">Nenhuma NF-e registrada ainda.</p>}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormUploadNfe freteId={freteId} empresaId={empresaId} />
        <FormDigitarNfe freteId={freteId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{valor}</p>
    </div>
  );
}

function FormUploadNfe({ freteId, empresaId }: { freteId: string; empresaId: string }) {
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await enviarNfeCargaAcao(freteId, empresaId, formData);
      if (resultado.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else if (resultado.sucesso) {
        setMensagem({ tipo: "sucesso", texto: `NF-e nº ${resultado.sucesso.numeroNf} registrada.` });
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <input type="file" name="arquivo" accept=".xml" required className="input text-xs" />
      <button type="submit" disabled={isPending} className="btn-secondary w-full text-xs">
        {isPending ? "Validando..." : "Enviar XML da NF-e"}
      </button>
      {mensagem && <p className={`text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>}
    </form>
  );
}

function FormDigitarNfe({ freteId, empresaId }: { freteId: string; empresaId: string }) {
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();
  const [lendoFoto, setLendoFoto] = useState(false);
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [valorNf, setValorNf] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await digitarNfeCargaAcao(freteId, empresaId, formData);
      if (resultado.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else if (resultado.sucesso) {
        setMensagem({ tipo: "sucesso", texto: "NF-e registrada." });
        formRef.current?.reset();
        setChaveAcesso("");
        setValorNf("");
      }
    });
  }

  async function handleFotoOcr(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setMensagem(undefined);
    setLendoFoto(true);
    const formData = new FormData();
    formData.set("foto", arquivo);
    const resultado = await lerFotoNfeOcrAcao(formData);
    setLendoFoto(false);
    if (resultado.erro) {
      setMensagem({ tipo: "erro", texto: resultado.erro });
      return;
    }
    if (resultado.sugestao?.chaveAcesso) setChaveAcesso(resultado.sugestao.chaveAcesso);
    if (resultado.sugestao?.valorNf) setValorNf(String(resultado.sugestao.valorNf));
    setMensagem({ tipo: "sucesso", texto: "Lido da foto — confira os campos antes de registrar." });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <label className="block cursor-pointer rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-center text-xs text-slate-500 hover:bg-slate-50">
        {lendoFoto ? "Lendo a foto (OCR)..." : "📷 Ler chave de uma foto (OCR, opcional)"}
        <input type="file" accept="image/*" capture="environment" onChange={handleFotoOcr} disabled={lendoFoto} className="hidden" />
      </label>
      <input
        name="chave_acesso"
        placeholder="Chave de acesso (44 dígitos)"
        required
        maxLength={50}
        value={chaveAcesso}
        onChange={(e) => setChaveAcesso(e.target.value)}
        className="input text-xs"
      />
      <div className="grid grid-cols-2 gap-2">
        <input name="peso_bruto_kg" type="number" step="0.01" placeholder="Peso bruto (kg)" className="input text-xs" />
        <input
          name="valor_nf"
          type="number"
          step="0.01"
          placeholder="Valor da NF-e"
          value={valorNf}
          onChange={(e) => setValorNf(e.target.value)}
          className="input text-xs"
        />
      </div>
      <button type="submit" disabled={isPending} className="btn-secondary w-full text-xs">
        {isPending ? "Registrando..." : "Digitar chave da NF-e"}
      </button>
      {mensagem && <p className={`text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>}
    </form>
  );
}
