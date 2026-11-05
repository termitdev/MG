# MUGUI

Site da MUGUI com React, TypeScript, TanStack Start, Vite, Tailwind CSS e shadcn/ui.

## Desenvolvimento

```sh
npm ci
npm run dev
```

## Verificação

```sh
npm run build
npm test
npm run lint
```

O build usa Nitro com destino padrão Cloudflare, preservando a renderização no servidor.
Para testar o build localmente, use `npm run preview`.
Se a prévia do Nitro no Windows falhar com `spawn npx ENOENT`, execute
`npx wrangler dev --config .output/server/wrangler.json` diretamente.

## Logo

Imagem oficial em **`public/logomg.png`**. O Header e o Footer usam
o mesmo arquivo pela URL `/logomg.png`, com proporção preservada e tamanhos
responsivos.

O site não declara favicon.

## Plataforma de atendimento

- `/agendar`: solicitação em quatro etapas.
- `/login`: autenticação, recuperação de senha e MFA da equipe (`/acesso` permanece compatível).
- `/interno`: painel com dados autorizados do Supabase.
- `/privacidade`: aviso inicial de tratamento de dados, sujeito à aprovação operacional/jurídica.

Consulte [configuração e operação](docs/PLATFORM_SETUP.md) antes de configurar serviços
ou atender pacientes reais. A migration e as Edge Functions são versionadas em
`supabase/`. As migrations de convites foram aplicadas pelo responsável no SQL Editor;
consulte o relatório de convites antes de provisionar novos acessos.

Consulte também o [relatório de atualização visual, timeline, loading e validação](docs/SITE_UPDATE_REPORT.md).

Paleta vigente e remoção dos fundos da logo: [relatório da identidade cromática](docs/COLOR_IDENTITY_REPORT.md).

Autenticação, ambiente local e cadastro ADM: [relatório da correção](docs/AUTHENTICATION_FIX_REPORT.md).

Loading contextual, acesso discreto e painel atualizado: [relatório de interface](docs/DASHBOARD_UX_REPORT.md).

Turnstile, recuperação do widget e isolamento local: [relatório da correção](docs/TURNSTILE_FIX_REPORT.md).

Convites oficiais de funcionários, SMTP Resend e ativação: [relatório e validações](docs/STAFF_INVITATIONS_REPORT.md).
