// Fase 26 — portado de dperuffo/estudo-de-rede (landing/sobre.html).
// Ver README Fase 26 para o que foi ajustado ao portar.
export const TITULO = 'Sobre &mdash; FNI Gest&atilde;o de Frotas';
export const ESTILO = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0f172a;color:#fff;min-height:100vh}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 6%;border-bottom:1px solid rgba(255,255,255,0.08)}
.logo{font-size:1.2rem;font-weight:700;color:#fff}.logo span{color:#3b82f6}
nav a{color:#aac;text-decoration:none;font-size:.9rem;margin-left:24px}
nav a:hover{color:#3b82f6}
.hero{padding:80px 6% 60px;max-width:900px;margin:0 auto}
h1{font-size:2.2rem;font-weight:700;margin-bottom:16px;background:linear-gradient(135deg,#fff,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
h2{font-size:1.3rem;font-weight:600;color:#3b82f6;margin:40px 0 12px}
p{color:#aac;line-height:1.8;margin-bottom:12px;font-size:.95rem}
.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:20px}
.badge{display:inline-block;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:20px;padding:4px 14px;font-size:.8rem;color:#3b82f6;margin:4px}
footer{padding:30px 6%;border-top:1px solid rgba(255,255,255,0.05);text-align:center;color:#556;font-size:.8rem;margin-top:60px}
footer a{color:#3b82f6;text-decoration:none}
`;
export const CORPO = `
<nav>
  <div class="logo">FNI <span>Gest&atilde;o de Frotas</span></div>
  <div>
    <a href="/">Início</a>
    <a href="/termos">Termos</a>
    <a href="/sobre">Sobre</a>
    <a href="/privacidade">Privacidade</a>
    <a href="mailto:contato@fxgestaodefrotasonline.com">Contato</a>
  </div>
</nav>
<div class="hero">
  <h1>Sobre a FNI Gest&atilde;o de Frotas</h1>
  <p>A <strong>Fleet Network Intelligence (FNI)</strong> &eacute; uma empresa brasileira de tecnologia especializada em solu&ccedil;&otilde;es SaaS para <strong>gest&atilde;o inteligente de frotas e combust&iacute;veis</strong>.</p>
  <p>Nossa miss&atilde;o &eacute; democratizar o acesso a dados precisos de pre&ccedil;os de combust&iacute;veis, ajudando empresas a reduzir custos operacionais e tomar decis&otilde;es mais inteligentes sobre abastecimento.</p>
  <h2>O que fazemos</h2>
  <div class="card">
    <p>Nossa plataforma conecta gestores de frota a dados em tempo real da <strong>ANP (Ag&ecirc;ncia Nacional do Petr&oacute;leo)</strong>, com cobertura de aproximadamente <strong>38.000 postos cadastrados</strong> em todo o Brasil.</p>
    <p>Integramos com os principais meios de pagamento do mercado:</p>
    <div style="margin-top:12px">
      <span class="badge">Pr&oacute;-Frotas</span>
      <span class="badge">Ticket Log</span>
      <span class="badge">Rede Frota</span>
      <span class="badge">Veloe</span>
      <span class="badge">Sem Parar</span>
    </div>
  </div>
  <h2>Seguran&ccedil;a e Privacidade</h2>
  <div class="card">
    <p>&#10003; <strong>OAuth 2.0</strong> via Google e Microsoft &mdash; n&atilde;o armazenamos senhas<br>
    &#10003; <strong>Dados criptografados</strong> em tr&acirc;nsito (TLS 1.3) e em repouso<br>
    &#10003; <strong>LGPD compliant</strong> &mdash; direito de acesso, corre&ccedil;&atilde;o e exclus&atilde;o garantidos<br>
    &#10003; <strong>Isolamento multitenante</strong> &mdash; dados de cada empresa completamente separados<br>
    &#10003; <strong>Prote&ccedil;&atilde;o WAF Cloudflare</strong> &mdash; contra ataques DDoS, SQL injection e XSS</p>
  </div>
  <h2>Contato</h2>
  <div class="card">
    <p>&#128231; <strong>E-mail:</strong> <a href="mailto:contato@fxgestaodefrotasonline.com" style="color:#3b82f6">contato@fxgestaodefrotasonline.com</a></p>
    <p>&#127760; <strong>Plataforma:</strong> <a href="https://fxgestaodefrotasonline.com" style="color:#3b82f6">fxgestaodefrotasonline.com</a></p>
    <p>&#127463;&#127479; <strong>Pa&iacute;s:</strong> Brasil</p>
    <p style="margin-top:16px;font-size:.85rem;color:#556">O acesso &eacute; restrito a empresas com contrato ativo. Para solicitar acesso, entre em contato pelo e-mail acima.</p>
  </div>
</div>
<footer>
  &copy; 2026 Fleet Network Intelligence Ltda. &mdash; Todos os direitos reservados<br>
  <a href="/termos">Termos de Uso</a> &middot;
  <a href="/privacidade">Pol&iacute;tica de Privacidade</a> &middot;
  <a href="mailto:contato@fxgestaodefrotasonline.com">contato@fxgestaodefrotasonline.com</a>
</footer>
`;
