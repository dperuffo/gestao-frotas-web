"use client";

import { useState, useTransition, type FormEvent } from "react";
import { salvarMeuPostoAcao } from "../actions";
import type { Database } from "@/types/database.types";

type Empresa = Database["public"]["Tables"]["empresas"]["Row"];

const STATUS_LABEL: Record<string, { texto: string; cor: string }> = {
  pendente: { texto: "Cadastro ainda não confirmado", cor: "bg-slate-100 text-slate-600" },
  confirmado: { texto: "✓ CNPJ confirmado na base ANP", cor: "bg-green-50 text-green-700" },
  novo_sem_anp: { texto: "Posto novo — CNPJ não está na base ANP ainda", cor: "bg-blue-50 text-blue-700" },
  possivel_duplicidade: {
    texto: "⚠ Possível duplicidade sinalizada — em revisão pela FNI",
    cor: "bg-amber-50 text-amber-800",
  },
};

// Fase 27.137 — pedido do Daniel: aba "Meu Posto", o formulário de adesão
// que compara o cadastro com a base ANP (RPC verificar_e_registrar_posto_anp,
// chamada por salvarMeuPostoAcao). O botão "Usar minha localização" usa a
// Geolocation API do navegador — só preenche os campos, o posto ainda pode
// ajustar à mão antes de salvar (útil quando o GPS do dispositivo não é
// preciso o bastante, ou quando o posto quer marcar o ponto de entrada
// principal em vez de onde o celular está agora).
export function MeuPostoForm({ empresa }: { empresa: Empresa }) {
  const [erro, setErro] = useState<string | undefined>();
  const [resultado, setResultado] = useState<"confirmado" | "novo_sem_anp" | "possivel_duplicidade" | undefined>();
  const [latitude, setLatitude] = useState(empresa.latitude != null ? String(empresa.latitude) : "");
  const [longitude, setLongitude] = useState(empresa.longitude != null ? String(empresa.longitude) : "");
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);
  const [isPending, startTransition] = useTransition();

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) {
      setErro("Este navegador não suporta geolocalização — preencha latitude/longitude manualmente.");
      return;
    }
    setBuscandoLocalizacao(true);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setLatitude(String(posicao.coords.latitude));
        setLongitude(String(posicao.coords.longitude));
        setBuscandoLocalizacao(false);
      },
      (erroGeo) => {
        setErro(`Não foi possível obter sua localização: ${erroGeo.message}`);
        setBuscandoLocalizacao(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setResultado(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const r = await salvarMeuPostoAcao(empresa.id, formData);
      if (r.status === "erro") {
        setErro(r.mensagem);
      } else {
        setResultado(r.status);
      }
    });
  }

  const statusAtual = STATUS_LABEL[empresa.anp_status ?? "pendente"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`rounded-lg px-3 py-2 text-sm ${statusAtual.cor}`}>{statusAtual.texto}</div>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {resultado && (
        <div className={`rounded-lg px-3 py-2 text-sm ${STATUS_LABEL[resultado].cor}`}>
          Cadastro salvo. {STATUS_LABEL[resultado].texto}
          {resultado === "possivel_duplicidade" &&
            " — seus dados já foram salvos normalmente, a FNI vai revisar e entrar em contato se precisar de algo."}
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="CNPJ" required>
            <input name="cnpj" required defaultValue={empresa.cnpj ?? ""} className="input" placeholder="00.000.000/0001-00" />
          </Campo>
          <Campo label="Razão Social" required>
            <input name="razao_social" required defaultValue={empresa.nome} className="input" />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Endereço completo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Logradouro" className="sm:col-span-2">
            <input name="logradouro" defaultValue={empresa.logradouro ?? ""} className="input" />
          </Campo>
          <Campo label="Número">
            <input name="numero" defaultValue={empresa.numero ?? ""} className="input" />
          </Campo>
          <Campo label="Complemento">
            <input name="complemento" defaultValue={empresa.complemento ?? ""} className="input" />
          </Campo>
          <Campo label="Bairro">
            <input name="bairro" defaultValue={empresa.bairro ?? ""} className="input" />
          </Campo>
          <Campo label="CEP">
            <input name="cep" defaultValue={empresa.cep ?? ""} className="input" />
          </Campo>
          <Campo label="Município">
            <input name="municipio" defaultValue={empresa.municipio ?? ""} className="input" />
          </Campo>
          <Campo label="UF">
            <input name="uf" maxLength={2} defaultValue={empresa.uf ?? ""} className="input uppercase" />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Localização (latitude/longitude)</h2>
        <p className="mb-4 text-xs text-slate-500">
          Usada pra comparar seu posto com a base da ANP e evitar cadastro duplicado, além de posicionar seu posto
          certinho no mapa de consultas/roteirização.
        </p>
        <div className="mb-3">
          <button type="button" onClick={usarMinhaLocalizacao} disabled={buscandoLocalizacao} className="btn-secondary">
            {buscandoLocalizacao ? "Buscando localização..." : "📍 Usar minha localização atual"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Latitude">
            <input
              name="latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="input"
              placeholder="-23.550520"
            />
          </Campo>
          <Campo label="Longitude">
            <input
              name="longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="input"
              placeholder="-46.633308"
            />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Contatos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Telefone de contato">
            <input name="telefone_contato" defaultValue={empresa.telefone_contato ?? ""} className="input" />
          </Campo>
          <Campo label="E-mail de contato">
            <input type="email" name="email_contato" defaultValue={empresa.email_contato ?? ""} className="input" />
          </Campo>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar e verificar com a ANP"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
