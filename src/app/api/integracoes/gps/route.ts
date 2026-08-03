import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_GPS_WRITE } from "@/lib/apiKeys";

// Fase Grupo 2 (Rodopar/Datapar, item 4, 03/08/2026) — endpoint GENÉRICO de
// ingestão de posições GPS: não integra com nenhum provedor específico
// (Sascar, Positron, Onixsat, Autotrac...) — qualquer um deles (ou outro
// que o cliente já tenha) consegue configurar o próprio sistema pra
// empurrar posições aqui, autenticado com a chave do Hub de Integrações
// (mesmo padrão Bearer + escopo de /api/integracoes/*). Aceita 1 posição
// ou um lote (array) no mesmo corpo — providers costumam enviar em lote
// pra economizar requisições.
export const runtime = "nodejs";

type PosicaoRecebida = {
  placa?: string;
  lat?: number;
  lon?: number;
  velocidade_kmh?: number;
  timestamp_gps?: string;
  provedor?: string;
};

type LinhaPosicao = {
  placa: string;
  lat: number;
  lon: number;
  velocidade_kmh: number | null;
  timestamp_gps: string;
  provedor: string | null;
};

function validarPosicao(item: PosicaoRecebida, indice: number): { erro: string } | { ok: true; linha: LinhaPosicao } {
  const placa = item.placa?.trim().toUpperCase();
  if (!placa) return { erro: `Item ${indice}: "placa" é obrigatória.` };

  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { erro: `Item ${indice}: "lat" precisa ser um número entre -90 e 90.` };
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return { erro: `Item ${indice}: "lon" precisa ser um número entre -180 e 180.` };

  let velocidade: number | null = null;
  if (item.velocidade_kmh != null) {
    velocidade = Number(item.velocidade_kmh);
    if (!Number.isFinite(velocidade) || velocidade < 0) return { erro: `Item ${indice}: "velocidade_kmh" precisa ser um número maior ou igual a zero.` };
  }

  let timestampGps = new Date().toISOString();
  if (item.timestamp_gps) {
    const d = new Date(item.timestamp_gps);
    if (Number.isNaN(d.getTime())) return { erro: `Item ${indice}: "timestamp_gps" precisa ser uma data ISO válida.` };
    timestampGps = d.toISOString();
  }

  return {
    ok: true,
    linha: {
      placa,
      lat,
      lon,
      velocidade_kmh: velocidade,
      timestamp_gps: timestampGps,
      provedor: item.provedor?.trim() || null,
    },
  };
}

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_GPS_WRITE);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição precisa ser um JSON válido." }, { status: 400 });
  }

  const itens: PosicaoRecebida[] = Array.isArray(corpo) ? corpo : corpo && typeof corpo === "object" ? [corpo as PosicaoRecebida] : [];
  if (itens.length === 0) {
    return NextResponse.json(
      { erro: 'Envie um objeto de posição ou um array deles, com "placa", "lat" e "lon".' },
      { status: 400 }
    );
  }

  const linhas: (LinhaPosicao & { empresa_id: string })[] = [];
  const erros: string[] = [];
  itens.forEach((item, i) => {
    const resultado = validarPosicao(item, i);
    if ("erro" in resultado) erros.push(resultado.erro);
    else linhas.push({ ...resultado.linha, empresa_id: chave.empresaId });
  });

  if (linhas.length === 0) {
    return NextResponse.json({ erro: "Nenhum item válido.", detalhes: erros }, { status: 400 });
  }

  const { error: erroInsercao } = await supabase.from("veiculos_posicoes").insert(linhas);
  if (erroInsercao) {
    return NextResponse.json({ erro: `Não foi possível registrar as posições: ${erroInsercao.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json(
    { status: "criado", posicoes_recebidas: itens.length, posicoes_gravadas: linhas.length, itens_invalidos: erros },
    { status: 201 }
  );
}
