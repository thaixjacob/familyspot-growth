# FamilySpot Growth

Painel de crescimento + dados do FamilySpot e pipeline de email semanal.

**O que faz**

- Puxa dados do **GA4** (uma propriedade, 4 streams: site `familyspot.app`, `blog.familyspot.app`, iOS e Android) via GA4 Data API com uma conta de serviço.
- **Dashboard** (Next.js/Vercel) para consultar tudo num sítio: KPIs, tendência de 30 dias, split por plataforma, site vs blog, eventos-chave (add_place, search, sign_up…), aquisição e países.
- **Padrões de uso**: funil passo-a-passo do produto (quantas pessoas chegam a cada passo e onde desistem), dias da semana e horas com mais uso, downloads (first_open) e uma tabela dia a dia dos últimos 30 dias. Cada quadro tem um **?** com a explicação em português.
- **Jornada de cada pessoa**: a sequência exata de passos por sessão, a partir do export GA4 → BigQuery (ver passo 7).
- **Erros e falhas**: crashes (`app_exception`), ecrãs que rebentam (`app_error`, `map_error`) e falhas de fluxo (`sign_up_error`, `google_login_error`, `add_place_form_error`, `form_validation_error`), com utilizadores afetados e taxa por 100 sessões. O quadro apanha qualquer evento novo cujo nome contenha *error/exception/fail/crash*, sem ter de mexer no código daqui.
- **Estado das ligações**: avisos dos conectores (Meta, Play, App Store, BigQuery) num quadro próprio, em vez de uma linha cinzenta no fundo.
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
- `DASHBOARD_PASSWORD` — senha para abrir o dashboard. Abre o endereço e escreve a senha no formulário de login (funciona no telemóvel; o cookie dura 90 dias). O link antigo `/?pw=A_TUA_SENHA` continua a funcionar.

### 7. Jornadas por pessoa (export GA4 → BigQuery) — opcional mas recomendado

O GA4 Data API **só devolve totais**: consegue dizer "12 pessoas pesquisaram", nunca
"esta pessoa abriu → pesquisou → adicionou um local". O único sítio com uma linha por
evento (com um id anónimo de utilizador) é o **export gratuito para BigQuery**. É ele
que enche o painel **"Jornada de cada pessoa"**.

1. GA4 → **Admin → Product links → BigQuery links → Link** → escolhe o projeto Google
   Cloud (o mesmo do Firebase serve), marca as streams e ativa o export **diário**
   (o "streaming" é opcional e mostra também o dia de hoje).
2. Google Cloud → **APIs & Services → Library** → ativa a **BigQuery API**.
3. **IAM & Admin → IAM** → dá à service account do dashboard os papéis
   **BigQuery Data Viewer** e **BigQuery Job User**.
4. Se o projeto/dataset não forem os predefinidos, preenche `BIGQUERY_PROJECT_ID` e
   `GA4_BIGQUERY_DATASET`.

No ecrã "Definir as configurações": deixa todos os fluxos e eventos incluídos (o
percurso precisa da sequência completa), marca **Diariamente** em *Tipo de
exportação*, e deixa desmarcados os *identificadores de publicidade* e os *dados
do usuário* — o painel não os usa. O **Streaming** é opcional (mostra o próprio
dia; exige faturação ativa e cobra por volume).

Se escolheres a região **União Europeia**, não é preciso fazer nada: o painel
deteta a região do dataset sozinho (e `BIGQUERY_LOCATION` força-a, se quiseres).

> Só há dados **a partir do dia em que ligas o export** — não há histórico retroativo.
> Enquanto não estiver ligado, o painel mostra esta checklist em vez de dar erro.
> O volume do FamilySpot fica folgadamente dentro do tier grátis do BigQuery, e cada
> carregamento do dashboard tem um teto de ~2 GB analisados.

---

### 8. Mensagens de erro detalhadas (opcional, 1 minuto)

O quadro **Erros e falhas** mostra sempre quantos e de que tipo. Para ver *qual* foi
a mensagem (`Cannot read properties of undefined`, `auth/popup-closed-by-user`…), o
GA4 precisa que o parâmetro seja registado: **Admin → Definições personalizadas →
Criar dimensão personalizada** → âmbito *Evento*, parâmetro `error_message` (podes
repetir para `error_name`, `error_type`, `error_code`). O painel deteta sozinho qual
existe e mostra o top 8. Vale a partir da data em que registas — não é retroativo.

> Isto não substitui o Crashlytics: aqui vês **se** e **onde** rebenta; o stack trace
> completo continua a ser lá.

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
| `BIGQUERY_PROJECT_ID` | (opcional) projeto do export GA4→BigQuery; por defeito o da service account |
| `GA4_BIGQUERY_DATASET` | (opcional) dataset do export; por defeito `analytics_<GA4_PROPERTY_ID>` |
| `BIGQUERY_LOCATION` | (opcional) região do dataset (`EU`, `US`…); detetada sozinha |
| `JOURNEYS_DAYS` | (opcional) janela da tabela de jornadas, em dias (default 7) |
| `BIGQUERY_JOURNEYS` | (opcional) `off` esconde o painel de jornadas |

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
    journeys.ts     Jornada passo-a-passo por pessoa (GA4→BigQuery, via REST)
    auth.ts         Cookie/hash da senha do dashboard
    loginPage.ts    HTML do ecrã de login (usado pelo middleware, Edge)
  app/
    api/auth/route.ts  Recebe o formulário de login e põe o cookie
  components/
    DashboardView.tsx  UI (KPIs, tendência, listas)
    UsagePanels.tsx    Funil, dias/horas de uso, downloads, tabela dia a dia
    JourneyPanel.tsx   Tabela de jornadas por pessoa
    ui.tsx             Card + tooltips explicativos (funcionam a toque)
  middleware.ts     Gate de senha do dashboard (mostra o formulário de login)
```
