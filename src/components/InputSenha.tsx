"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Campo de senha com botão de "olho" pra mostrar/ocultar o texto digitado —
// usado nas telas de autenticação (login, cadastro, redefinir senha), que
// são as únicas do app com input type="password". `tabIndex={-1}` no botão
// pra não atrapalhar a navegação por Tab entre os campos do formulário (o
// próximo campo real, não o botão de olho, deve ganhar foco).
export function InputSenha({
  name,
  required,
  minLength,
  autoComplete,
  placeholder,
  className = "input-dark",
}: {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={visivel ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        tabIndex={-1}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200"
      >
        {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
