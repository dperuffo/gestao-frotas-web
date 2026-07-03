# Deploy em produção — Railway + Cloudflare (fxgestaodefrotasonline.com)

Guia passo a passo pra colocar o app no ar. Os passos com 🔒 envolvem login/senha/pagamento — só você pode fazer, eu não tenho (nem posso ter) acesso a essas contas.

## 0. O que já está pronto no código

- `/` agora é a landing pública (portada do repo `dperuffo/estudo-de-rede`, pasta `landing/`), com CTA pro `/cadastro` e `/login`. Quem já está logado e visita `/` é redirecionado direto pro `/dashboard`.
- `/termos`, `/privacidade`, `/sobre` (+ variantes `-en`) também viraram rotas do Next.js.
- `railway.json` na raiz — configuração explícita de build/start pro Railway (Nixpacks detecta Next.js automaticamente, isso só deixa explícito).
- `.gitignore` atualizado — exclui `node_modules`, `.next`, segredos (`.env.local`), e arquivos soltos que não são código do app (pasta de referência, scripts de teste avulsos).

## 1. Subir o código pro GitHub 🔒

Eu tentei rodar `git init` direto na pasta do projeto pelo meu sandbox e esbarrei numa trava de permissão do ambiente (o processo do git não consegue apagar seu próprio arquivo de lock nessa pasta montada) — não é um problema do seu computador, é uma limitação de como eu acesso essa pasta. **Você vai precisar rodar isso você mesmo, no Terminal do seu Mac.**

Abra o Terminal, entre na pasta do projeto e rode:

```bash
cd "/Users/daniel/Documents/Projetos/Gestão de Frotas"

# se sobrou uma pasta .git de alguma tentativa anterior, comece limpo:
rm -rf .git

git init
git add -A
git commit -m "Commit inicial — FNI Gestão de Frotas"
```

Agora decida onde esse código vai morar no GitHub:

- **Repositório novo, só pra este app (recomendado)** — mais simples pro Railway (ele faz deploy da raiz do repo, sem configuração extra). Crie um repo vazio em github.com/new (ex: `gestao-frotas-web`), depois:
  ```bash
  git remote add origin https://github.com/SEU-USUARIO/gestao-frotas-web.git
  git branch -M main
  git push -u origin main
  ```
- **Dentro do repo `estudo-de-rede` que você já usa** (junto com Flutter/backend Python) — também dá, mas aí no Railway você precisa configurar "Root Directory" apontando pra subpasta onde colocar este código, e o histórico de commits fica misturado com os outros projetos. Só recomendo se você já tem esse hábito organizado assim.

## 2. Criar o projeto no Railway 🔒

1. Entre em [railway.app](https://railway.app), crie conta/faça login (pode ser com a conta do GitHub, facilita o próximo passo).
2. **New Project → Deploy from GitHub repo** → autorize o Railway a acessar seu GitHub (se pedir) → selecione o repositório que você acabou de criar/usar no passo 1.
3. O Railway vai detectar automaticamente que é um app Next.js (via Nixpacks) e já vai tentar buildar. **Vai falhar na primeira vez** — falta configurar as variáveis de ambiente (próximo passo).

## 3. Variáveis de ambiente no Railway 🔒

No projeto criado, vá em **Variables** e adicione (o nome exato importa, o valor é só seu):

| Nome | Onde pegar o valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nedthbeekvwzcjrhsghp.supabase.co` (fixo, já sabido) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Painel Supabase → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel Supabase → Project Settings → API → `service_role` key (⚠️ nunca exponha essa em código client-side — o app só usa ela em rotas de servidor) |
| `CRON_SECRET` | Gere você mesmo: no Terminal, `openssl rand -hex 32`, copie o resultado |
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) — usada pelo Assistente FNI |

Depois de salvar as variáveis, o Railway re-builda automaticamente. Acompanhe em **Deployments** até aparecer "Success".

Nota: as chaves do **Stripe** não entram aqui — elas já estão configuradas como *secrets* das Edge Functions do Supabase (`stripe-webhook`, `create-checkout-session`, `planos-precos`), não no Next.js. Não precisa mexer nelas.







## 4. Domínio customizado (Cloudflare → Railway) 🔒

1. No Railway, dentro do serviço, vá em **Settings → Networking → Custom Domain** → digite `fxgestaodefrotasonline.com` → o Railway mostra um registro DNS pra criar (geralmente um `CNAME` apontando pra algo tipo `xxxxx.up.railway.app`, ou um `A`/`AAAA` — o Railway mostra exatamente o que criar).
2. No painel da Cloudflare (aba **DNS** do domínio `fxgestaodefrotasonline.com`), crie esse registro exatamente como o Railway pediu.
   - Se a Cloudflare mostrar a nuvem laranja ("Proxied") no registro, tanto faz deixar ligada ou desligada — geralmente funciona proxied (você ganha CDN/proteção da Cloudflare de graça), mas se dar erro de certificado SSL nos primeiros minutos, tente desligar o proxy (ícone cinza, "DNS only") até o Railway emitir o certificado, depois pode religar.
3. Quer `www.fxgestaodefrotasonline.com` também redirecionando? Repita o passo 1 no Railway pra esse subdomínio, ou crie uma regra de redirect na Cloudflare de `www` → domínio raiz.
4. Propagação de DNS costuma levar de alguns minutos a ~1h. O Railway mostra "Verified" no domínio quando reconhece o DNS certo.





## 5. Ajustar o Supabase Auth pro novo domínio 🔒

Sem isso, os e-mails de confirmação de cadastro e recuperação de senha vão gerar link quebrado.

Painel Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://fxgestaodefrotasonline.com`
- **Redirect URLs**: adicione `https://fxgestaodefrotasonline.com/**` (o `/**` libera qualquer subrota, inclusive `/auth/callback`)




## 6. Sincronização automática da PróFrotas (cron)

O app usava o Cron Jobs da Vercel (`vercel.json`) pra chamar `/api/cron/sync-profrotas` a cada hora — o Railway não lê esse arquivo. Como o projeto já tem a extensão `pg_cron` instalada no Supabase (usada antes pra outras tarefas), a substituição mais simples é agendar por lá, sem depender de nenhum serviço externo.

**Só rode isso depois que o domínio estiver funcionando (passo 4) e você já tiver definido o `CRON_SECRET` (passo 3).** Me chame quando chegar nessa parte que eu aplico — ou, se preferir fazer você mesmo, rode isto no SQL Editor do Supabase (troque `SEU_CRON_SECRET_AQUI` pelo valor real que você colocou no Railway):

```sql
select cron.schedule(
  'sync-profrotas-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://fxgestaodefrotasonline.com/api/cron/sync-profrotas',
    headers := jsonb_build_object(
      'Authorization', 'Bearer SEU_CRON_SECRET_AQUI',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

## 7. Checklist final depois do ar

- [ ] `https://fxgestaodefrotasonline.com` abre a landing (não o dashboard)
- [ ] Botão "Começar grátis" leva pro `/cadastro` e o cadastro funciona (recebe e-mail de confirmação com link certo)
- [ ] Botão "Acessar Plataforma" leva pro `/login` e login funciona
- [ ] `/termos`, `/privacidade`, `/sobre` abrem
- [ ] Login existente (sua conta) continua funcionando, MFA incluso
- [ ] Cron da PróFrotas rodando (depois de 1h, checar `profrotas_api_keys.ultimo_sync` de algum cliente ativo)

---

Me chama quando terminar cada etapa que eu confirmo com você — ou se travar em algum passo, me manda o erro que eu ajudo a debugar (sem precisar que você me passe nenhuma senha/token, só a mensagem de erro).
