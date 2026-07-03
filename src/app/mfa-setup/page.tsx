"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthCard } from "@/components/AuthShell";

// Tela obrigatória de segundo fator (MFA), exibida logo após o login com Google:
// - Se o usuário ainda não tem um fator TOTP cadastrado nesta aplicação web,
//   mostra o QR Code para ele escanear no app autenticador (Google Authenticator,
//   Authy etc.) e cadastrar.
// - Se já tem um fator cadastrado mas ainda não confirmou nesta sessão,
//   pede só o código de 6 dígitos.
//
// Visual: mesmo design system das telas de login/cadastro (AuthShell,
// variante "compact" pra não competir com o QR Code em altura de tela).
export default function MfaSetupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<"verificar" | "cadastrar">("verificar");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function preparar() {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpExistente = factors?.totp?.find((f) => f.status === "verified");

      if (totpExistente) {
        // Já existe um fator verificado — só precisamos de um novo desafio (código).
        setFactorId(totpExistente.id);
        setModo("verificar");
        setCarregando(false);
        return;
      }

      // Nenhum fator ainda — inicia o cadastro (gera QR Code novo).
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) {
        setErro("Não foi possível iniciar o cadastro do MFA. Recarregue a página.");
        setCarregando(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setModo("cadastrar");
      setCarregando(false);
    }
    preparar();
  }, [supabase]);

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setErro(null);
    setEnviando(true);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setErro("Erro ao gerar o desafio de verificação. Tente novamente.");
      setEnviando(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: codigo,
    });

    if (verifyError) {
      setErro("Código inválido. Confira o app autenticador e tente novamente.");
      setEnviando(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-frota-950">
        <p className="text-sm text-slate-300">Carregando...</p>
      </div>
    );
  }

  return (
    <AuthShell variant="compact">
      <AuthCard>
        <h2 className="text-center text-lg font-semibold text-white">Verificação em duas etapas</h2>
        <p className="mb-6 text-center text-sm text-slate-400">
          {modo === "cadastrar"
            ? "Escaneie o QR Code com um aplicativo autenticador (Google Authenticator, Authy, etc.) e digite o código gerado."
            : "Digite o código do seu aplicativo autenticador para continuar."}
        </p>

        {erro && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</div>
        )}

        {modo === "cadastrar" && qrCode && (
          <div className="mb-4 flex justify-center rounded-lg border border-white/10 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="QR Code para configurar o autenticador" width={180} height={180} />
          </div>
        )}

        <form onSubmit={handleConfirmar} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000"
            className="input-dark text-center text-lg tracking-widest"
          />
          <button type="submit" disabled={enviando} className="btn-primary w-full">
            {enviando ? "Verificando..." : "Confirmar"}
          </button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
