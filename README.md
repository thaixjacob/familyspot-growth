# FamilySpot Growth

Painel de crescimento + dados do FamilySpot e pipeline de email semanal.

**O que faz**

- Puxa dados do **GA4** (uma propriedade, 4 streams: site `familyspot.app`, `blog.familyspot.app`, iOS e Android) via GA4 Data API com uma conta de serviço.
- **Dashboard** (Next.js/Vercel) para consultar tudo num sítio: KPIs, tendência de 30 dias, split por plataforma, site vs blog, eventos-chave (add_place, search, sign_up…), aquisição e países.
- **Email semanal** (segunda 08:00 via Vercel Cron) com um resumo + insights escritos pelo Claude (ou por regras, se não houver API key), enviado pelo Resend.

Fase 1 = GA4 (feito). Fase 2 (em curso): conector **Meta** implementado; **Play/App Store** estruturados, a ligar a seguir.

### Fase 2 — Meta (Facebook + Instagram)

Lê só os insights das **tuas próprias** contas (não é outreach). Setup:

1. Meta for Developers → cria uma app (tipo Business) e liga a tua página.
2. Gera um **token de página de longa duração** (~60 dias — precisa de rotação). Permissões: `pages_read_engagement`, `read_insights`; para Instagram, `instagram_basic` + `instagram_manage_insights` e uma conta IG Business ligada à página.
3. Preenche `META_ACCESS_TOKEN`, `META_PAGE_ID` e/ou `META_IG_USER_ID`. Sem eles, a secção mostra um placeholder.

Play e App Store: os conectores estão estruturados (`src/lib/integrations/`) com o caminho de credenciais documentado; ligo-os depois de validar o Meta ao vivo.

---

## Pré-visualização rápida (sem credenciais)

```bash
npm install
npm run dev
```

Abre `http://localhost:3000/?demo=1` — mostra a UI com dados de exemplo. Para dados reais, configura as credenciais abaixo.

---

## Checklist de credenciais (só tu podes fazer isto)

São settings/credenciais das tuas contas. Faz uma vez.

### 1. GA4 Property ID

GA4 → **Admin** → **Property settings** → copia o **Property ID** (um número, ex. `123456789`).
→ vai para `GA4_PROPERTY_ID`.

### 2. Conta de serviço (Google Cloud) para ler o GA4

1. [Google Cloud Console](https://console.cloud.google.com/) → seleciona o **projeto Firebase do FamilySpot**.
2. **APIs & Services → Library** → procura **"Google Analytics Data API"** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (ex. `growth-dashboard-reader`). Não precisa de roles no projeto. **Done**.
4. Abre a conta criada → **Keys → Add key → Create new key → JSON** → baixa o ficheiro.
5. Em GA4 → **Admin → Property Access Management → +** → adiciona o **email da conta de serviço** (`…@….iam.gserviceaccount.com`) com papel **Viewer**.
6. Abre o JSON baixado, copia **todo** o conteúdo `{ ... }` numa linha → vai para `GOOGLE_SERVICE_ACCOUNT_JSON`.

### 3. Stream do blog (para o blog entrar de graça no mesmo GA4)

O blog (`blog.familyspot.app`, projeto Lovable) **hoje não é medido**. Para incluí-lo:

1. GA4 → **Admin → Data streams → Add stream → Web** → URL `https://blog.familyspot.app`, nome `Blog`. Copia o **Measurement ID** (`G-XXXXXXX`).
2. No repo do blog (`family-fun-finder`), cola o snippet gtag no `index.html` (posso fazer esta edição por ti — é uma linha de `<script>`). Assim que o blog reportar, aparece automaticamente aqui, separado por `hostName`.

### 4. Resend (email semanal)

1. [resend.com](https://resend.com) → cria conta.
2. **Domains → Add domain** (ex. `mail.familyspot.app`) → adiciona os registos DNS (SPF/DKIM) no teu registrador → verifica.
3. **API Keys → Create** → copia (`re_…`) → `RESEND_API_KEY`.
4. `REPORT_FROM_EMAIL` = ex. `insights@mail.familyspot.app` (tem de ser do domínio verificado). `REPORT_TO_EMAIL` = `tjlannes@gmail.com`.

### 5. Anthropic API key (opcional — insights por IA)

[console.anthropic.com](https://console.anthropic.com) → **API Keys** → cria → `ANTHROPIC_API_KEY`.
Sem esta chave, o email usa um resumo por regras (funciona na mesma).

### 6. Segurança

- `CRON_SECRET` — string aleatória. Protege o endpoint `/api/weekly-report`.
- `DASHBOARD_PASSWORD` — senha para abrir o dashboard (visita `/?pw=A_TUA_SENHA` uma vez).

---

## Variáveis de ambiente

Copia `.env.example` para `.env.local` e preenche. **Nunca faças commit de `.env.local`.**

| Variável | Para quê |
|---|---|
| `GA4_PROPERTY_ID` | ID numérico da propriedade GA4 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo da conta de serviço (uma linha) |
| `RESEND_API_KEY` | envio do email |
| `REPORT_FROM_EMAIL` | remetente verificado no Resend |
| `REPORT_TO_EMAIL` | destino do resumo (default `tjlannes@gmail.com`) |
| `ANTHROPIC_API_KEY` | (opcional) insights por IA |
| `CRON_SECRET` | protege o endpoint de cron |
| `DASHBOARD_PASSWORD` | senha do dashboard |

---

## Testar o email localmente

Com as variáveis GA4 preenchidas:

- Pré-visualizar o HTML sem enviar: `http://localhost:3000/api/weekly-report?dry=1&key=SEU_CRON_SECRET`
- Enviar de verdade: `http://localhost:3000/api/weekly-report?key=SEU_CRON_SECRET`

---

## Deploy no Vercel

1. Cria um repo Git novo com esta pasta e faz push.
2. [vercel.com](https://vercel.com) → **Add New → Project** → importa o repo.
3. **Settings → Environment Variables** → adiciona todas as variáveis acima.
4. **Deploy.**

O `vercel.json` já agenda o cron (`0 8 * * 1` = segunda 08:00 UTC). O Vercel chama `/api/weekly-report` com `Authorization: Bearer $CRON_SECRET` automaticamente.

> Se o cron do plano Hobby for limitado, alternativa fiável e grátis: um GitHub Action agendado que faz `curl` ao endpoint com o `CRON_SECRET`.

---

## Estrutura

```
src/
  lib/
    ga4.ts          Cliente GA4 Data API (service account)
    metrics.ts      Consultas → snapshot semanal tipado
    insights.ts     Narrativa (Claude, com fallback por regras)
    emailTemplate.ts HTML do email
    email.ts        Envio via Resend
    demo.ts         Dados de exemplo (/?demo=1)
    format.ts       Formatação de números/deltas
  app/
    page.tsx        Dashboard (server) → DashboardView
    layout.tsx
    api/weekly-report/route.ts   Alvo do cron: puxa → insights → envia
  components/
    DashboardView.tsx  UI (KPIs, tendência, listas)
  middleware.ts     Gate de senha do dashboard
```
