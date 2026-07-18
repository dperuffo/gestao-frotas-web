"use client";

// Fase Fretes-Dados-Completos — pedido do Daniel: motorista precisa do
// endereço completo (não só a cidade escolhida em CampoLocalFrete, que
// serve pro cálculo de km/mapa) e do horário exato de coleta/entrega pra
// decidir se aceita o frete. Campos estruturados (não texto livre) pra
// facilitar exibição, validação e futura busca por CEP.

type Props = {
  titulo: string;
  prefixo: "coleta" | "entrega";
  valorInicial?: {
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    referencia?: string | null;
    data?: string | null;
    hora?: string | null;
    contatoNome?: string | null;
    contatoTelefone?: string | null;
  };
};

export function CampoEnderecoCompleto({ titulo, prefixo, valorInicial }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{titulo}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">Rua / Av.</label>
          <input type="text" name={`${prefixo}_rua`} defaultValue={valorInicial?.rua ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Número</label>
          <input type="text" name={`${prefixo}_numero`} defaultValue={valorInicial?.numero ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Bairro</label>
          <input type="text" name={`${prefixo}_bairro`} defaultValue={valorInicial?.bairro ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Cidade</label>
          <input type="text" name={`${prefixo}_cidade`} defaultValue={valorInicial?.cidade ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">UF</label>
          <input type="text" name={`${prefixo}_uf`} maxLength={2} defaultValue={valorInicial?.uf ?? ""} className="input uppercase" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">CEP</label>
          <input type="text" name={`${prefixo}_cep`} defaultValue={valorInicial?.cep ?? ""} className="input" />
        </div>
        <div className="sm:col-span-6">
          <label className="mb-1 block text-xs font-medium text-slate-500">Ponto de referência (opcional)</label>
          <input type="text" name={`${prefixo}_referencia`} defaultValue={valorInicial?.referencia ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Data</label>
          <input type="date" name={`${prefixo}_data`} defaultValue={valorInicial?.data ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Hora</label>
          <input type="time" name={`${prefixo}_hora`} defaultValue={valorInicial?.hora ?? ""} className="input" />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">Contato no local (nome)</label>
          <input type="text" name={`${prefixo}_contato_nome`} defaultValue={valorInicial?.contatoNome ?? ""} className="input" />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">Telefone do contato</label>
          <input type="text" name={`${prefixo}_contato_telefone`} defaultValue={valorInicial?.contatoTelefone ?? ""} className="input" />
        </div>
      </div>
    </div>
  );
}
