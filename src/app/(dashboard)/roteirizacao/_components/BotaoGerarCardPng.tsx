"use client";

import { useRef, useState } from "react";
import type { ParadaSugerida } from "@/lib/roteirizacaoAlgoritmo";

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function truncar(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// Desenha e baixa um "card" resumo da rota como PNG, pra compartilhar por
// WhatsApp/e-mail — tudo desenhado num <canvas> no navegador (Canvas 2D API
// nativa), sem lib nova nem servidor. Porta a ideia do
// _gerar_card_rota_png() do Streamlit, mas sem precisar de Pillow no backend.
export function BotaoGerarCardPng({
  origemLabel,
  destinoLabel,
  placa,
  combustivel,
  distanciaKm,
  duracaoMin,
  custoTotal,
  paradas,
}: {
  origemLabel: string;
  destinoLabel: string;
  placa?: string;
  combustivel?: string;
  distanciaKm: number;
  duracaoMin: number;
  custoTotal: number;
  paradas: ParadaSugerida[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pronto, setPronto] = useState(false);

  function gerar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 900;
    const H = 1150;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fundo branco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Cabeçalho com gradiente (mesma paleta do menu da aplicação)
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#004D40");
    grad.addColorStop(1, "#00796B");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 130);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px Arial, sans-serif";
    ctx.fillText("🧭 Relatório de Roteirização", 32, 55);
    ctx.font = "16px Arial, sans-serif";
    ctx.fillText("Fleet Network Intelligence · Gestão de Frotas FNI", 32, 90);

    let y = 170;

    // Rota
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText(`🟢 ${truncar(origemLabel, 40)}`, 32, y);
    y += 34;
    ctx.fillText(`🔴 ${truncar(destinoLabel, 40)}`, 32, y);
    y += 46;

    // Badge do veículo
    if (placa || combustivel) {
      ctx.fillStyle = "#e0f7fa";
      ctx.fillRect(32, y - 24, W - 64, 40);
      ctx.fillStyle = "#004D40";
      ctx.font = "15px Arial, sans-serif";
      const partes = [placa ? `🚛 ${placa.toUpperCase()}` : null, combustivel ? `⛽ ${combustivel}` : null].filter(
        (p): p is string => Boolean(p)
      );
      ctx.fillText(partes.join("   ·   "), 44, y + 2);
      y += 56;
    }

    // KPIs em grade 2x2
    const kpis = [
      { label: "DISTÂNCIA", valor: `${distanciaKm.toFixed(0)} km` },
      {
        label: "TEMPO ESTIMADO",
        valor: `${Math.floor(duracaoMin / 60)}h ${String(Math.round(duracaoMin % 60)).padStart(2, "0")}min`,
      },
      { label: "PARADAS SUGERIDAS", valor: String(paradas.length) },
      { label: "CUSTO TOTAL", valor: formatarMoeda(custoTotal) },
    ];
    const kpiW = (W - 64 - 16) / 2;
    kpis.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 32 + col * (kpiW + 16);
      const yy = y + row * 90;
      ctx.fillStyle = "#f1f8e9";
      ctx.fillRect(x, yy, kpiW, 76);
      ctx.fillStyle = "#558b2f";
      ctx.font = "12px Arial, sans-serif";
      ctx.fillText(k.label, x + 14, yy + 24);
      ctx.fillStyle = "#1b5e20";
      ctx.font = "bold 26px Arial, sans-serif";
      ctx.fillText(k.valor, x + 14, yy + 58);
    });
    y += 200;

    // Paradas (até 6, pra caber no card)
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 18px Arial, sans-serif";
    ctx.fillText("⛽ Paradas de abastecimento", 32, y);
    y += 30;

    if (paradas.length === 0) {
      ctx.fillStyle = "#777";
      ctx.font = "15px Arial, sans-serif";
      ctx.fillText("Alcance do veículo cobre a rota sem precisar abastecer.", 32, y);
      y += 30;
    } else {
      const max = Math.min(paradas.length, 6);
      for (let i = 0; i < max; i++) {
        const p = paradas[i];
        ctx.fillStyle = i % 2 === 0 ? "#fafafa" : "#ffffff";
        ctx.fillRect(32, y - 20, W - 64, 46);
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 15px Arial, sans-serif";
        ctx.fillText(`#${i + 1} ${truncar(p.label, 34)}`, 44, y);
        ctx.font = "13px Arial, sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText(`km ${p.km.toFixed(0)} · ${p.litrosSugeridos} L · ${formatarMoeda(p.custoAbastecimento)}`, 44, y + 20);
        y += 50;
      }
      if (paradas.length > max) {
        ctx.fillStyle = "#888";
        ctx.font = "13px Arial, sans-serif";
        ctx.fillText(`+ ${paradas.length - max} parada(s) — veja o relatório completo em PDF.`, 32, y + 6);
        y += 30;
      }
    }

    // Rodapé
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 32, H - 24);

    setPronto(true);
  }

  function baixar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rota_${origemLabel.slice(0, 12).replace(/\s+/g, "_")}_${destinoLabel.slice(0, 12).replace(/\s+/g, "_")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={gerar}>
          📤 Gerar Card
        </button>
        {pronto && (
          <button type="button" className="btn-secondary" onClick={baixar}>
            ⬇️ Baixar PNG
          </button>
        )}
      </div>
      <canvas ref={canvasRef} className={pronto ? "mt-3 w-full max-w-xs rounded-lg border border-slate-200" : "hidden"} />
    </div>
  );
}
