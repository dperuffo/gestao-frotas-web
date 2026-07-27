// Fase 26 — conteúdo da landing pública (fxgestaodefrotasonline.com), portado
// do repositório dperuffo/estudo-de-rede (diretório landing/index.html) pra
// virar a rota "/" deste app. Mantido como HTML bruto (em vez de reescrever
// tudo em JSX) porque a página tem CSS e JS inline entrelaçados (troca de
// idioma PT/EN via localStorage, tabs do demo animado) — reescrever cada
// atributo style="" em objeto JSX seria um retrabalho enorme e arriscado sem
// ganho real, já que essa página não tem nenhuma interatividade React (não
// usa useState/props daqui). Renderizado via dangerouslySetInnerHTML em
// src/app/page.tsx; os <script> ficam dentro desse HTML e executam
// normalmente no carregamento inicial (a ressalva de "innerHTML não executa
// <script>" vale só para innerHTML setado via JS depois do load, não para
// HTML que já vem embutido na resposta do servidor, que é o caso aqui).
//
// Achado real (19/07) — "toggle EN não funciona, nem após deploy Railway +
// limpeza de cache Cloudflare": testei o script inteiro rodando de verdade
// (jsdom simulando um navegador) e ele funciona perfeitamente — o problema
// não é o código, é o CLOUDFLARE. O Rocket Loader (recurso de otimização do
// Cloudflare, ligado por padrão em muitas zonas) reescreve e ADIA a
// execução de <script> inline pra depois do carregamento da página — o que
// quebra estes dois blocos, já que um declara variáveis (_u2_pt, _lang) que
// o outro depende existir antes de rodar. Sem gerar nenhum erro visível: o
// Rocket Loader só reordena a execução, então o sintoma é exatamente "não
// muda nada, sem erro no console". Corrigido com `data-cfasync="false"` nos
// dois <script> abaixo — atributo oficial do Cloudflare pra dizer "não
// mexe neste script, deixa rodar normal, inline, na ordem". Se ainda assim
// não funcionar, vale desligar o Rocket Loader direto no painel Cloudflare
// (Speed > Optimization) pra esta zona.
//
// Ajustes feitos ao portar (ver README Fase 26):
// - Links que apontavam pra https://app.fxgestaodefrotasonline.com viraram
//   /login (Acessar Plataforma) ou /cadastro (todos os CTAs de "começar").
// - Links de termos.html/privacidade.html/sobre.html viraram rotas do Next
//   (/termos, /privacidade, /sobre, com variante -en).
// - Preços da seção de planos atualizados pra bater com o Stripe real.
//   Calibração TMS/ERP (23/07/2026, pedido do Daniel): Essencial R$249,
//   Profissional R$549 (agora com Gestão de Fretes/TMS até 30/mês, CT-e/
//   MDF-e, Cotações e Tabelas de Frete), Enterprise R$1.099 (TMS ilimitado)
//   — mesmos valores/nomes de PLANO_LABEL/FEATURES_PLANO em
//   src/lib/constants.ts e da Cláusula 3ª por plano em src/lib/
//   termoAdesao.ts. O card "Gratuito" foi mantido de propósito — ele
//   reflete o plano "gratuito" real do trial self-service (1 usuário, 10
//   veículos, ver LIMITES_PLANO em src/lib/constants.ts), não é um valor
//   inventado.
// - Fase Posto/Rede (26/07/2026, pedido do Daniel): nova seção
//   .pricing#precos-postos com os 3 planos de posto revendedor (Essencial
//   R$99, Profissional R$159, Enterprise R$599) — antes a seção #postos só
//   tinha texto de marketing e dizia (incorretamente, após esta fase) que
//   postos assinavam "os mesmos planos usados pelos clientes de frota".
//   Texto/preços em sincronia manual com PLANOS_POSTO/PLANO_POSTO_LABEL/
//   FEATURES_PLANO_POSTO/FAIXA_POSTOS_PLANO em src/lib/constants.ts e a
//   Cláusula 3ª por plano de posto em src/lib/termoAdesao.ts.
export const LANDING_BODY_HTML = `
<style>
:root{--navy:#04112e;--blue:#0d2d6b;--electric:#1a56f0;--cyan:#00b4d8;--cyan2:#00c2ff;--gold:#f5a623;--white:#ffffff;--gray:#8a9bb5;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Inter',sans-serif;background:var(--navy);color:var(--white);overflow-x:hidden;}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 6%;background:rgba(4,17,46,0.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.06);}
.nav-links{display:flex;gap:36px;list-style:none;}
.nav-links a{color:var(--gray);text-decoration:none;font-size:0.88rem;transition:color 0.2s;}
.nav-links a:hover{color:var(--white);}
.nav-cta{background:var(--cyan);color:var(--navy);text-decoration:none;padding:10px 24px;border-radius:8px;font-size:0.88rem;font-weight:600;transition:all 0.2s;}
.nav-cta:hover{background:var(--cyan2);transform:translateY(-1px);}
.hero{min-height:100vh;display:flex;align-items:center;padding:130px 6% 90px;position:relative;overflow:hidden;}
.hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 65% 45%,rgba(0,180,216,0.12) 0%,transparent 65%),radial-gradient(ellipse 50% 40% at 20% 80%,rgba(26,86,240,0.10) 0%,transparent 60%);}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse 90% 80% at 50% 50%,black,transparent);}
.hero-content{position:relative;z-index:2;max-width:680px;}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(0,180,216,0.1);border:1px solid rgba(0,180,216,0.3);padding:6px 16px;border-radius:100px;font-size:0.78rem;color:var(--cyan);font-weight:500;margin-bottom:32px;animation:fadeUp 0.6s ease both;}
.dot{width:6px;height:6px;background:var(--cyan);border-radius:50%;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
h1{font-family:'Outfit',sans-serif;font-size:clamp(2.4rem,4.5vw,3.6rem);font-weight:800;line-height:1.15;margin-bottom:24px;letter-spacing:-0.02em;animation:fadeUp 0.7s 0.1s ease both;}
h1 em{font-style:normal;background:linear-gradient(135deg,var(--cyan),#1a56f0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.sub{font-size:1.08rem;color:var(--gray);line-height:1.75;margin-bottom:44px;font-weight:300;animation:fadeUp 0.7s 0.2s ease both;}
.actions{display:flex;gap:14px;flex-wrap:wrap;animation:fadeUp 0.7s 0.3s ease both;}
.btn-p{display:inline-flex;align-items:center;gap:8px;background:var(--cyan);color:var(--navy);text-decoration:none;padding:15px 32px;border-radius:10px;font-size:0.95rem;font-weight:600;transition:all 0.2s;box-shadow:0 8px 32px rgba(0,180,216,0.3);}
.btn-p:hover{background:var(--cyan2);transform:translateY(-2px);}
.btn-s{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);color:var(--white);text-decoration:none;padding:15px 32px;border-radius:10px;font-size:0.95rem;font-weight:400;border:1px solid rgba(255,255,255,0.12);transition:all 0.2s;}
.btn-s:hover{background:rgba(255,255,255,0.09);}
.stats{display:flex;gap:48px;margin-top:56px;animation:fadeUp 0.7s 0.4s ease both;}
.sn{font-family:'Outfit',sans-serif;font-size:2rem;font-weight:800;}
.sn span{color:var(--cyan);}
.sl{font-size:0.78rem;color:var(--gray);margin-top:3px;}
.strip{padding:44px 6%;border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;}
.strip-lbl{font-size:0.75rem;color:var(--gray);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px;}
.logos{display:flex;justify-content:center;align-items:center;gap:52px;flex-wrap:wrap;}
.logo-i{font-family:'Outfit',sans-serif;font-weight:700;font-size:0.9rem;color:rgba(255,255,255,0.2);letter-spacing:0.06em;text-transform:uppercase;}
.section{padding:96px 6%;}
.sec-lbl{font-size:0.75rem;color:var(--cyan);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:14px;font-weight:600;}
.sec-title{font-family:'Outfit',sans-serif;font-size:clamp(1.9rem,3vw,2.6rem);font-weight:800;line-height:1.2;letter-spacing:-0.02em;margin-bottom:16px;}
.sec-sub{font-size:1rem;color:var(--gray);line-height:1.75;max-width:520px;font-weight:300;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:52px;}
.card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:30px;transition:all 0.3s;position:relative;overflow:hidden;}
.card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--cyan),var(--electric));opacity:0;transition:opacity 0.3s;}
.card:hover{border-color:rgba(0,180,216,0.25);transform:translateY(-4px);}
.card:hover::after{opacity:1;}
.icon{width:46px;height:46px;border-radius:12px;background:rgba(0,180,216,0.1);display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:18px;}
.ct{font-family:'Outfit',sans-serif;font-size:1.05rem;font-weight:700;margin-bottom:10px;}
.cd{font-size:0.875rem;color:var(--gray);line-height:1.7;font-weight:300;}
.steps{display:flex;gap:0;margin-top:52px;position:relative;}
.steps::before{content:'';position:absolute;top:27px;left:5%;right:5%;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:0.3;}
.step{flex:1;text-align:center;padding:0 16px;}
.step-n{width:54px;height:54px;border-radius:50%;background:var(--navy);border:1.5px solid var(--cyan);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:1.1rem;color:var(--cyan);margin:0 auto 18px;position:relative;z-index:2;}
.step-t{font-family:'Outfit',sans-serif;font-weight:700;font-size:0.95rem;margin-bottom:8px;}
.step-d{font-size:0.83rem;color:var(--gray);line-height:1.65;font-weight:300;}
.pricing{padding:96px 6%;background:rgba(255,255,255,0.012);}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px;margin-top:52px;max-width:1080px;margin-left:auto;margin-right:auto;}
.pc{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:32px 26px;display:flex;flex-direction:column;transition:all 0.3s;}
.pc.feat{background:linear-gradient(145deg,rgba(0,180,216,0.12),rgba(26,86,240,0.08));border-color:rgba(0,180,216,0.4);transform:scale(1.03);box-shadow:0 20px 60px rgba(0,180,216,0.18);}
.pbadge{display:inline-block;background:var(--cyan);color:var(--navy);font-size:0.68rem;font-weight:700;padding:4px 12px;border-radius:100px;margin-bottom:18px;align-self:flex-start;text-transform:uppercase;letter-spacing:0.08em;}
.pn{font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:8px;}
.pp{font-family:'Outfit',sans-serif;font-size:2.4rem;font-weight:800;margin-bottom:4px;letter-spacing:-0.02em;}
.pp sup{font-size:1rem;vertical-align:top;margin-top:8px;}
.pp span{font-size:0.95rem;font-weight:400;color:var(--gray);}
.pd{font-size:0.82rem;color:var(--gray);margin-bottom:24px;font-weight:300;}
.pf{list-style:none;margin-bottom:28px;flex:1;}
.pf li{display:flex;align-items:center;gap:10px;font-size:0.85rem;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);font-weight:300;}
.pf li::before{content:'✓';color:var(--cyan);font-weight:700;flex-shrink:0;font-size:0.8rem;}
.pf li.off{color:rgba(255,255,255,0.25);}
.pf li.off::before{content:'–';color:rgba(255,255,255,0.2);}
.pbtn{display:block;text-align:center;text-decoration:none;padding:13px;border-radius:9px;font-size:0.9rem;font-weight:600;transition:all 0.2s;font-family:'Outfit',sans-serif;}
.pbtn.p{background:var(--cyan);color:var(--navy);box-shadow:0 6px 20px rgba(0,180,216,0.3);}
.pbtn.p:hover{background:var(--cyan2);transform:translateY(-2px);}
.pbtn.o{border:1px solid rgba(255,255,255,0.18);color:var(--white);}
.pbtn.o:hover{background:rgba(255,255,255,0.07);}
.cta{padding:100px 6%;text-align:center;position:relative;overflow:hidden;}
.cta::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:500px;background:radial-gradient(ellipse,rgba(0,180,216,0.12),transparent 70%);pointer-events:none;}
.cta-t{font-family:'Outfit',sans-serif;font-size:clamp(2rem,4vw,3rem);font-weight:800;margin-bottom:18px;letter-spacing:-0.02em;position:relative;}
.cta-s{font-size:1.05rem;color:var(--gray);margin-bottom:40px;position:relative;font-weight:300;}
.cta-a{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;position:relative;}
footer{padding:36px 6%;border-top:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;}
.flinks{display:flex;gap:24px;}
.flinks a{font-size:0.82rem;color:var(--gray);text-decoration:none;}
.flinks a:hover{color:var(--white);}
.fcopy{font-size:0.78rem;color:rgba(255,255,255,0.25);}
.acgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin-top:52px;}
.accard{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:28px 24px;text-align:center;transition:all 0.3s;}
.accard:hover{border-color:rgba(0,180,216,0.25);transform:translateY(-4px);}
.accard svg{width:110px;margin:0 auto 18px;display:block;}
.acqr{width:88px;height:88px;margin:14px auto 0;border-radius:8px;background:#fff;padding:6px;}
.acbtn{display:inline-block;margin-top:16px;text-decoration:none;color:var(--navy);background:var(--cyan);font-weight:600;font-size:0.85rem;padding:10px 20px;border-radius:8px;transition:all 0.2s;}
.acbtn:hover{background:var(--cyan2);transform:translateY(-2px);}
.acbtn.o{background:transparent;color:var(--white);border:1px solid rgba(255,255,255,0.25);}
.acbtn.o:hover{background:rgba(255,255,255,0.07);}
.acsteps{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:44px;max-width:820px;margin-left:auto;margin-right:auto;}
.acstep{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:22px 24px;}
.acstep h4{font-family:'Outfit',sans-serif;font-size:0.98rem;margin-bottom:12px;}
.acstep p{font-size:0.85rem;color:var(--gray);line-height:1.9;font-weight:300;}
.acstep strong{color:var(--white);font-weight:600;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@media(max-width:768px){.nav-links{display:none;}.hero{padding-top:100px;}.stats{gap:28px;flex-wrap:wrap;}.steps{flex-direction:column;gap:28px;}.steps::before{display:none;}.pc.feat{transform:scale(1);}footer{flex-direction:column;text-align:center;}}
</style>

<nav>
  <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMjAgNjQiIHdpZHRoPSIyMjAiIGhlaWdodD0iNDQiPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQsNCkiPjxsaW5lIHgxPSIyNCIgeTE9IjI0IiB4Mj0iOCIgeTI9IjEyIiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48bGluZSB4MT0iMjQiIHkxPSIyNCIgeDI9IjUiIHkyPSIzMCIgc3Ryb2tlPSIjMDBiNGQ4IiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGxpbmUgeDE9IjI0IiB5MT0iMjQiIHgyPSIxMCIgeTI9IjQ0IiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48bGluZSB4MT0iMjQiIHkxPSIyNCIgeDI9IjM2IiB5Mj0iOCIgc3Ryb2tlPSIjMDBiNGQ4IiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGxpbmUgeDE9IjI0IiB5MT0iMjQiIHgyPSI0MCIgeTI9IjM4IiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMjQgNSBDMTYgNSAxMCAxMSAxMCAxOCBDMTAgMjcgMjQgNDIgMjQgNDIgQzI0IDQyIDM4IDI3IDM4IDE4IEMzOCAxMSAzMiA1IDI0IDVaIiBmaWxsPSIjMDBiNGQ4Ii8+PGNpcmNsZSBjeD0iMjQiIGN5PSIxOCIgcj0iNiIgZmlsbD0iIzA0MTEyZSIvPjxjaXJjbGUgY3g9IjgiIGN5PSIxMiIgcj0iNCIgZmlsbD0iIzAwYjRkOCIvPjxjaXJjbGUgY3g9IjUiIGN5PSIzMCIgcj0iNCIgZmlsbD0iIzAwYjRkOCIvPjxjaXJjbGUgY3g9IjEwIiBjeT0iNDQiIHI9IjQiIGZpbGw9IiMwMGI0ZDgiLz48Y2lyY2xlIGN4PSIzNiIgY3k9IjgiIHI9IjQiIGZpbGw9IiMwMGI0ZDgiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjM4IiByPSI0IiBmaWxsPSIjMDBiNGQ4Ii8+PC9nPjx0ZXh0IHg9IjYyIiB5PSIyNiIgZm9udC1mYW1pbHk9Ik91dGZpdCxzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iNzAwIiBmb250LXNpemU9IjE1IiBmaWxsPSIjZmZmZmZmIiBsZXR0ZXItc3BhY2luZz0iMC4zIj5GbGVldCBOZXR3b3JrIEludGVsbGlnZW5jZTwvdGV4dD48dGV4dCB4PSI2MiIgeT0iNDQiIGZvbnQtZmFtaWx5PSJPdXRmaXQsc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjUwMCIgZm9udC1zaXplPSIxMC41IiBmaWxsPSIjMDBiNGQ4IiBsZXR0ZXItc3BhY2luZz0iMiI+R0VTVMODTyBERSBGUk9UQVM8L3RleHQ+PC9zdmc+" alt="FNI Fleet Network Intelligence" height="38">
  <ul class="nav-links">
    <li><a href="#func" data-i18n="nav_func">Funcionalidades</a></li>
    <li><a href="#integracoes" data-i18n="nav_integracoes">Integrações</a></li>
    <li><a href="#postos" data-i18n="nav_postos">Para Postos</a></li>
    <li><a href="#como" data-i18n="nav_como">Como funciona</a></li>
    <li><a href="#precos" data-i18n="nav_precos">Preços</a></li>
    <li><a href="/indice-precos" style="color:var(--cyan);font-weight:600;white-space:nowrap;">💹 Índice GF de Preços</a></li>
  </ul>
  <a href="/login" style="color:var(--white);text-decoration:none;font-size:0.88rem;font-weight:600;padding:9px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.35);margin-right:8px;transition:all 0.2s;background:rgba(255,255,255,0.06);" onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.borderColor='rgba(255,255,255,0.6)'" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.borderColor='rgba(255,255,255,0.35)'" data-i18n="nav_acessar">🔐 Acessar Plataforma</a><a href="/cadastro" class="nav-cta" data-i18n="nav_comecar">Começar grátis →</a>
</nav>

<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>
  <div class="hero-content">
    <div style="margin-bottom:36px;animation:fadeUp 0.6s ease both;">
      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MjAgMTQwIiB3aWR0aD0iNDgwIiBoZWlnaHQ9IjEzMCI+PGRlZnM+PGZpbHRlciBpZD0iZ2xvdyI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMyIgcmVzdWx0PSJibHVyIi8+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlIGluPSJibHVyIi8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjxsaW5lYXJHcmFkaWVudCBpZD0icGciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwMGMyZmYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMGI0ZDgiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMCwxMCkiIGZpbHRlcj0idXJsKCNnbG93KSI+PGxpbmUgeDE9IjU1IiB5MT0iNTUiIHgyPSIxOCIgeTI9IjI2IiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjgiLz48bGluZSB4MT0iNTUiIHkxPSI1NSIgeDI9IjEwIiB5Mj0iNjIiIHN0cm9rZT0iIzAwYjRkOCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuOCIvPjxsaW5lIHgxPSI1NSIgeTE9IjU1IiB4Mj0iMjIiIHkyPSI5NSIgc3Ryb2tlPSIjMDBiNGQ4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44Ii8+PGxpbmUgeDE9IjU1IiB5MT0iNTUiIHgyPSI4OCIgeTI9IjE4IiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjgiLz48bGluZSB4MT0iNTUiIHkxPSI1NSIgeDI9Ijk1IiB5Mj0iODIiIHN0cm9rZT0iIzAwYjRkOCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuOCIvPjxwYXRoIGQ9Ik01NSAxNCBDMzggMTQgMjQgMjggMjQgNDQgQzI0IDYyIDU1IDkwIDU1IDkwIEM1NSA5MCA4NiA2MiA4NiA0NCBDODYgMjggNzIgMTQgNTUgMTRaIiBmaWxsPSJ1cmwoI3BnKSIvPjxjaXJjbGUgY3g9IjU1IiBjeT0iNDQiIHI9IjE0IiBmaWxsPSIjMDQxMTJlIi8+PGNpcmNsZSBjeD0iNTUiIGN5PSI0NCIgcj0iNyIgZmlsbD0iIzAwYjRkOCIgb3BhY2l0eT0iMC42Ii8+PGNpcmNsZSBjeD0iMTgiIGN5PSIyNiIgcj0iOSIgZmlsbD0iIzAwYjRkOCIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iMTAiIGN5PSI2MiIgcj0iOSIgZmlsbD0iIzAwYjRkOCIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iMjIiIGN5PSI5NSIgcj0iOSIgZmlsbD0iIzAwYjRkOCIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iODgiIGN5PSIxOCIgcj0iOSIgZmlsbD0iIzAwYjRkOCIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iOTUiIGN5PSI4MiIgcj0iOSIgZmlsbD0iIzAwYjRkOCIgb3BhY2l0eT0iMC45Ii8+PC9nPjx0ZXh0IHg9IjEyOCIgeT0iNTIiIGZvbnQtZmFtaWx5PSJPdXRmaXQsc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjgwMCIgZm9udC1zaXplPSIzNCIgZmlsbD0iI2ZmZmZmZiIgbGV0dGVyLXNwYWNpbmc9Ii0wLjUiPkZsZWV0IE5ldHdvcms8L3RleHQ+PHRleHQgeD0iMTI4IiB5PSI4OCIgZm9udC1mYW1pbHk9Ik91dGZpdCxzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iODAwIiBmb250LXNpemU9IjM0IiBmaWxsPSIjZmZmZmZmIiBsZXR0ZXItc3BhY2luZz0iLTAuNSI+SW50ZWxsaWdlbmNlPC90ZXh0PjxyZWN0IHg9IjEyOCIgeT0iMTAwIiB3aWR0aD0iNDgiIGhlaWdodD0iMiIgZmlsbD0iIzAwYjRkOCIgcng9IjEiLz48dGV4dCB4PSIxMjgiIHk9IjEyMiIgZm9udC1mYW1pbHk9Ik91dGZpdCxzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iNTAwIiBmb250LXNpemU9IjEzIiBmaWxsPSIjMDBiNGQ4IiBsZXR0ZXItc3BhY2luZz0iMyI+R0VTVMODTyBERSBGUk9UQVM8L3RleHQ+PC9zdmc+" alt="Fleet Network Intelligence" style="max-width:100%;height:auto;">
    </div>
    <div class="hero-badge"><div class="dot"></div><span data-i18n="hero_badge">Plataforma SaaS para frotas brasileiras</span></div>
    <h1><span data-i18n="hero_h1a">Inteligência de rede para</span> <em data-i18n="hero_h1b">decisões que economizam</em></h1>
    <p class="sub" data-i18n="hero_sub">Compare preços ANP em tempo real, monitore o consumo da sua frota e identifique os melhores postos credenciados — tudo em uma plataforma integrada e segura.</p>
    <div class="actions">
      <a href="/cadastro" class="btn-p" data-i18n="hero_btn_p">Teste grátis por 14 dias →</a>
      <a href="#func" class="btn-s" data-i18n="hero_btn_s">Ver funcionalidades</a>
    </div>
    <div class="stats">
      <div><div class="sn">2.9<span>k+</span></div><div class="sl" data-i18n="stat1_l">Postos monitorados</div></div>
      <div><div class="sn">14<span>dias</span></div><div class="sl" data-i18n="stat2_l">Trial gratuito</div></div>
      <div><div class="sn">ANP<span>✓</span></div><div class="sl" data-i18n="stat3_l">Dados oficiais</div></div>
    </div>
  </div>
</section>

<div class="strip">
  <div class="strip-lbl" data-i18n="strip_lbl">Compatível com os principais sistemas do mercado</div>
  <div class="logos">
    <div class="logo-i">TOTVS</div><div class="logo-i">SAP</div>
    <div class="logo-i">SEFAZ</div><div class="logo-i">ANTT</div>
    <div class="logo-i">ANP</div><div class="logo-i">SASCAR</div>
  </div>
</div>


<style>
/* ── Demo Section ── */
.demo-section { padding: 80px 0; }
.section-label { color: #00e5ff; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; }
.section-title { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 800; color: #fff; margin-bottom: 12px; }
.section-sub { color: #a0aec0; font-size: 15px; margin-bottom: 40px; }

/* Tabs */
.demo-tabs { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 32px; }
.demo-tab { padding: 10px 20px; border-radius: 24px; border: 1px solid rgba(0,229,255,0.25); background: rgba(0,229,255,0.05); color: #a0aec0; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; }
.demo-tab:hover { border-color: #00e5ff; color: #00e5ff; }
.demo-tab.active { background: rgba(0,229,255,0.15); border-color: #00e5ff; color: #00e5ff; }

/* Frame */
.demo-frame { position: relative; }
.demo-panel { display: none; animation: fadeIn .3s ease; }
.demo-panel.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Mock Browser */
.mock-browser { border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 60px rgba(0,0,0,0.5); margin-bottom: 16px; }
.mock-bar { background: #1a1f2e; padding: 10px 16px; display: flex; align-items: center; gap: 6px; }
.mock-dot { width: 10px; height: 10px; border-radius: 50%; }
.mock-dot.red { background: #ff5f57; }
.mock-dot.yellow { background: #febc2e; }
.mock-dot.green { background: #28c840; }
.mock-url { margin-left: 12px; font-size: 11px; color: #4a5568; font-family: monospace; }
.mock-content { background: #0d1117; min-height: 340px; }

/* Dashboard */
.mock-content.dash { display: flex; }
.mock-sidebar { width: 160px; background: #111827; padding: 16px 10px; flex-shrink: 0; }
.mock-logo-sm { color: #00e5ff; font-weight: 900; font-size: 16px; margin-bottom: 20px; padding: 0 4px; }
.mock-nav-item { padding: 7px 8px; border-radius: 6px; font-size: 11px; color: #4a5568; margin-bottom: 4px; cursor: default; }
.mock-nav-item.active-nav { background: rgba(0,229,255,0.1); color: #00e5ff; }
.mock-main { flex: 1; padding: 16px; }
.mock-header-bar { margin-bottom: 16px; }
.mock-title-text { font-size: 13px; font-weight: 700; color: #e2e8f0; }
.mock-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px; }
.mock-kpi { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 10px 8px; text-align: center; }
.mock-kpi-val { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
.mock-kpi-val.cyan { color: #00e5ff; }
.mock-kpi-val.green { color: #48bb78; }
.mock-kpi-val.yellow { color: #ffd600; }
.mock-kpi-val.blue { color: #63b3ed; }
.mock-kpi-lbl { font-size: 9px; color: #4a5568; }
.mock-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mock-chart { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; }
.mock-chart-title { font-size: 10px; color: #718096; margin-bottom: 8px; }
.bar-wrap { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #718096; }
.bar-fill { height: 8px; border-radius: 4px; transition: width .3s; }
.line-svg { width: 100%; height: 60px; }

/* Rota */
.mock-content.rota { position: relative; display: flex; flex-direction: column; }
.mock-map-bg { position: relative; background: linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%); height: 240px; overflow: hidden; }
.map-svg { width: 100%; height: 100%; }
.map-labels { position: absolute; top: 12px; left: 12px; display: flex; flex-direction: column; gap: 6px; }
.map-badge { background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 4px 10px; font-size: 11px; color: #e2e8f0; backdrop-filter: blur(4px); }
.map-info { background: rgba(0,229,255,0.1); border: 1px solid rgba(0,229,255,0.3); border-radius: 20px; padding: 4px 10px; font-size: 11px; color: #00e5ff; }
.mock-posto-list { padding: 12px 16px; background: #111827; }
.mock-posto-title { font-size: 11px; color: #718096; margin-bottom: 8px; font-weight: 600; }
.mock-posto { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px; }
.posto-rank { font-weight: 800; font-size: 11px; width: 24px; }
.posto-rank.gold { color: #ffd600; }
.posto-rank.silver { color: #a0aec0; }
.posto-rank.bronze { color: #ed8936; }
.posto-nome { flex: 1; color: #e2e8f0; }
.posto-preco { font-weight: 700; color: #718096; }
.posto-preco.cyan { color: #00e5ff; }

/* IA */
.mock-content.ia { padding: 16px; }
.ia-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px 16px; background: linear-gradient(135deg, #1a1040, #0d1a3a); border: 1px solid rgba(127,119,221,0.3); border-radius: 12px; }
.ia-logo-circle { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #534AB7, #7F77DD); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; color: #fff; flex-shrink: 0; }
.ia-title { font-size: 13px; font-weight: 700; color: #e2e8f0; }
.ia-sub { font-size: 10px; color: #7F77DD; }
.ia-chat { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.ia-msg { padding: 8px 12px; border-radius: 10px; font-size: 12px; max-width: 85%; line-height: 1.5; }
.ia-msg.user { background: rgba(127,119,221,0.15); color: #c4b5fd; align-self: flex-end; border-radius: 10px 10px 2px 10px; }
.ia-msg.bot { background: rgba(255,255,255,0.05); color: #e2e8f0; align-self: flex-start; border-radius: 10px 10px 10px 2px; }
.ia-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 700; background: #1a4731; color: #48bb78; margin-right: 6px; }
.ia-badge.alert { background: #4a1a1a; color: #fc8181; }
.ia-cursor { animation: blink 1s infinite; color: #00e5ff; }
@keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
.ia-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.ia-chip { padding: 5px 12px; border-radius: 16px; border: 1px solid rgba(127,119,221,0.3); font-size: 11px; color: #a0aec0; cursor: pointer; }

/* Rotograma */
.mock-content.rg { padding: 16px; }
.rg-header { font-size: 14px; font-weight: 700; color: #00e5ff; margin-bottom: 14px; }
.rg-body { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rg-section-title { font-size: 11px; font-weight: 700; color: #718096; margin-bottom: 8px; }
.rg-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 8px; margin-bottom: 6px; font-size: 11px; }
.rg-item.danger { background: rgba(231,76,60,0.1); border-left: 3px solid #E74C3C; }
.rg-item.crime { background: rgba(192,57,43,0.1); border-left: 3px solid #C0392B; }
.rg-item.warn { background: rgba(230,126,34,0.1); border-left: 3px solid #E67E22; }
.rg-item.stop { background: rgba(0,229,255,0.05); border-left: 3px solid #00e5ff44; }
.rg-icon { font-size: 14px; flex-shrink: 0; }
.rg-loc { color: #e2e8f0; font-weight: 600; margin-bottom: 2px; }
.rg-detail { color: #718096; }
.rg-emergency { margin-top: 12px; padding: 8px 10px; background: rgba(0,229,255,0.08); border-radius: 8px; font-size: 11px; color: #00e5ff; font-weight: 600; }

/* Caption */
.demo-caption { text-align: center; color: #718096; font-size: 14px; padding: 0 20px; }
.demo-caption strong { color: #e2e8f0; }

/* Responsive */
@media (max-width: 640px) {
  .mock-content.dash { flex-direction: column; }
  .mock-sidebar { width: 100%; display: flex; gap: 8px; overflow-x: auto; padding: 8px; }
  .mock-kpis { grid-template-columns: repeat(2,1fr); }
  .mock-charts { grid-template-columns: 1fr; }
  .rg-body { grid-template-columns: 1fr; }
  .demo-tab { font-size: 11px; padding: 8px 12px; }
}
</style>

<!-- Fase corrige-toggle-idioma-landing — pedido do Daniel: "ao clicar em EN,
     a página não atualiza para english". Causa raiz: existiam DOIS scripts
     de demo animado concorrentes aqui (um mais antigo, referenciando classes
     .demo-panel/.demo-tab e um elemento #demo-caption2 que já não existem
     mais no HTML atual, e um mais novo usando #dp0-#dp3/#demo-cap2, que É o
     que está de fato na página). O script antigo quebrava com erro
     (TypeError: Cannot set properties of null) assim que a página carregava
     — removido abaixo. Isso por si só não impedia a troca de idioma, mas o
     script novo (mantido, ver abaixo) tentava ler a variável _lang antes
     dela existir (só é declarada no script de i18n, que vem depois no
     documento), o que jogava um ReferenceError e interrompia aquele script
     ANTES de registrar seu listener de carregamento — e esse mesmo erro
     encadeava outro (undefined[0]) dentro da própria função de troca de
     idioma (_applyLang), interrompendo-a antes de marcar visualmente qual
     botão (PT/EN) está ativo. Corrigido: o script abaixo agora só define os
     textos iniciais em português (o _applyLang, chamado no carregamento da
     página e a cada clique, já corrige pro idioma certo logo depois) —
     nenhum dos dois scripts precisa mais adivinhar o idioma antes da hora. -->

<style>
.dtab2{padding:9px 18px;border-radius:24px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#718096;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
.dtab2:hover{border-color:#00e5ff;color:#00e5ff}
.dtab2.dtab-on{background:rgba(0,229,255,0.12);border-color:#00e5ff;color:#00e5ff}
.dp2{animation:fadeUp2 .3s ease}
@keyframes fadeUp2{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes blink2{0%,49%{opacity:1}50%,100%{opacity:0}}
</style>

<section id="demo" style="padding:80px 0;background:rgba(0,0,0,0.2)">
<div class="container">
<div style="text-align:center;margin-bottom:40px">
  <div style="color:#00e5ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px" data-i18n="demo_lbl">Plataforma em ação</div>
  <h2 style="font-size:clamp(1.6rem,3vw,2.2rem);font-weight:800;color:#fff;margin-bottom:12px" data-i18n="demo_title">Veja como funciona na prática</h2>
  <p style="color:#a0aec0;font-size:15px" data-i18n="demo_sub">Explore as principais funcionalidades da FNI Gestão de Frotas</p>
</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:28px">
  <button class="dtab2 dtab-on" onclick="sd(0)" data-i18n="demo_tab0">📈 Dashboard</button>
  <button class="dtab2" onclick="sd(1)" data-i18n="demo_tab1">🗺️ Consulta por Rota</button>
  <button class="dtab2" onclick="sd(2)" data-i18n="demo_tab2">🤖 Assistente IA</button>
  <button class="dtab2" onclick="sd(3)" data-i18n="demo_tab3">🗺️ Rotograma</button>
  <button class="dtab2" onclick="sd(4)" data-i18n="demo_tab4">🚚 Marketplace de Fretes</button>
  <button class="dtab2" onclick="sd(5)" data-i18n="demo_tab5">⭐ Reputação do Motorista</button>
  <button class="dtab2" onclick="sd(6)" data-i18n="demo_tab6">🎮 Missões e Fidelidade</button>
  <button class="dtab2" onclick="sd(7)" data-i18n="demo_tab7">🛡️ Antifraude</button>
  <button class="dtab2" onclick="sd(8)" data-i18n="demo_tab8">📱 App do Motorista</button>
</div>
<div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);box-shadow:0 24px 64px rgba(0,0,0,0.6)">
  <div style="background:#1a1f2e;padding:10px 16px;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(255,255,255,0.08)">
    <span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;display:inline-block"></span>
    <span style="width:10px;height:10px;border-radius:50%;background:#febc2e;display:inline-block"></span>
    <span style="width:10px;height:10px;border-radius:50%;background:#28c840;display:inline-block"></span>
    <span id="demo-url2" style="margin-left:12px;font-size:11px;color:#4a5568;font-family:monospace">fxgestaodefrotasonline.com</span>
  </div>
  <div id="dp0" style="background:#0d1117;display:flex;min-height:360px">
    <div style="width:155px;background:#111827;padding:14px 10px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.06)">
      <div style="color:#00e5ff;font-weight:900;font-size:16px;margin-bottom:20px;padding:0 4px">FNI</div>
      <div style="padding:7px 8px;border-radius:6px;background:rgba(0,229,255,0.1);color:#00e5ff;font-size:11px;font-weight:600;margin-bottom:4px">📈 Dashboard</div>
      <div style="padding:7px 8px;font-size:11px;color:#4a5568;margin-bottom:3px">🗺️ Por Rota</div>
      <div style="padding:7px 8px;font-size:11px;color:#4a5568;margin-bottom:3px">👥 Análise</div>
      <div style="padding:7px 8px;font-size:11px;color:#4a5568;margin-bottom:3px">📑 Relatórios</div>
      <div style="padding:7px 8px;font-size:11px;color:#4a5568;margin-bottom:3px">🤖 IA</div>
      <div style="padding:7px 8px;font-size:11px;color:#4a5568">🗺️ Rotograma</div>
    </div>
    <div style="flex:1;padding:16px;overflow:hidden">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px 8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#00e5ff;margin-bottom:4px">2.960</div><div style="font-size:9px;color:#4a5568">Postos ANP</div></div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px 8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#48bb78;margin-bottom:4px">1.284</div><div style="font-size:9px;color:#4a5568">Abastecimentos</div></div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px 8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#ffd600;margin-bottom:4px">R$6,42</div><div style="font-size:9px;color:#4a5568">Preço médio/L</div></div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px 8px;text-align:center"><div style="font-size:20px;font-weight:800;color:#9f7aea;margin-bottom:4px">18 UFs</div><div style="font-size:9px;color:#4a5568">Cobertura</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:#718096;margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Penetração por UF</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#718096"><span style="width:22px">SP</span><div style="height:9px;border-radius:5px;background:#00e5ff;width:85%"></div><span>85%</span></div>
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#718096"><span style="width:22px">MG</span><div style="height:9px;border-radius:5px;background:rgba(0,229,255,0.8);width:72%"></div><span>72%</span></div>
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#718096"><span style="width:22px">RS</span><div style="height:9px;border-radius:5px;background:rgba(0,229,255,0.6);width:61%"></div><span>61%</span></div>
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#718096"><span style="width:22px">PR</span><div style="height:9px;border-radius:5px;background:rgba(0,229,255,0.4);width:54%"></div><span>54%</span></div>
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#718096"><span style="width:22px">BA</span><div style="height:9px;border-radius:5px;background:rgba(0,229,255,0.25);width:43%"></div><span>43%</span></div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:#718096;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Evolução Diesel S-10</div>
          <svg viewBox="0 0 180 80" style="width:100%;height:70px">
            <defs><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#00e5ff" stop-opacity=".25"/><stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/></linearGradient></defs>
            <path d="M0,62 L30,58 L60,61 L90,50 L120,44 L150,40 L180,35" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linejoin="round"/>
            <path d="M0,62 L30,58 L60,61 L90,50 L120,44 L150,40 L180,35 L180,80 L0,80Z" fill="url(#lg2)"/>
            <text x="0" y="78" font-size="8" fill="#4a5568">Jan</text>
            <text x="55" y="78" font-size="8" fill="#4a5568">Mar</text>
            <text x="110" y="78" font-size="8" fill="#4a5568">Mai</text>
            <text x="148" y="33" font-size="9" fill="#00e5ff" font-weight="600">R$6,05</text>
          </svg>
        </div>
      </div>
    </div>
  </div>
  <div id="dp1" style="display:none;background:#0d1117">
    <div style="background:#111827;padding:10px 14px;display:grid;grid-template-columns:1fr 1fr 80px;gap:8px;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:7px 10px;font-size:12px;color:#e2e8f0">🟢 São Paulo, SP</div>
      <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:7px 10px;font-size:12px;color:#e2e8f0">🔴 Curitiba, PR</div>
      <div style="background:#00e5ff;border-radius:6px;padding:7px 10px;font-size:12px;font-weight:700;color:#0d1117;text-align:center">Buscar</div>
    </div>
    <div style="position:relative;height:240px;overflow:hidden;background:#1a2744">
      <svg viewBox="0 0 600 240" style="width:100%;height:100%" preserveAspectRatio="xMidYMid slice">
        <rect width="600" height="240" fill="#1a2744"/>
        <line x1="0" y1="60" x2="600" y2="60" stroke="#ffffff05" stroke-width="1"/>
        <line x1="0" y1="120" x2="600" y2="120" stroke="#ffffff05" stroke-width="1"/>
        <line x1="0" y1="180" x2="600" y2="180" stroke="#ffffff05" stroke-width="1"/>
        <line x1="150" y1="0" x2="150" y2="240" stroke="#ffffff05" stroke-width="1"/>
        <line x1="300" y1="0" x2="300" y2="240" stroke="#ffffff05" stroke-width="1"/>
        <line x1="450" y1="0" x2="450" y2="240" stroke="#ffffff05" stroke-width="1"/>
        <path d="M70,200 C130,175 200,150 270,122 C340,94 420,70 500,48 C530,40 550,36 570,32" fill="none" stroke="#00e5ff" stroke-width="9" opacity="0.1" stroke-linecap="round"/>
        <path d="M70,200 C130,175 200,150 270,122 C340,94 420,70 500,48 C530,40 550,36 570,32" fill="none" stroke="#00e5ff" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1000" stroke-dashoffset="1000">
          <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="2s" fill="freeze"/>
        </path>
        <g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".3s" begin="0.9s" fill="freeze"/>
          <circle cx="180" cy="163" r="8" fill="#00e5ff"/>
          <circle cx="180" cy="163" r="16" fill="none" stroke="#00e5ff" stroke-width="1.5"><animate attributeName="r" from="8" to="24" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/></circle>
          <rect x="190" y="149" width="68" height="16" rx="8" fill="rgba(0,0,0,0.85)"/>
          <text x="224" y="161" text-anchor="middle" font-size="9" fill="#00e5ff" font-weight="700">R$5,66/L</text>
        </g>
        <g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".3s" begin="1.2s" fill="freeze"/>
          <circle cx="290" cy="117" r="8" fill="#00e5ff"/>
          <circle cx="290" cy="117" r="16" fill="none" stroke="#00e5ff" stroke-width="1.5"><animate attributeName="r" from="8" to="24" dur="2s" begin=".5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.4" to="0" dur="2s" begin=".5s" repeatCount="indefinite"/></circle>
          <rect x="300" y="103" width="60" height="16" rx="8" fill="rgba(0,0,0,0.85)"/>
          <text x="330" y="115" text-anchor="middle" font-size="9" fill="#00e5ff">R$5,90/L</text>
        </g>
        <g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".3s" begin="1.5s" fill="freeze"/>
          <circle cx="415" cy="72" r="8" fill="#ffd600"/>
          <rect x="425" y="58" width="60" height="16" rx="8" fill="rgba(0,0,0,0.85)"/>
          <text x="455" y="70" text-anchor="middle" font-size="9" fill="#ffd600">R$6,32/L</text>
        </g>
        <circle cx="70" cy="200" r="10" fill="#48bb78"/>
        <text x="70" y="204" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">O</text>
        <circle cx="570" cy="32" r="10" fill="#e74c3c"/>
        <text x="570" y="36" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">D</text>
      </svg>
      <div style="position:absolute;bottom:10px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:flex-end;pointer-events:none">
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:5px 12px;font-size:11px;color:#fff">🟢 São Paulo, SP</div>
          <div style="background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:5px 12px;font-size:11px;color:#fff">🔴 Curitiba, PR</div>
        </div>
        <div style="background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.4);border-radius:20px;padding:5px 14px;font-size:11px;color:#00e5ff;font-weight:600">⛽ 12 postos · 408 km · 4h 20min</div>
      </div>
    </div>
    <div style="padding:12px 16px;background:#111827">
      <div style="font-size:11px;color:#718096;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Melhores postos na rota — Diesel S-10</div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px"><span style="color:#ffd600;font-weight:800;width:24px;flex-shrink:0">1</span><span style="flex:1;color:#e2e8f0">Posto Dallas — Registro/SP</span><span style="color:#4a5568;font-size:10px;width:40px">2,1 km</span><span style="color:#00e5ff;font-weight:700;margin-right:6px">R$5,66/L</span><span style="background:rgba(72,187,120,0.15);color:#48bb78;padding:2px 8px;border-radius:10px;font-size:10px">-12% ANP</span></div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px"><span style="color:#a0aec0;font-weight:800;width:24px;flex-shrink:0">2</span><span style="flex:1;color:#e2e8f0">Auto Posto Kadoshi — Ponta Grossa/PR</span><span style="color:#4a5568;font-size:10px;width:40px">3,4 km</span><span style="color:#00e5ff;font-weight:700;margin-right:6px">R$5,90/L</span><span style="background:rgba(72,187,120,0.15);color:#48bb78;padding:2px 8px;border-radius:10px;font-size:10px">-8% ANP</span></div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:12px"><span style="color:#cd7f32;font-weight:800;width:24px;flex-shrink:0">3</span><span style="flex:1;color:#e2e8f0">Posto Muquém — Curitiba/PR</span><span style="color:#4a5568;font-size:10px;width:40px">1,8 km</span><span style="color:#00e5ff;font-weight:700;margin-right:6px">R$5,98/L</span><span style="background:rgba(72,187,120,0.15);color:#48bb78;padding:2px 8px;border-radius:10px;font-size:10px">-7% ANP</span></div>
    </div>
  </div>
  <div id="dp2" style="display:none;background:#0d1117;padding:16px;min-height:360px">
    <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:linear-gradient(135deg,#1a1040,#0d1a3a);border:1px solid rgba(127,119,221,0.3);border-radius:12px;margin-bottom:16px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#534AB7,#7F77DD);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#fff;flex-shrink:0">FNI</div>
      <div><div style="font-size:14px;font-weight:700;color:#e2e8f0">Assistente IA — FNI Insights</div><div style="font-size:11px;color:#7F77DD;margin-top:2px">Powered by Claude AI</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      <div style="padding:10px 14px;background:rgba(127,119,221,0.15);color:#c4b5fd;border-radius:12px 12px 2px 12px;font-size:13px;align-self:flex-end;max-width:88%;line-height:1.55">Qual foi meu maior gasto com combustível este mês?</div>
      <div style="padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#e2e8f0;border-radius:12px 12px 12px 2px;font-size:13px;max-width:88%;line-height:1.6"><span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:#1a4731;color:#48bb78;margin-right:5px">insight</span> Seu maior gasto foi com <strong style="color:#00e5ff">Diesel S-10</strong> — <strong style="color:#00e5ff">R$ 128.450</strong> em 847 abastecimentos em 3 estados. Oportunidade de <strong style="color:#48bb78">R$ 9.200/mês</strong> em economia.</div>
      <div style="padding:10px 14px;background:rgba(127,119,221,0.15);color:#c4b5fd;border-radius:12px 12px 2px 12px;font-size:13px;align-self:flex-end;max-width:88%;line-height:1.55">Onde estou perdendo mais dinheiro?</div>
      <div style="padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#e2e8f0;border-radius:12px 12px 12px 2px;font-size:13px;max-width:88%;line-height:1.6"><span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:#4a1a1a;color:#fc8181;margin-right:5px">alerta</span> 3 oportunidades: ES e GO pagam 9% acima da ANP, veículo PLB-3421 com consumo 22% abaixo da média, 47 abastecimentos fora do horário com preço 4% maior.</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <div style="padding:6px 14px;border-radius:20px;border:1px solid rgba(127,119,221,0.35);font-size:12px;color:#a0aec0">Quais veículos consomem mais?</div>
      <div style="padding:6px 14px;border-radius:20px;border:1px solid rgba(127,119,221,0.35);font-size:12px;color:#a0aec0">Compare com mês passado</div>
    </div>
  </div>
  <div id="dp3" style="display:none;background:#0d1117;padding:16px;min-height:360px">
    <div style="font-size:15px;font-weight:700;color:#00e5ff;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">Rotograma — SP → BH <span style="font-size:11px;color:#4a5568;font-weight:400;margin-left:8px">João Silva · ABC-1234</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:10px;font-weight:700;color:#718096;letter-spacing:.5px;margin-bottom:10px;text-transform:uppercase">Pontos de Risco (3)</div>
        <div style="padding:10px;border-radius:8px;border-left:3px solid #e24b4a;background:rgba(231,76,60,0.08);margin-bottom:7px"><div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:3px">BR-381 km 120 — Itatiaia/MG</div><div style="font-size:10px;color:#4a5568">Area de perigo · Vel. max 60 km/h</div></div>
        <div style="padding:10px;border-radius:8px;border-left:3px solid #993556;background:rgba(153,53,86,0.08);margin-bottom:7px"><div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:3px">BR-040 km 85 — Betim/MG</div><div style="font-size:10px;color:#4a5568">Zona de crime · Camera ativa</div></div>
        <div style="padding:10px;border-radius:8px;border-left:3px solid #ef9f27;background:rgba(239,159,39,0.08)"><div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:3px">SP-330 km 340 — Campinas/SP</div><div style="font-size:10px;color:#4a5568">Lombada/Radar · Vel. max 80 km/h</div></div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:#718096;letter-spacing:.5px;margin-bottom:10px;text-transform:uppercase">Pontos de Parada (3)</div>
        <div style="padding:10px;border-radius:8px;border-left:3px solid rgba(0,229,255,0.5);background:rgba(0,229,255,0.05);margin-bottom:7px"><div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:3px">Posto Ipiranga — km 210</div><div style="font-size:10px;color:#4a5568">Abastecimento · R$6,05/L · 24h</div></div>
        <div style="padding:10px;border-radius:8px;border-left:3px solid rgba(0,229,255,0.5);background:rgba(0,229,255,0.05);margin-bottom:7px"><div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:3px">Restaurante Rotatoria — km 310</div><div style="font-size:10px;color:#4a5568">Alimentacao · Aberto 24h</div></div>
        <div style="padding:10px;border-radius:8px;border-left:3px solid rgba(0,229,255,0.5);background:rgba(0,229,255,0.05)"><div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:3px">Hotel Rodovario BH — km 490</div><div style="font-size:10px;color:#4a5568">Pernoite seguro · (31) 3333-4444</div></div>
      </div>
      <div style="grid-column:1/-1;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.2);border-radius:8px;padding:10px 14px;font-size:12px;color:#00e5ff;font-weight:600;text-align:center">PRF 191 · SAMU 192 · Bombeiros 193 · PM 190 · ANTT 166</div>
    </div>
  </div>
  <div id="dp4" style="display:none;background:#0d1117;padding:16px;min-height:360px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">
      <div style="font-size:14px;font-weight:700;color:#00e5ff">Frete #1042 — São Paulo/SP → Curitiba/PR</div>
      <span style="background:rgba(0,229,255,0.12);color:#00e5ff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:12px;flex-shrink:0">Aberto a propostas</span>
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px">
      <div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;margin-bottom:10px">
          <div style="font-size:10px;color:#718096;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Dados do frete</div>
          <div style="font-size:12px;color:#e2e8f0;margin-bottom:6px">📍 Coleta: Av. Marginal, 1200 — Osasco/SP · 22/07 08h-10h</div>
          <div style="font-size:12px;color:#e2e8f0;margin-bottom:6px">📍 Entrega: Rod. BR-116, km 12 — Curitiba/PR · 23/07</div>
          <div style="font-size:12px;color:#e2e8f0;margin-bottom:6px">📦 Carga geral · 3,2t · 8m³ · Baú/Sider</div>
          <div style="font-size:12px;color:#00e5ff;font-weight:600">💰 Valor ofertado: R$ 2.850</div>
        </div>
        <div style="background:rgba(72,187,120,0.08);border:1px solid rgba(72,187,120,0.25);border-radius:8px;padding:12px 14px">
          <div style="font-size:10px;color:#48bb78;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">🧮 Calculadora de lucro</div>
          <div style="font-size:11px;color:#a0aec0">408 km · Diesel S-10 a R$5,84/L (ANP) · Consumo médio 3,2 km/L</div>
          <div style="font-size:13px;color:#48bb78;font-weight:700;margin-top:6px">Lucro estimado: R$ 2.106 (74%)</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#00e5ff,#1a56f0);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#04112e;flex-shrink:0">JS</div>
          <div><div style="font-size:12px;font-weight:700;color:#e2e8f0">João Silva</div><div style="font-size:10px;color:#718096">Parceiro há 8 meses</div></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
          <span style="background:rgba(72,187,120,0.12);color:#48bb78;font-size:10px;padding:3px 8px;border-radius:10px">✅ Verificado</span>
          <span style="background:rgba(255,255,255,0.06);color:#a0aec0;font-size:10px;padding:3px 8px;border-radius:10px">⭐ 4.9 (62)</span>
          <span style="background:rgba(0,229,255,0.1);color:#00e5ff;font-size:10px;padding:3px 8px;border-radius:10px">🏷️ Pontual</span>
          <span style="background:rgba(0,229,255,0.1);color:#00e5ff;font-size:10px;padding:3px 8px;border-radius:10px">🏷️ Cuidado com a carga</span>
        </div>
        <div style="font-size:11px;color:#718096;margin-bottom:4px">🪪 CNH válida · 📱 Telefone verificado · 🔒 2FA ativo</div>
        <div style="font-size:11px;color:#718096">📦 96% de conclusão · 📍 12 km até a coleta</div>
      </div>
    </div>
  </div>
  <div id="dp5" style="display:none;background:#0d1117;padding:16px;min-height:360px">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08)">
      <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#00e5ff,#1a56f0);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#04112e;flex-shrink:0">JS</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:#e2e8f0">João Silva</div>
        <div style="font-size:11px;color:#718096">Motorista parceiro · Cadastrado há 8 meses</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:22px;font-weight:800;color:#ffd600">⭐ 4.9</div>
        <div style="font-size:10px;color:#718096">62 avaliações</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#48bb78">96%</div><div style="font-size:9px;color:#4a5568">Conclusão</div></div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#00e5ff">184</div><div style="font-size:9px;color:#4a5568">Fretes concluídos</div></div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#9f7aea">✅</div><div style="font-size:9px;color:#4a5568">CNH válida</div></div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#48bb78">🔒</div><div style="font-size:9px;color:#4a5568">2FA ativo</div></div>
    </div>
    <div style="font-size:10px;color:#718096;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🏷️ Destaques automáticos (recorrentes em avaliações)</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
      <span style="background:rgba(0,229,255,0.1);color:#00e5ff;font-size:11px;padding:5px 12px;border-radius:14px">🏷️ Pontual (14)</span>
      <span style="background:rgba(0,229,255,0.1);color:#00e5ff;font-size:11px;padding:5px 12px;border-radius:14px">🏷️ Cuidado com a carga (11)</span>
      <span style="background:rgba(0,229,255,0.1);color:#00e5ff;font-size:11px;padding:5px 12px;border-radius:14px">🏷️ Comunicativo (7)</span>
    </div>
    <div style="font-size:10px;color:#718096;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Últimas avaliações</div>
    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:11px;color:#a0aec0">⭐⭐⭐⭐⭐ "Muito pontual e cuidadoso com a carga, recomendo." — Transportes Alfa</div>
    <div style="padding:8px 0;font-size:11px;color:#a0aec0">⭐⭐⭐⭐⭐ "Comunicação excelente durante toda a viagem." — Distribuidora Sul</div>
  </div>
  <div id="dp6" style="display:none;background:#0d1117;padding:16px;min-height:360px">
    <div style="font-size:14px;font-weight:700;color:#00e5ff;margin-bottom:14px">🎮 Missões da Rede — Julho/2026</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px"><div style="font-size:12px;font-weight:600;color:#e2e8f0">Complete 10 fretes este mês</div><div style="font-size:11px;color:#ffd600;font-weight:700;flex-shrink:0">🎁 R$ 200 de bônus</div></div>
        <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden"><div style="height:100%;width:70%;background:#00e5ff;border-radius:4px"></div></div>
        <div style="font-size:10px;color:#718096;margin-top:4px">7 de 10 concluídos</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px"><div style="font-size:12px;font-weight:600;color:#e2e8f0">Mantenha nota acima de 4.8</div><div style="font-size:11px;color:#ffd600;font-weight:700;flex-shrink:0">🎁 Selo Ouro</div></div>
        <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden"><div style="height:100%;width:100%;background:#48bb78;border-radius:4px"></div></div>
        <div style="font-size:10px;color:#718096;margin-top:4px">Concluída — nota atual 4.9</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px"><div style="font-size:12px;font-weight:600;color:#e2e8f0">Missão da rede: 50 fretes entre parceiros</div><div style="font-size:11px;color:#ffd600;font-weight:700;flex-shrink:0">🎁 Desconto em oficinas</div></div>
        <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden"><div style="height:100%;width:38%;background:#9f7aea;border-radius:4px"></div></div>
        <div style="font-size:10px;color:#718096;margin-top:4px">19 de 50 — toda a rede de motoristas parceiros contribui</div>
      </div>
    </div>
    <div style="margin-top:14px;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.2);border-radius:8px;padding:10px 14px;font-size:11px;color:#00e5ff">🏪 Parcerias locais desbloqueadas: 15% off na Borracharia Central e no Restaurante do Caminhoneiro</div>
  </div>
  <div id="dp7" style="display:none;background:#0d1117;padding:16px;min-height:360px">
    <div style="font-size:14px;font-weight:700;color:#00e5ff;margin-bottom:14px">🛡️ Alertas Antifraude — últimas 24h</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(231,76,60,0.08);border-left:3px solid #e74c3c">
        <div style="font-size:15px">🚨</div>
        <div><div style="font-size:12px;font-weight:600;color:#e2e8f0">Abastecimento 41% acima da média do veículo</div><div style="font-size:10px;color:#4a5568">Veículo PLB-3421 · Posto Estrela — 02h14 · Sinalizado para revisão</div></div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(230,126,34,0.08);border-left:3px solid #e67e22">
        <div style="font-size:15px">⚠️</div>
        <div><div style="font-size:12px;font-weight:600;color:#e2e8f0">Rota com desvio de 28 km sem justificativa</div><div style="font-size:10px;color:#4a5568">Frete #1038 · Motorista Carlos M. · Aguardando confirmação</div></div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(0,229,255,0.05);border-left:3px solid #00e5ff44">
        <div style="font-size:15px">✅</div>
        <div><div style="font-size:12px;font-weight:600;color:#e2e8f0">Abastecimento fora do horário revisado e aprovado</div><div style="font-size:10px;color:#4a5568">Veículo ABC-1234 · Confirmado pelo gestor de frota</div></div>
      </div>
    </div>
    <div style="margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#e74c3c">3</div><div style="font-size:9px;color:#4a5568">Alertas ativos</div></div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#48bb78">R$ 4.180</div><div style="font-size:9px;color:#4a5568">Economizado no mês</div></div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:#00e5ff">100%</div><div style="font-size:9px;color:#4a5568">Abastecimentos monitorados</div></div>
    </div>
  </div>
  <div id="dp8" style="display:none;background:#0d1117;padding:24px 16px;min-height:360px">
    <div style="display:flex;justify-content:center">
      <div style="width:230px;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:22px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,0.5)">
        <div style="text-align:center;font-size:10px;color:#4a5568;margin-bottom:10px">📱 App do Motorista</div>
        <div style="background:linear-gradient(135deg,#1a1040,#0d1a3a);border:1px solid rgba(0,229,255,0.25);border-radius:12px;padding:12px;margin-bottom:10px;text-align:center">
          <div style="font-size:10px;color:#a0aec0">Programa de Fidelidade</div>
          <div style="font-size:22px;font-weight:800;color:#ffd600;margin:4px 0">2.480 pts</div>
          <div style="font-size:9px;color:#48bb78">+120 pts nesta semana</div>
        </div>
        <div style="font-size:10px;color:#718096;font-weight:700;text-transform:uppercase;margin-bottom:6px">Próxima meta</div>
        <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;margin-bottom:10px">
          <div style="font-size:11px;color:#e2e8f0;margin-bottom:6px">Complete 10 fretes → R$ 200</div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.08)"><div style="height:100%;width:70%;background:#00e5ff;border-radius:3px"></div></div>
        </div>
        <div style="font-size:10px;color:#718096;font-weight:700;text-transform:uppercase;margin-bottom:6px">Parcerias desbloqueadas</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#a0aec0;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 8px"><span>🔧 Oficina Central</span><span style="color:#48bb78">-15%</span></div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#a0aec0;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 8px"><span>🍽️ Rest. do Caminhoneiro</span><span style="color:#48bb78">-10%</span></div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#a0aec0;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 8px"><span>🛞 Borracharia Rota Segura</span><span style="color:#48bb78">-20%</span></div>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="demo-cap2" style="text-align:center;color:#a0aec0;font-size:14px;margin-top:20px;padding:0 20px;line-height:1.7"><strong style="color:#fff">Dashboard Analitico</strong> — Visao consolidada de abastecimentos reais, cobertura por UF e comparativo ANP em tempo real.</div>
</div>
</section>
<style>
.dtab2{padding:9px 20px;border-radius:24px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#718096;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;outline:none}
.dtab2:hover{border-color:#00e5ff;color:#00e5ff}
.dtab2.dtab-on{background:rgba(0,229,255,0.12);border-color:#00e5ff;color:#00e5ff}
</style>
<script data-cfasync="false">
// Fase remove-toggle-idioma-landing (19/07) — pedido do Daniel: o toggle
// PT/EN nunca funcionou de forma confiável em produção (Cloudflare Rocket
// Loader reordenando a execução dos <script>, entre outras tentativas de
// correção que não resolveram de vez) — em vez de continuar caçando causa
// raiz numa camada fora do nosso controle, a landing agora é só em
// português. Os arrays _u2/_cp2 (usados pelo demo animado) não têm mais
// variante EN.
var _u2=["fxgestaodefrotasonline.com - Dashboard Analítico","fxgestaodefrotasonline.com - Consulta por Rota","fxgestaodefrotasonline.com - Assistente IA","fxgestaodefrotasonline.com - Rotograma de Segurança","fxgestaodefrotasonline.com - Marketplace de Fretes","fxgestaodefrotasonline.com - Reputação do Motorista","fxgestaodefrotasonline.com - Missões e Fidelidade","fxgestaodefrotasonline.com - Antifraude","fxgestaodefrotasonline.com - App do Motorista"];
var _cp2=["<strong style='color:#fff'>Dashboard Analitico</strong> — Visao consolidada de abastecimentos reais, cobertura por UF e evolucao de precos.","<strong style='color:#fff'>Consulta por Rota</strong> — Mapa interativo com os melhores postos ANP ao longo da rota, com precos e distancias.","<strong style='color:#fff'>Assistente IA</strong> — Converse em linguagem natural com IA especializada em frotas.","<strong style='color:#fff'>Rotograma de Seguranca</strong> — Mapeie riscos, paradas e contatos de emergencia.","<strong style='color:#fff'>Marketplace de Fretes</strong> — Cliente publica o frete completo, motorista ve a reputacao e simula o lucro antes de aceitar.","<strong style='color:#fff'>Reputacao do Motorista</strong> — Nota, selos de verificacao e destaques automaticos, tudo num so perfil.","<strong style='color:#fff'>Missoes e Fidelidade</strong> — Metas com premios pra motoristas parceiros, individuais ou de toda a rede.","<strong style='color:#fff'>Antifraude</strong> — Regras automaticas sinalizam abastecimentos e rotas fora do padrao.","<strong style='color:#fff'>App do Motorista</strong> — Pontos, metas e parcerias locais direto no bolso do motorista."];
var _c2=0,_t2;
var _dpIds=["dp0","dp1","dp2","dp3","dp4","dp5","dp6","dp7","dp8"];
function sd(i){
  clearInterval(_t2);_c2=i;
  _dpIds.forEach(function(id,j){
    var el=document.getElementById(id);
    if(el)el.style.display=j===i?"block":"none";
  });
  document.querySelectorAll(".dtab2").forEach(function(t,j){t.classList.toggle("dtab-on",j===i);});
  var u=document.getElementById("demo-url2");if(u)u.textContent=_u2[i];
  var c=document.getElementById("demo-cap2");if(c)c.innerHTML=_cp2[i];
  _t2=setInterval(function(){sd((_c2+1)%_dpIds.length);},7000);
}
document.addEventListener("DOMContentLoaded",function(){sd(0);});
</script>

<section class="section" id="func">
  <div class="sec-lbl" data-i18n="func_lbl">Funcionalidades</div>
  <div class="sec-title" data-i18n-html="func_title">Tudo que sua frota precisa,<br>em um só lugar</div>
  <p class="sec-sub" data-i18n="func_sub">Da análise de preços à gestão completa — dados em tempo real para decisões melhores.</p>
  <div class="grid">
    <div class="card"><div class="icon">📊</div><div class="ct" data-i18n="card0_t">Preços ANP em Tempo Real</div><div class="cd" data-i18n="card0_d">Compare os preços praticados pelos postos com a tabela oficial da ANP por município e bandeira.</div></div>
    <div class="card"><div class="icon">🗺️</div><div class="ct" data-i18n="card1_t">Mapa de Rede de Postos</div><div class="cd" data-i18n="card1_d">Visualize todos os postos credenciados na sua rota com scores de qualidade e preços negociados.</div></div>
    <div class="card"><div class="icon">⛽</div><div class="ct" data-i18n="card2_t">Telemetria de Frota</div><div class="cd" data-i18n="card2_d">Monitore consumo real por veículo e detecte desvios com alertas automáticos.</div></div>
    <div class="card"><div class="icon">💰</div><div class="ct" data-i18n="card3_t">Acordos de Preços</div><div class="cd" data-i18n="card3_d">Gerencie contratos com postos e valide automaticamente se os preços respeitam os acordos.</div></div>
    <div class="card"><div class="icon">📈</div><div class="ct" data-i18n="card4_t">Relatórios Avançados</div><div class="cd" data-i18n="card4_d">Análises de consumo, custo por km e ranking de postos. Exporte para Excel ou integre via API.</div></div>
    <div class="card"><div class="icon">🔌</div><div class="ct" data-i18n="card5_t">Integrações Nativas</div><div class="cd" data-i18n="card5_d">Conecte com TOTVS, SAP, rastreadores (Sascar, Onix, Autotrac) e valide NF-e pela SEFAZ.</div></div>
    <div class="card"><div class="icon">🎮</div><div class="ct" data-i18n="card6_t">Missões e Fidelidade</div><div class="cd" data-i18n="card6_d">Crie metas com prêmios pros motoristas parceiros, dentro da sua rede ou em conjunto com outras empresas do mesmo grupo econômico.</div></div>
    <div class="card"><div class="icon">🏪</div><div class="ct" data-i18n="card7_t">Parcerias Locais</div><div class="cd" data-i18n="card7_d">Conecte sua rede a comércios locais — borracharia, oficina, restaurante — com benefícios exclusivos pros motoristas.</div></div>
    <div class="card"><div class="icon">🛡️</div><div class="ct" data-i18n="card8_t">Antifraude</div><div class="cd" data-i18n="card8_d">Regras automáticas sinalizam abastecimentos e rotas fora do padrão antes que virem prejuízo.</div></div>
  </div>
</section>

<section class="section" id="fretes">
  <div class="sec-lbl" data-i18n="fretes_lbl">Marketplace de Fretes</div>
  <div class="sec-title" data-i18n-html="fretes_title">Conecte cargas e motoristas,<br>com segurança pros dois lados</div>
  <p class="sec-sub" data-i18n="fretes_sub">Cliente publica o frete com endereço completo e prazo; motorista decide com dados reais antes de aceitar. Negociação, execução e avaliação — tudo dentro da mesma plataforma, sem intermediário.</p>
  <div class="grid">
    <div class="card"><div class="icon">📋</div><div class="ct" data-i18n="frcard0_t">Frete com dados completos</div><div class="cd" data-i18n="frcard0_d">Endereço estruturado de coleta e entrega, dimensões da carga, datas e horários — o motorista decide com informação real antes de aceitar.</div></div>
    <div class="card"><div class="icon">⭐</div><div class="ct" data-i18n="frcard1_t">Reputação do motorista</div><div class="cd" data-i18n="frcard1_d">Nota, taxa de conclusão, CNH válida, telefone e autenticação em duas etapas verificados — o cliente vê tudo antes de negociar.</div></div>
    <div class="card"><div class="icon">🧮</div><div class="ct" data-i18n="frcard2_t">Calculadora de lucro</div><div class="cd" data-i18n="frcard2_d">O motorista simula o custo de combustível da viagem com o preço médio ANP da região antes de decidir se vale a pena aceitar.</div></div>
    <div class="card"><div class="icon">🚛</div><div class="ct" data-i18n="frcard3_t">Filtro por veículo e carroceria</div><div class="cd" data-i18n="frcard3_d">Motorista vê só os fretes compatíveis com o veículo que tem; cliente restringe o frete pro tipo de carroceria certo.</div></div>
    <div class="card"><div class="icon">📍</div><div class="ct" data-i18n="frcard4_t">Distância até a coleta</div><div class="cd" data-i18n="frcard4_d">Antes de aceitar, o motorista vê quantos km faltam até o ponto de coleta — geolocalização em tempo real, sem letra miúda.</div></div>
    <div class="card"><div class="icon">🏷️</div><div class="ct" data-i18n="frcard5_t">Destaques automáticos</div><div class="cd" data-i18n="frcard5_d">Motoristas com elogios recorrentes — pontual, cuidado com a carga, comunicativo — ganham selos automáticos no perfil.</div></div>
  </div>
  <div style="text-align:center;margin-top:40px">
    <a href="/cadastro" class="btn-s" data-i18n="fretes_cta">🚚 Publicar meu primeiro frete →</a>
  </div>
</section>

<section class="section" id="integracoes">
  <div class="sec-lbl" data-i18n="integracoes_lbl">Hub Multiprestadores</div>
  <div class="sec-title" data-i18n="integracoes_title">Um único hub para todos os meios de pagamento da sua frota</div>
  <p class="sec-sub" data-i18n="integracoes_sub">Chega de operar cada meio de pagamento separadamente. A FNI conecta a operação da sua empresa diretamente aos principais players de meios de pagamento para frotas — como Ticket Log e Edenred Mobilidade — e reúne tudo em um único lugar: gestão de abastecimentos, regras de consumo por veículo e conciliação automática de pagamentos, em uma interface só.</p>
  <div class="sec-title" style="font-size:1.3rem;margin-top:56px;margin-bottom:8px" data-i18n="integracoes_vant_title">Principais Vantagens da Integração</div>
  <div class="grid">
    <div class="card"><div class="icon">🔗</div><div class="ct" data-i18n="intcard0_t">Conexão Multiprestadores</div><div class="cd" data-i18n-html="intcard0_d">Integração direta com os maiores emissores de cartões e soluções de pagamento do mercado (como <a href="https://www.ticketlog.com.br/" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);text-decoration:underline">Ticket Log</a> ou <a href="https://www.edenredmobilidade.com.br/gestao-abastecimento/" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);text-decoration:underline">Edenred Mobilidade</a>, por exemplo).</div></div>
    <div class="card"><div class="icon">⚡</div><div class="ct" data-i18n="intcard1_t">Autorização em Tempo Real</div><div class="cd" data-i18n="intcard1_d">Validação instantânea de transações direto na bomba de combustível.</div></div>
    <div class="card"><div class="icon">🧾</div><div class="ct" data-i18n="intcard2_t">Conciliação Automatizada</div><div class="cd" data-i18n="intcard2_d">Eliminação de planilhas manuais, com importação automática de notas fiscais e cupons.</div></div>
    <div class="card"><div class="icon">🔒</div><div class="ct" data-i18n="intcard3_t">Segurança e Controle</div><div class="cd" data-i18n="intcard3_d">Travas de segurança contra desvios, limitando o valor, o tipo de combustível e a capacidade do tanque.</div></div>
  </div>
</section>

<section class="section" id="postos">
  <div class="sec-lbl" data-i18n="postos_lbl">Para Postos Revendedores</div>
  <div class="sec-title" data-i18n="postos_title">Sua rede de postos também opera na FNI</div>
  <p class="sec-sub" data-i18n="postos_sub">Se sua rede já abastece frotas que usam a FNI, você pode negociar preço e volume direto com esses clientes dentro da plataforma — sem planilha, sem WhatsApp perdido. Comece com 14 dias grátis num plano próprio para postos revendedores, com preços a partir de R$99/mês.</p>
  <div class="grid">
    <div class="card"><div class="icon">🤝</div><div class="ct" data-i18n="pocard0_t">Negocie direto com frotas</div><div class="cd" data-i18n="pocard0_d">Receba e responda propostas de preço e volume mínimo mensal direto na plataforma, sem intermediário.</div></div>
    <div class="card"><div class="icon">🧾</div><div class="ct" data-i18n="pocard1_t">Conciliação automática</div><div class="cd" data-i18n="pocard1_d">Abastecimentos e NF-e conciliados automaticamente com o ciclo de faturamento acordado com cada cliente.</div></div>
    <div class="card"><div class="icon">🌐</div><div class="ct" data-i18n="pocard2_t">Rede de Postos</div><div class="cd" data-i18n="pocard2_d">Agrupe todos os postos da sua bandeira ou grupo econômico numa assinatura única, paga pela matriz em nome de todos.</div></div>
    <div class="card"><div class="icon">💳</div><div class="ct" data-i18n="pocard3_t">Planos próprios para postos</div><div class="cd" data-i18n="pocard3_d">Trial de 14 dias grátis e depois planos e preços pensados pra revenda de combustíveis — não é o mesmo plano de frota com outro nome.</div></div>
  </div>
  <div style="text-align:center;margin-top:40px">
    <a href="#precos-postos" class="btn-p" data-i18n="postos_cta_precos">Ver planos para postos →</a>
    <a href="mailto:contato@fxgestaodefrotasonline.com" class="btn-s" data-i18n="postos_cta">💬 Falar com um especialista</a>
  </div>
</section>

<!-- INDICE_PRECOS_PLACEHOLDER -->

<section class="section" id="como" style="background:rgba(255,255,255,0.012)">
  <div class="sec-lbl" data-i18n="como_lbl">Como funciona</div>
  <div class="sec-title" data-i18n="como_title">Comece em minutos</div>
  <div class="steps">
    <div class="step"><div class="step-n">1</div><div class="step-t" data-i18n="step1_t">Cadastre sua empresa</div><div class="step-d" data-i18n="step1_d">14 dias grátis com acesso completo ao plano Profissional.</div></div>
    <div class="step"><div class="step-n">2</div><div class="step-t" data-i18n="step2_t">Importe sua frota</div><div class="step-d" data-i18n="step2_d">Cadastre veículos individualmente ou em lote via Excel.</div></div>
    <div class="step"><div class="step-n">3</div><div class="step-t" data-i18n="step3_t">Conecte seus dados</div><div class="step-d" data-i18n="step3_d">Integre com seu sistema ou registre via API.</div></div>
    <div class="step"><div class="step-n">4</div><div class="step-t" data-i18n="step4_t">Economize</div><div class="step-d" data-i18n="step4_d">Análises em tempo real para reduzir custos imediatamente.</div></div>
  </div>
</section>

<section class="section" id="acesso">
  <div class="sec-lbl" data-i18n="acesso_lbl">Acesse de Onde Estiver</div>
  <div class="sec-title" data-i18n="acesso_title">Web ou celular — você escolhe</div>
  <p class="sec-sub" data-i18n="acesso_sub">Gestão de frotas na palma da mão: acompanhe tudo pelo computador ou instale o app no celular pra ter agilidade de onde estiver.</p>
  <div class="acgrid">
    <div class="accard">
      <svg viewBox="0 0 200 200" role="img" aria-label="Painel web"><rect x="14" y="30" width="172" height="120" rx="8" fill="none" stroke="#00b4d8" stroke-width="3"/><rect x="14" y="30" width="172" height="18" rx="8" fill="#00b4d8" fill-opacity="0.15"/><circle cx="26" cy="39" r="3" fill="#00b4d8"/><circle cx="36" cy="39" r="3" fill="#00b4d8" fill-opacity="0.5"/><circle cx="46" cy="39" r="3" fill="#00b4d8" fill-opacity="0.3"/><rect x="28" y="66" width="60" height="34" rx="4" fill="#00b4d8" fill-opacity="0.12"/><rect x="96" y="66" width="60" height="34" rx="4" fill="#00b4d8" fill-opacity="0.12"/><rect x="28" y="108" width="128" height="30" rx="4" fill="#00b4d8" fill-opacity="0.08"/><rect x="70" y="160" width="60" height="10" rx="5" fill="#00b4d8" fill-opacity="0.3"/></svg>
      <div class="ct" data-i18n="accard0_t">Painel Web Completo</div>
      <div class="cd" data-i18n="accard0_d">Todos os recursos, ideal pra planejamento e análises no computador.</div>
      <a href="/login" class="acbtn" data-i18n="accard0_cta">Acessar plataforma →</a>
    </div>
    <div class="accard">
      <svg viewBox="0 0 130 200" role="img" aria-label="App do cliente e posto"><rect x="2" y="2" width="126" height="196" rx="16" fill="#111827"/><rect x="7" y="7" width="116" height="186" rx="12" fill="#0B1220"/><rect x="22" y="34" width="86" height="38" rx="8" fill="#ffffff"/><circle cx="36" cy="53" r="9" fill="#0E7490"/><circle cx="36" cy="53" r="3" fill="#0B1220"/><rect x="50" y="47" width="48" height="6" rx="3" fill="#0F2A4A"/><rect x="50" y="58" width="40" height="5" rx="2.5" fill="#0F2A4A"/><rect x="22" y="88" width="86" height="12" rx="3" fill="none" stroke="#3E4C63" stroke-width="1.5"/><rect x="22" y="106" width="86" height="12" rx="3" fill="none" stroke="#3E4C63" stroke-width="1.5"/><rect x="22" y="126" width="86" height="14" rx="4" fill="#0EA5E9"/></svg>
      <div class="ct" data-i18n="accard1_t">App do Cliente e Posto</div>
      <div class="cd" data-i18n="accard1_d">Abastecimentos, negociações e indicadores direto do celular — instale como um app nativo.</div>
      <a href="https://mobile.fxgestaodefrotasonline.com/" target="_blank" rel="noopener noreferrer" class="acbtn o" data-i18n="accard1_cta">Abrir app →</a>
      <div><img class="acqr" alt="QR code do app cliente/posto" src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 33 33'%3E%3Crect width='33' height='33' fill='%23fff'/%3E%3Cpath fill='%230B1220' d='M2,2H3V3H2zM3,2H4V3H3zM4,2H5V3H4zM5,2H6V3H5zM6,2H7V3H6zM7,2H8V3H7zM8,2H9V3H8zM13,2H14V3H13zM16,2H17V3H16zM17,2H18V3H17zM19,2H20V3H19zM20,2H21V3H20zM21,2H22V3H21zM24,2H25V3H24zM25,2H26V3H25zM26,2H27V3H26zM27,2H28V3H27zM28,2H29V3H28zM29,2H30V3H29zM30,2H31V3H30zM2,3H3V4H2zM8,3H9V4H8zM12,3H13V4H12zM13,3H14V4H13zM16,3H17V4H16zM17,3H18V4H17zM18,3H19V4H18zM20,3H21V4H20zM22,3H23V4H22zM24,3H25V4H24zM30,3H31V4H30zM2,4H3V5H2zM4,4H5V5H4zM5,4H6V5H5zM6,4H7V5H6zM8,4H9V5H8zM13,4H14V5H13zM14,4H15V5H14zM16,4H17V5H16zM17,4H18V5H17zM19,4H20V5H19zM24,4H25V5H24zM26,4H27V5H26zM27,4H28V5H27zM28,4H29V5H28zM30,4H31V5H30zM2,5H3V6H2zM4,5H5V6H4zM5,5H6V6H5zM6,5H7V6H6zM8,5H9V6H8zM12,5H13V6H12zM14,5H15V6H14zM20,5H21V6H20zM21,5H22V6H21zM24,5H25V6H24zM26,5H27V6H26zM27,5H28V6H27zM28,5H29V6H28zM30,5H31V6H30zM2,6H3V7H2zM4,6H5V7H4zM5,6H6V7H5zM6,6H7V7H6zM8,6H9V7H8zM11,6H12V7H11zM12,6H13V7H12zM13,6H14V7H13zM16,6H17V7H16zM17,6H18V7H17zM18,6H19V7H18zM20,6H21V7H20zM24,6H25V7H24zM26,6H27V7H26zM27,6H28V7H27zM28,6H29V7H28zM30,6H31V7H30zM2,7H3V8H2zM8,7H9V8H8zM10,7H11V8H10zM11,7H12V8H11zM13,7H14V8H13zM17,7H18V8H17zM18,7H19V8H18zM20,7H21V8H20zM21,7H22V8H21zM22,7H23V8H22zM24,7H25V8H24zM30,7H31V8H30zM2,8H3V9H2zM3,8H4V9H3zM4,8H5V9H4zM5,8H6V9H5zM6,8H7V9H6zM7,8H8V9H7zM8,8H9V9H8zM10,8H11V9H10zM12,8H13V9H12zM14,8H15V9H14zM16,8H17V9H16zM18,8H19V9H18zM20,8H21V9H20zM22,8H23V9H22zM24,8H25V9H24zM25,8H26V9H25zM26,8H27V9H26zM27,8H28V9H27zM28,8H29V9H28zM29,8H30V9H29zM30,8H31V9H30zM11,9H12V10H11zM17,9H18V10H17zM18,9H19V10H18zM19,9H20V10H19zM22,9H23V10H22zM2,10H3V11H2zM5,10H6V11H5zM7,10H8V11H7zM8,10H9V11H8zM10,10H11V11H10zM14,10H15V11H14zM15,10H16V11H15zM16,10H17V11H16zM17,10H18V11H17zM18,10H19V11H18zM22,10H23V11H22zM23,10H24V11H23zM25,10H26V11H25zM3,11H4V12H3zM6,11H7V12H6zM9,11H10V12H9zM10,11H11V12H10zM11,11H12V12H11zM12,11H13V12H12zM15,11H16V12H15zM18,11H19V12H18zM19,11H20V12H19zM22,11H23V12H22zM23,11H24V12H23zM24,11H25V12H24zM27,11H28V12H27zM30,11H31V12H30zM5,12H6V13H5zM6,12H7V13H6zM8,12H9V13H8zM9,12H10V13H9zM10,12H11V13H10zM13,12H14V13H13zM14,12H15V13H14zM16,12H17V13H16zM21,12H22V13H21zM23,12H24V13H23zM24,12H25V13H24zM25,12H26V13H25zM26,12H27V13H26zM27,12H28V13H27zM28,12H29V13H28zM29,12H30V13H29zM2,13H3V14H2zM4,13H5V14H4zM5,13H6V14H5zM10,13H11V14H10zM11,13H12V14H11zM12,13H13V14H12zM15,13H16V14H15zM17,13H18V14H17zM18,13H19V14H18zM20,13H21V14H20zM22,13H23V14H22zM23,13H24V14H23zM26,13H27V14H26zM28,13H29V14H28zM29,13H30V14H29zM2,14H3V15H2zM3,14H4V15H3zM4,14H5V15H4zM7,14H8V15H7zM8,14H9V15H8zM12,14H13V15H12zM15,14H16V15H15zM17,14H18V15H17zM18,14H19V15H18zM19,14H20V15H19zM23,14H24V15H23zM24,14H25V15H24zM27,14H28V15H27zM29,14H30V15H29zM30,14H31V15H30zM2,15H3V16H2zM3,15H4V16H3zM7,15H8V16H7zM9,15H10V16H9zM11,15H12V16H11zM13,15H14V16H13zM15,15H16V16H15zM19,15H20V16H19zM21,15H22V16H21zM22,15H23V16H22zM23,15H24V16H23zM2,16H3V17H2zM4,16H5V17H4zM5,16H6V17H5zM6,16H7V17H6zM7,16H8V17H7zM8,16H9V17H8zM10,16H11V17H10zM12,16H13V17H12zM15,16H16V17H15zM16,16H17V17H16zM18,16H19V17H18zM22,16H23V17H22zM23,16H24V17H23zM24,16H25V17H24zM25,16H26V17H25zM27,16H28V17H27zM28,16H29V17H28zM29,16H30V17H29zM30,16H31V17H30zM4,17H5V18H4zM5,17H6V18H5zM9,17H10V18H9zM12,17H13V18H12zM14,17H15V18H14zM15,17H16V18H15zM16,17H17V18H16zM18,17H19V18H18zM19,17H20V18H19zM21,17H22V18H21zM22,17H23V18H22zM25,17H26V18H25zM27,17H28V18H27zM29,17H30V18H29zM2,18H3V19H2zM3,18H4V19H3zM4,18H5V19H4zM8,18H9V19H8zM10,18H11V19H10zM13,18H14V19H13zM14,18H15V19H14zM17,18H18V19H17zM19,18H20V19H19zM21,18H22V19H21zM22,18H23V19H22zM29,18H30V19H29zM4,19H5V20H4zM7,19H8V20H7zM9,19H10V20H9zM10,19H11V20H10zM11,19H12V20H11zM14,19H15V20H14zM16,19H17V20H16zM18,19H19V20H18zM20,19H21V20H20zM23,19H24V20H23zM24,19H25V20H24zM25,19H26V20H25zM27,19H28V20H27zM30,19H31V20H30zM2,20H3V21H2zM6,20H7V21H6zM8,20H9V21H8zM10,20H11V21H10zM14,20H15V21H14zM19,20H20V21H19zM20,20H21V21H20zM23,20H24V21H23zM25,20H26V21H25zM29,20H30V21H29zM30,20H31V21H30zM4,21H5V22H4zM6,21H7V22H6zM7,21H8V22H7zM10,21H11V22H10zM13,21H14V22H13zM16,21H17V22H16zM19,21H20V22H19zM21,21H22V22H21zM22,21H23V22H22zM23,21H24V22H23zM26,21H27V22H26zM29,21H30V22H29zM30,21H31V22H30zM2,22H3V23H2zM5,22H6V23H5zM8,22H9V23H8zM9,22H10V23H9zM10,22H11V23H10zM12,22H13V23H12zM14,22H15V23H14zM15,22H16V23H15zM17,22H18V23H17zM18,22H19V23H18zM22,22H23V23H22zM23,22H24V23H23zM24,22H25V23H24zM25,22H26V23H25zM26,22H27V23H26zM28,22H29V23H28zM10,23H11V24H10zM11,23H12V24H11zM12,23H13V24H12zM14,23H15V24H14zM18,23H19V24H18zM21,23H22V24H21zM22,23H23V24H22zM26,23H27V24H26zM28,23H29V24H28zM29,23H30V24H29zM30,23H31V24H30zM2,24H3V25H2zM3,24H4V25H3zM4,24H5V25H4zM5,24H6V25H5zM6,24H7V25H6zM7,24H8V25H7zM8,24H9V25H8zM14,24H15V25H14zM18,24H19V25H18zM19,24H20V25H19zM22,24H23V25H22zM24,24H25V25H24zM26,24H27V25H26zM29,24H30V25H29zM2,25H3V26H2zM8,25H9V26H8zM10,25H11V26H10zM11,25H12V26H11zM12,25H13V26H12zM13,25H14V26H13zM15,25H16V26H15zM20,25H21V26H20zM22,25H23V26H22zM26,25H27V26H26zM27,25H28V26H27zM28,25H29V26H28zM29,25H30V26H29zM30,25H31V26H30zM2,26H3V27H2zM4,26H5V27H4zM5,26H6V27H5zM6,26H7V27H6zM8,26H9V27H8zM11,26H12V27H11zM16,26H17V27H16zM19,26H20V27H19zM22,26H23V27H22zM23,26H24V27H23zM24,26H25V27H24zM25,26H26V27H25zM26,26H27V27H26zM2,27H3V28H2zM4,27H5V28H4zM5,27H6V28H5zM6,27H7V28H6zM8,27H9V28H8zM10,27H11V28H10zM11,27H12V28H11zM12,27H13V28H12zM13,27H14V28H13zM19,27H20V28H19zM20,27H21V28H20zM24,27H25V28H24zM25,27H26V28H25zM26,27H27V28H26zM27,27H28V28H27zM28,27H29V28H28zM29,27H30V28H29zM2,28H3V29H2zM4,28H5V29H4zM5,28H6V29H5zM6,28H7V29H6zM8,28H9V29H8zM12,28H13V29H12zM13,28H14V29H13zM19,28H20V29H19zM22,28H23V29H22zM26,28H27V29H26zM27,28H28V29H27zM28,28H29V29H28zM30,28H31V29H30zM2,29H3V30H2zM8,29H9V30H8zM11,29H12V30H11zM13,29H14V30H13zM16,29H17V30H16zM17,29H18V30H17zM19,29H20V30H19zM22,29H23V30H22zM29,29H30V30H29zM2,30H3V31H2zM3,30H4V31H3zM4,30H5V31H4zM5,30H6V31H5zM6,30H7V31H6zM7,30H8V31H7zM8,30H9V31H8zM10,30H11V31H10zM12,30H13V31H12zM14,30H15V31H14zM15,30H16V31H15zM19,30H20V31H19zM22,30H23V31H22zM24,30H25V31H24zM25,30H26V31H25zM27,30H28V31H27zM29,30H30V31H29z'/%3E%3C/svg%3E" /></div>
    </div>
    <div class="accard">
      <svg viewBox="0 0 130 200" role="img" aria-label="App do motorista"><rect x="2" y="2" width="126" height="196" rx="16" fill="#111827"/><rect x="7" y="7" width="116" height="186" rx="12" fill="#F8FAFC"/><circle cx="65" cy="60" r="20" fill="none" stroke="#0E7490" stroke-width="3"/><circle cx="65" cy="60" r="6" fill="#0E7490"/><rect x="34" y="96" width="62" height="9" rx="3" fill="#0F2A4A"/><rect x="42" y="110" width="46" height="6" rx="3" fill="#8794A8"/><rect x="22" y="132" width="86" height="14" rx="4" fill="none" stroke="#94A3B8" stroke-width="1.5"/><rect x="22" y="152" width="86" height="14" rx="4" fill="#0EA5E9"/></svg>
      <div class="ct" data-i18n="accard2_t">App do Motorista</div>
      <div class="cd" data-i18n="accard2_d">"Estrada que Cuida" — abastecimentos, fretes, missões e benefícios pro motorista, no bolso.</div>
      <a href="https://estrada.fxgestaodefrotasonline.com/#/login" target="_blank" rel="noopener noreferrer" class="acbtn o" data-i18n="accard2_cta">Abrir app →</a>
      <div><img class="acqr" alt="QR code do app do motorista" src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 37 37'%3E%3Crect width='37' height='37' fill='%23fff'/%3E%3Cpath fill='%230B1220' d='M2,2H3V3H2zM3,2H4V3H3zM4,2H5V3H4zM5,2H6V3H5zM6,2H7V3H6zM7,2H8V3H7zM8,2H9V3H8zM11,2H12V3H11zM12,2H13V3H12zM24,2H25V3H24zM28,2H29V3H28zM29,2H30V3H29zM30,2H31V3H30zM31,2H32V3H31zM32,2H33V3H32zM33,2H34V3H33zM34,2H35V3H34zM2,3H3V4H2zM8,3H9V4H8zM10,3H11V4H10zM12,3H13V4H12zM15,3H16V4H15zM16,3H17V4H16zM18,3H19V4H18zM19,3H20V4H19zM22,3H23V4H22zM23,3H24V4H23zM24,3H25V4H24zM28,3H29V4H28zM34,3H35V4H34zM2,4H3V5H2zM4,4H5V5H4zM5,4H6V5H5zM6,4H7V5H6zM8,4H9V5H8zM10,4H11V5H10zM11,4H12V5H11zM12,4H13V5H12zM15,4H16V5H15zM18,4H19V5H18zM19,4H20V5H19zM20,4H21V5H20zM21,4H22V5H21zM23,4H24V5H23zM24,4H25V5H24zM26,4H27V5H26zM28,4H29V5H28zM30,4H31V5H30zM31,4H32V5H31zM32,4H33V5H32zM34,4H35V5H34zM2,5H3V6H2zM4,5H5V6H4zM5,5H6V6H5zM6,5H7V6H6zM8,5H9V6H8zM10,5H11V6H10zM13,5H14V6H13zM17,5H18V6H17zM23,5H24V6H23zM26,5H27V6H26zM28,5H29V6H28zM30,5H31V6H30zM31,5H32V6H31zM32,5H33V6H32zM34,5H35V6H34zM2,6H3V7H2zM4,6H5V7H4zM5,6H6V7H5zM6,6H7V7H6zM8,6H9V7H8zM12,6H13V7H12zM14,6H15V7H14zM17,6H18V7H17zM20,6H21V7H20zM23,6H24V7H23zM25,6H26V7H25zM26,6H27V7H26zM28,6H29V7H28zM30,6H31V7H30zM31,6H32V7H31zM32,6H33V7H32zM34,6H35V7H34zM2,7H3V8H2zM8,7H9V8H8zM11,7H12V8H11zM12,7H13V8H12zM13,7H14V8H13zM14,7H15V8H14zM16,7H17V8H16zM18,7H19V8H18zM22,7H23V8H22zM24,7H25V8H24zM28,7H29V8H28zM34,7H35V8H34zM2,8H3V9H2zM3,8H4V9H3zM4,8H5V9H4zM5,8H6V9H5zM6,8H7V9H6zM7,8H8V9H7zM8,8H9V9H8zM10,8H11V9H10zM12,8H13V9H12zM14,8H15V9H14zM16,8H17V9H16zM18,8H19V9H18zM20,8H21V9H20zM22,8H23V9H22zM24,8H25V9H24zM26,8H27V9H26zM28,8H29V9H28zM29,8H30V9H29zM30,8H31V9H30zM31,8H32V9H31zM32,8H33V9H32zM33,8H34V9H33zM34,8H35V9H34zM10,9H11V10H10zM11,9H12V10H11zM13,9H14V10H13zM14,9H15V10H14zM20,9H21V10H20zM25,9H26V10H25zM26,9H27V10H26zM2,10H3V11H2zM8,10H9V11H8zM10,10H11V11H10zM14,10H15V11H14zM15,10H16V11H15zM16,10H17V11H16zM17,10H18V11H17zM19,10H20V11H19zM22,10H23V11H22zM24,10H25V11H24zM26,10H27V11H26zM27,10H28V11H27zM28,10H29V11H28zM31,10H32V11H31zM32,10H33V11H32zM33,10H34V11H33zM2,11H3V12H2zM4,11H5V12H4zM6,11H7V12H6zM7,11H8V12H7zM10,11H11V12H10zM16,11H17V12H16zM17,11H18V12H17zM20,11H21V12H20zM21,11H22V12H21zM23,11H24V12H23zM24,11H25V12H24zM25,11H26V12H25zM30,11H31V12H30zM31,11H32V12H31zM32,11H33V12H32zM2,12H3V13H2zM3,12H4V13H3zM5,12H6V13H5zM8,12H9V13H8zM9,12H10V13H9zM11,12H12V13H11zM12,12H13V13H12zM14,12H15V13H14zM17,12H18V13H17zM20,12H21V13H20zM22,12H23V13H22zM23,12H24V13H23zM24,12H25V13H24zM26,12H27V13H26zM27,12H28V13H27zM28,12H29V13H28zM30,12H31V13H30zM32,12H33V13H32zM33,12H34V13H33zM2,13H3V14H2zM3,13H4V14H3zM5,13H6V14H5zM6,13H7V14H6zM7,13H8V14H7zM11,13H12V14H11zM13,13H14V14H13zM14,13H15V14H14zM16,13H17V14H16zM17,13H18V14H17zM22,13H23V14H22zM25,13H26V14H25zM26,13H27V14H26zM28,13H29V14H28zM29,13H30V14H29zM30,13H31V14H30zM31,13H32V14H31zM32,13H33V14H32zM33,13H34V14H33zM34,13H35V14H34zM3,14H4V15H3zM4,14H5V15H4zM6,14H7V15H6zM8,14H9V15H8zM9,14H10V15H9zM12,14H13V15H12zM14,14H15V15H14zM15,14H16V15H15zM16,14H17V15H16zM17,14H18V15H17zM18,14H19V15H18zM19,14H20V15H19zM20,14H21V15H20zM21,14H22V15H21zM22,14H23V15H22zM25,14H26V15H25zM26,14H27V15H26zM28,14H29V15H28zM29,14H30V15H29zM2,15H3V16H2zM4,15H5V16H4zM5,15H6V16H5zM6,15H7V16H6zM10,15H11V16H10zM12,15H13V16H12zM13,15H14V16H13zM16,15H17V16H16zM18,15H19V16H18zM22,15H23V16H22zM25,15H26V16H25zM26,15H27V16H26zM28,15H29V16H28zM31,15H32V16H31zM33,15H34V16H33zM34,15H35V16H34zM2,16H3V17H2zM5,16H6V17H5zM7,16H8V17H7zM8,16H9V17H8zM10,16H11V17H10zM14,16H15V17H14zM20,16H21V17H20zM21,16H22V17H21zM23,16H24V17H23zM27,16H28V17H27zM28,16H29V17H28zM33,16H34V17H33zM2,17H3V18H2zM5,17H6V18H5zM6,17H7V18H6zM7,17H8V18H7zM9,17H10V18H9zM10,17H11V18H10zM11,17H12V18H11zM12,17H13V18H12zM13,17H14V18H13zM16,17H17V18H16zM17,17H18V18H17zM21,17H22V18H21zM25,17H26V18H25zM27,17H28V18H27zM29,17H30V18H29zM30,17H31V18H30zM31,17H32V18H31zM32,17H33V18H32zM34,17H35V18H34zM2,18H3V19H2zM3,18H4V19H3zM4,18H5V19H4zM8,18H9V19H8zM12,18H13V19H12zM16,18H17V19H16zM18,18H19V19H18zM19,18H20V19H19zM21,18H22V19H21zM25,18H26V19H25zM27,18H28V19H27zM29,18H30V19H29zM30,18H31V19H30zM34,18H35V19H34zM2,19H3V20H2zM3,19H4V20H3zM7,19H8V20H7zM12,19H13V20H12zM13,19H14V20H13zM17,19H18V20H17zM18,19H19V20H18zM19,19H20V20H19zM20,19H21V20H20zM21,19H22V20H21zM22,19H23V20H22zM23,19H24V20H23zM25,19H26V20H25zM28,19H29V20H28zM31,19H32V20H31zM32,19H33V20H32zM34,19H35V20H34zM5,20H6V21H5zM8,20H9V21H8zM9,20H10V21H9zM10,20H11V21H10zM12,20H13V21H12zM15,20H16V21H15zM16,20H17V21H16zM17,20H18V21H17zM18,20H19V21H18zM21,20H22V21H21zM25,20H26V21H25zM26,20H27V21H26zM27,20H28V21H27zM28,20H29V21H28zM29,20H30V21H29zM31,20H32V21H31zM32,20H33V21H32zM34,20H35V21H34zM3,21H4V22H3zM5,21H6V22H5zM6,21H7V22H6zM7,21H8V22H7zM13,21H14V22H13zM14,21H15V22H14zM15,21H16V22H15zM16,21H17V22H16zM17,21H18V22H17zM18,21H19V22H18zM19,21H20V22H19zM20,21H21V22H20zM21,21H22V22H21zM22,21H23V22H22zM24,21H25V22H24zM27,21H28V22H27zM28,21H29V22H28zM30,21H31V22H30zM31,21H32V22H31zM32,21H33V22H32zM33,21H34V22H33zM34,21H35V22H34zM3,22H4V23H3zM5,22H6V23H5zM7,22H8V23H7zM8,22H9V23H8zM9,22H10V23H9zM16,22H17V23H16zM17,22H18V23H17zM18,22H19V23H18zM24,22H25V23H24zM26,22H27V23H26zM27,22H28V23H27zM29,22H30V23H29zM30,22H31V23H30zM31,22H32V23H31zM2,23H3V24H2zM4,23H5V24H4zM7,23H8V24H7zM9,23H10V24H9zM10,23H11V24H10zM13,23H14V24H13zM14,23H15V24H14zM16,23H17V24H16zM18,23H19V24H18zM19,23H20V24H19zM20,23H21V24H20zM22,23H23V24H22zM23,23H24V24H23zM24,23H25V24H24zM25,23H26V24H25zM26,23H27V24H26zM29,23H30V24H29zM30,23H31V24H30zM31,23H32V24H31zM2,24H3V25H2zM5,24H6V25H5zM8,24H9V25H8zM9,24H10V25H9zM10,24H11V25H10zM11,24H12V25H11zM12,24H13V25H12zM14,24H15V25H14zM17,24H18V25H17zM18,24H19V25H18zM19,24H20V25H19zM24,24H25V25H24zM27,24H28V25H27zM29,24H30V25H29zM30,24H31V25H30zM32,24H33V25H32zM33,24H34V25H33zM2,25H3V26H2zM7,25H8V26H7zM9,25H10V26H9zM10,25H11V26H10zM11,25H12V26H11zM16,25H17V26H16zM21,25H22V26H21zM22,25H23V26H22zM27,25H28V26H27zM29,25H30V26H29zM30,25H31V26H30zM31,25H32V26H31zM32,25H33V26H32zM34,25H35V26H34zM2,26H3V27H2zM3,26H4V27H3zM4,26H5V27H4zM5,26H6V27H5zM6,26H7V27H6zM8,26H9V27H8zM10,26H11V27H10zM11,26H12V27H11zM12,26H13V27H12zM14,26H15V27H14zM15,26H16V27H15zM16,26H17V27H16zM17,26H18V27H17zM18,26H19V27H18zM22,26H23V27H22zM26,26H27V27H26zM27,26H28V27H27zM28,26H29V27H28zM29,26H30V27H29zM30,26H31V27H30zM31,26H32V27H31zM33,26H34V27H33zM34,26H35V27H34zM10,27H11V28H10zM11,27H12V28H11zM14,27H15V28H14zM17,27H18V28H17zM18,27H19V28H18zM20,27H21V28H20zM21,27H22V28H21zM22,27H23V28H22zM25,27H26V28H25zM26,27H27V28H26zM30,27H31V28H30zM32,27H33V28H32zM33,27H34V28H33zM34,27H35V28H34zM2,28H3V29H2zM3,28H4V29H3zM4,28H5V29H4zM5,28H6V29H5zM6,28H7V29H6zM7,28H8V29H7zM8,28H9V29H8zM12,28H13V29H12zM17,28H18V29H17zM18,28H19V29H18zM20,28H21V29H20zM24,28H25V29H24zM25,28H26V29H25zM26,28H27V29H26zM28,28H29V29H28zM30,28H31V29H30zM32,28H33V29H32zM33,28H34V29H33zM2,29H3V30H2zM8,29H9V30H8zM12,29H13V30H12zM13,29H14V30H13zM22,29H23V30H22zM25,29H26V30H25zM26,29H27V30H26zM30,29H31V30H30zM31,29H32V30H31zM32,29H33V30H32zM33,29H34V30H33zM34,29H35V30H34zM2,30H3V31H2zM4,30H5V31H4zM5,30H6V31H5zM6,30H7V31H6zM8,30H9V31H8zM11,30H12V31H11zM16,30H17V31H16zM17,30H18V31H17zM20,30H21V31H20zM21,30H22V31H21zM24,30H25V31H24zM26,30H27V31H26zM27,30H28V31H27zM28,30H29V31H28zM29,30H30V31H29zM30,30H31V31H30zM31,30H32V31H31zM2,31H3V32H2zM4,31H5V32H4zM5,31H6V32H5zM6,31H7V32H6zM8,31H9V32H8zM12,31H13V32H12zM13,31H14V32H13zM14,31H15V32H14zM16,31H17V32H16zM18,31H19V32H18zM21,31H22V32H21zM22,31H23V32H22zM25,31H26V32H25zM27,31H28V32H27zM29,31H30V32H29zM30,31H31V32H30zM33,31H34V32H33zM34,31H35V32H34zM2,32H3V33H2zM4,32H5V33H4zM5,32H6V33H5zM6,32H7V33H6zM8,32H9V33H8zM12,32H13V33H12zM16,32H17V33H16zM18,32H19V33H18zM19,32H20V33H19zM21,32H22V33H21zM25,32H26V33H25zM26,32H27V33H26zM29,32H30V33H29zM30,32H31V33H30zM32,32H33V33H32zM33,32H34V33H33zM34,32H35V33H34zM2,33H3V34H2zM8,33H9V34H8zM12,33H13V34H12zM14,33H15V34H14zM16,33H17V34H16zM17,33H18V34H17zM18,33H19V34H18zM20,33H21V34H20zM27,33H28V34H27zM28,33H29V34H28zM29,33H30V34H29zM30,33H31V34H30zM31,33H32V34H31zM32,33H33V34H32zM2,34H3V35H2zM3,34H4V35H3zM4,34H5V35H4zM5,34H6V35H5zM6,34H7V35H6zM7,34H8V35H7zM8,34H9V35H8zM10,34H11V35H10zM15,34H16V35H15zM19,34H20V35H19zM21,34H22V35H21zM22,34H23V35H22zM24,34H25V35H24zM25,34H26V35H25zM26,34H27V35H26zM27,34H28V35H27zM28,34H29V35H28zM29,34H30V35H29zM33,34H34V35H33z'/%3E%3C/svg%3E" /></div>
    </div>
  </div>
  <div class="acsteps">
    <div class="acstep">
      <h4 data-i18n="acesso_ios_t">🍏 No iPhone (Safari)</h4>
      <p data-i18n-html="acesso_ios_d">1. Abra o link no <strong>Safari</strong>.<br>2. Toque no ícone de Compartilhar (⬆️).<br>3. Toque em "Adicionar à Tela de Início".<br>4. Confirme em "Adicionar".</p>
    </div>
    <div class="acstep">
      <h4 data-i18n="acesso_android_t">🤖 No Android (Chrome)</h4>
      <p data-i18n-html="acesso_android_d">1. Abra o link no <strong>Chrome</strong>.<br>2. Toque no menu (⋮).<br>3. Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".<br>4. Confirme — pronto.</p>
    </div>
  </div>
</section>

<section class="pricing" id="precos">
  <div style="text-align:center">
    <div class="sec-lbl" data-i18n="precos_lbl">Planos e Preços</div>
    <div class="sec-title" data-i18n="precos_title">Comece grátis. Cresça quando precisar.</div>
    <p class="sec-sub" style="margin:0 auto" data-i18n="precos_sub">Sem cartão de crédito. Cancele quando quiser.</p>
  </div>
  <div class="pgrid">
    <div class="pc"><div class="pn" data-i18n="plan0_n">Gratuito</div><div class="pp"><sup>R$</sup>0<span data-i18n="plan_mes">/mês</span></div><div class="pd" data-i18n="plan0_d">Para começar</div><ul class="pf"><li data-i18n="plan0_f1">1 usuário</li><li data-i18n="plan0_f2">10 veículos</li><li data-i18n="plan0_f3">2 postos</li><li class="off" data-i18n="plan_anp_hist">Histórico ANP</li><li class="off">Excel</li><li class="off">API</li></ul><a href="/cadastro" class="pbtn o" data-i18n="plan0_btn">Começar grátis</a></div>
    <div class="pc"><div class="pn" data-i18n="plan1_n">Essencial</div><div class="pp"><sup>R$</sup>249<span data-i18n="plan_mes">/mês</span></div><div class="pd" data-i18n="plan1_d">Pequenas frotas</div><ul class="pf"><li data-i18n="plan1_f1">5 usuários</li><li data-i18n="plan1_f2">20 veículos inclusos (+R$4,50/excedente)</li><li data-i18n="plan1_f3">Roteirização, Rotograma e Planos de Viagem</li><li data-i18n="plan1_f4">Inteligência de Rede</li><li data-i18n="plan1_f5">Exportação Excel</li><li class="off">Gestão de Fretes (TMS)</li></ul><a href="/cadastro" class="pbtn o" data-i18n="plan1_btn">Assinar Essencial</a></div>
    <div class="pc feat"><div class="pbadge" data-i18n="plan_popular">Mais popular</div><div class="pn" data-i18n="plan2_n">Profissional</div><div class="pp"><sup>R$</sup>549<span data-i18n="plan_mes">/mês</span></div><div class="pd" data-i18n="plan2_d">TMS para transportadoras</div><ul class="pf"><li data-i18n="plan2_f1">20 usuários</li><li data-i18n="plan2_f2">60 veículos inclusos (+R$3,50/excedente)</li><li data-i18n="plan2_f3">Gestão de Fretes (TMS) — até 30/mês</li><li data-i18n="plan2_f4">Emissão de CT-e/MDF-e</li><li data-i18n="plan2_f5">Cotações e Tabelas de Frete</li><li data-i18n="plan2_f6">API + Webhooks</li></ul><a href="/cadastro" class="pbtn p" data-i18n="plan2_btn">Trial grátis 14 dias</a></div>
    <div class="pc"><div class="pn" data-i18n="plan3_n">Enterprise</div><div class="pp"><sup>R$</sup>1.099<span data-i18n="plan_mes">/mês</span></div><div class="pd" data-i18n="plan3_d">Grandes operações e TMS ilimitado</div><ul class="pf"><li data-i18n="plan3_f1">150 veículos inclusos (+R$2,50/excedente)</li><li data-i18n="plan3_f2">Gestão de Fretes (TMS) ilimitada</li><li>SSO SAML</li><li>SLA 99,95%</li><li data-i18n="plan3_f6">Suporte 24/7</li></ul><a href="/cadastro" class="pbtn o" data-i18n="plan3_btn">Assinar Enterprise</a></div>
  </div>
</section>

<!-- Fase Posto/Rede (26/07/2026, pedido do Daniel) — seção de preços
     dedicada a postos revendedores, separada da seção .pricing#precos
     acima (que é só de frotista). Mesmos valores/planos de
     PLANOS_POSTO/PLANO_POSTO_LABEL/FEATURES_PLANO_POSTO/FAIXA_POSTOS_PLANO
     em src/lib/constants.ts e da Cláusula 3ª por plano de posto em
     src/lib/termoAdesao.ts — se um mudar, revisar o outro. Diferente do
     card de frotista, aqui "Rede de Postos" é a feature central de
     Profissional/Enterprise: uma assinatura única, paga pela empresa
     administradora (matriz) em nome de todos os postos membros. -->
<section class="pricing" id="precos-postos" style="background:transparent">
  <div style="text-align:center">
    <div class="sec-lbl">Planos para Postos Revendedores</div>
    <div class="sec-title">Preços pensados pra revenda de combustíveis</div>
    <p class="sec-sub" style="margin:0 auto">Sem cartão de crédito. Cancele quando quiser. Rede de Postos com assinatura única, paga pela matriz.</p>
  </div>
  <div class="pgrid">
    <div class="pc"><div class="pn">Essencial</div><div class="pp"><sup>R$</sup>99<span>/mês</span></div><div class="pd">Posto avulso</div><ul class="pf"><li>1 posto (sem Rede de Postos)</li><li>Gestão de faturas e conciliação de abastecimentos</li><li>Financeiro: contas a receber e inadimplência</li><li>Cadastro de bicos, produtos e preços</li><li class="off">Rede de Postos</li><li class="off">Inteligência de Rede e Antifraude</li></ul><a href="/cadastro" class="pbtn o">Assinar Essencial</a></div>
    <div class="pc feat"><div class="pbadge">Mais popular</div><div class="pn">Profissional</div><div class="pp"><sup>R$</sup>159<span>/mês</span></div><div class="pd">Redes pequenas e médias</div><ul class="pf"><li>Tudo do Essencial</li><li>Rede de Postos — até 5 postos inclusos</li><li>Assinatura única, paga pela matriz (+R$35/posto excedente)</li><li>Inteligência de Rede e Antifraude</li><li>Suporte em até 24h</li></ul><a href="/cadastro" class="pbtn p">Trial grátis 14 dias</a></div>
    <div class="pc"><div class="pn">Enterprise</div><div class="pp"><sup>R$</sup>599<span>/mês</span></div><div class="pd">Grandes redes de postos</div><ul class="pf"><li>Tudo do Profissional</li><li>Rede de Postos — até 20 postos inclusos</li><li>Assinatura única, paga pela matriz (+R$20/posto excedente)</li><li>API, integrações e webhooks</li><li>SLA 99,95%</li></ul><a href="/cadastro" class="pbtn o">Assinar Enterprise</a></div>
  </div>
</section>

<section class="cta">
  <div class="cta-t" data-i18n-html="cta_title">Pronto para economizar<br>na sua frota?</div>
  <p class="cta-s" data-i18n="cta_sub">14 dias grátis. Sem cartão. Sem burocracia.</p>
  <div class="cta-a">
    <a href="/cadastro" class="btn-p" data-i18n="cta_btn_p">Começar agora — é grátis →</a>
    <a href="mailto:contato@fxgestaodefrotasonline.com" class="btn-s" data-i18n="cta_btn_s">💬 Falar com especialista</a>
  </div>
</section>

<footer>
  <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMjAgNjQiIHdpZHRoPSIyMjAiIGhlaWdodD0iNDQiPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQsNCkiPjxsaW5lIHgxPSIyNCIgeTE9IjI0IiB4Mj0iOCIgeTI9IjEyIiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48bGluZSB4MT0iMjQiIHkxPSIyNCIgeDI9IjUiIHkyPSIzMCIgc3Ryb2tlPSIjMDBiNGQ4IiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGxpbmUgeDE9IjI0IiB5MT0iMjQiIHgyPSIxMCIgeTI9IjQ0IiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48bGluZSB4MT0iMjQiIHkxPSIyNCIgeDI9IjM2IiB5Mj0iOCIgc3Ryb2tlPSIjMDBiNGQ4IiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGxpbmUgeDE9IjI0IiB5MT0iMjQiIHgyPSI0MCIgeTI9IjM4IiBzdHJva2U9IiMwMGI0ZDgiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMjQgNSBDMTYgNSAxMCAxMSAxMCAxOCBDMTAgMjcgMjQgNDIgMjQgNDIgQzI0IDQyIDM4IDI3IDM4IDE4IEMzOCAxMSAzMiA1IDI0IDVaIiBmaWxsPSIjMDBiNGQ4Ii8+PGNpcmNsZSBjeD0iMjQiIGN5PSIxOCIgcj0iNiIgZmlsbD0iIzA0MTEyZSIvPjxjaXJjbGUgY3g9IjgiIGN5PSIxMiIgcj0iNCIgZmlsbD0iIzAwYjRkOCIvPjxjaXJjbGUgY3g9IjUiIGN5PSIzMCIgcj0iNCIgZmlsbD0iIzAwYjRkOCIvPjxjaXJjbGUgY3g9IjEwIiBjeT0iNDQiIHI9IjQiIGZpbGw9IiMwMGI0ZDgiLz48Y2lyY2xlIGN4PSIzNiIgY3k9IjgiIHI9IjQiIGZpbGw9IiMwMGI0ZDgiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjM4IiByPSI0IiBmaWxsPSIjMDBiNGQ4Ii8+PC9nPjx0ZXh0IHg9IjYyIiB5PSIyNiIgZm9udC1mYW1pbHk9Ik91dGZpdCxzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iNzAwIiBmb250LXNpemU9IjE1IiBmaWxsPSIjZmZmZmZmIiBsZXR0ZXItc3BhY2luZz0iMC4zIj5GbGVldCBOZXR3b3JrIEludGVsbGlnZW5jZTwvdGV4dD48dGV4dCB4PSI2MiIgeT0iNDQiIGZvbnQtZmFtaWx5PSJPdXRmaXQsc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjUwMCIgZm9udC1zaXplPSIxMC41IiBmaWxsPSIjMDBiNGQ4IiBsZXR0ZXItc3BhY2luZz0iMiI+R0VTVMODTyBERSBGUk9UQVM8L3RleHQ+PC9zdmc+" alt="FNI" height="30" style="opacity:0.4;">
  <div class="flinks">
    <a id="lnk_termos" href="/termos" data-i18n="footer_termos">Termos de Uso</a>
    <a id="lnk_priv" href="/privacidade" data-i18n="footer_priv">Privacidade</a>
    <a id="lnk_sobre" href="/sobre" data-i18n="footer_sobre">Sobre nós</a>
    <a href="/indice-precos">Índice de Preços</a>
    <a href="mailto:contato@fxgestaodefrotasonline.com" data-i18n="footer_contato">Contato</a>
  </div>
  <div class="fcopy" style="line-height:1.9">
    &copy; 2026 <strong>Fleet Network Intelligence Ltda.</strong> &mdash; Plataforma SaaS B2B para Gest&atilde;o de Frotas<br>
    <a href="mailto:contato@fxgestaodefrotasonline.com" style="color:#00b4d8">contato@fxgestaodefrotasonline.com</a>
    &nbsp;&middot;&nbsp; Brasil &nbsp;&middot;&nbsp;
    <a href="/privacidade" style="color:#00b4d8">LGPD</a>
  </div>
</footer>

<!-- Fase remove-toggle-idioma-landing (19/07) — pedido do Daniel: removido
     o dicionário de i18n (_i18n), _applyLang()/setLang() e o CSS do
     lang-switcher. O toggle PT/EN nunca funcionou de forma confiável em
     produção (Cloudflare Rocket Loader reordenando a execução dos
     <script>, entre outras tentativas de correção que não resolveram) —
     a landing agora é só em português, sem esse mecanismo. Os atributos
     data-i18n/data-i18n-html que sobraram espalhados pelo HTML abaixo
     ficaram inertes (o navegador ignora atributos data- desconhecidos) —
     não foram removidos um a um pra não arriscar um edit gigante em ~150
     elementos; o texto visível de cada um já é o português correto,
     hardcoded no próprio HTML. -->

<!-- deploy 2026-06-22T23:49:22.035829 -->
<!-- redeploy 2026-06-24T13:30:53.745311 -->
<!-- redeploy 2026-07-19T20:11:29.850350Z — forçar rebuild após checagem do
     toggle PT/EN (testado via jsdom, sem erros; suspeita é cache/deploy
     atrasado, não bug de código — ver commit) -->
`;
