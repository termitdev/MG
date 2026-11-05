# Relatório de implementação — MUGUI

Data: 04/11/2026. Trabalho local, sem commit, push, deploy ou migration remota.

## 1. Resumo

Implementados o formulário público em quatro etapas, backend TanStack Start integrado
ao Supabase, autenticação BFF, área interna, gestão de acessos, schema PostgreSQL com
RLS e uma arquitetura de integração desacoplada. A landing page foi mantida; seus
botões de agendamento agora abrem a nova rota.

O sistema **não está declarado pronto para produção**: não há Supabase remoto,
SMTP/Turnstile real ou laboratório configurados e homologados nesta execução.
Não há dados de demonstração, login fictício ou respostas simuladas no runtime da aplicação.

## 2. Arquivos criados e modificados

Criados:

- `.env.example` e `scripts/provision-first-admin.mjs`.
- `supabase/config.toml` e `supabase/migrations/202611040001_platform.sql`.
- `supabase/functions/_shared/laboratory.ts`.
- `supabase/functions/integration-dispatch/index.ts` e `supabase/functions/laboratory-webhook/index.ts`.
- `src/lib/scheduling.ts` e `src/lib/security.ts`.
- `src/services/api.ts` e `src/services/backend/{api,supabase,crypto}.server.ts`.
- `src/components/platform/Controls.tsx`.
- `src/components/booking/{BookingForm,Turnstile}.tsx`.
- `src/components/auth/Access.tsx`.
- `src/components/admin/{AdminShell,AdminView,Overview,Requests,RequestDetail,Users}.tsx`.
- `src/components/admin/types.ts` e `src/components/admin/useData.ts`.
- Rotas `agendar.tsx`, `privacidade.tsx`, `acesso.tsx`, `api.$.ts`, `interno.tsx`,
  `interno.index.tsx` e `interno.$.tsx` em `src/routes/`.
- Testes `scheduling`, `security`, `laboratory`, `database`, `auth`, `booking-ui`,
  `dashboard-ui` e `document-crypto` em `src/test/`.
- `docs/PLATFORM_SETUP.md` e este relatório.

Modificados neste pedido:

- `.gitignore`, `README.md`, `package.json`, `package-lock.json`, `bun.lock`.
- `vite.config.ts`, `vitest.config.ts`, `src/router.tsx`, `src/server.ts`, `src/routes/__root.tsx`.
- `src/components/landing/{Navbar,Footer,Hero,Cta}.tsx`: destinos dos links e suporte à navegação nas novas páginas.
- `src/styles.css`: estilos adicionais das interfaces operacionais e suporte a movimento reduzido.
- `src/lib/error-page.ts`: recarregamento compatível com CSP, sem handler JavaScript inline.
- `src/test/setup.ts` e `src/test/app-routing.test.tsx`: infraestrutura de testes compatível com a shell HTML.
- `src/routeTree.gen.ts`: atualizado pelo gerador de rotas, não mantido manualmente.

As alterações anteriores de logo/remoção da plataforma e alterações concorrentes nos
assets não foram revertidas. As imagens `hero-tech.jpg` e `care.jpg` foram alteradas
externamente durante o trabalho; não foram editadas por esta implementação.

Dependências novas: `@supabase/supabase-js`, `@supabase/ssr` e `@electric-sql/pglite`
(somente desenvolvimento/testes). Vite e Zod foram atualizados para corrigir os
alertas de severidade alta encontrados. SDK fixado em 2.118.0 para respeitar o
período de segurança de publicação configurado no Bun. Os dois lockfiles foram atualizados.

## 3. Rotas

| Rota | Uso |
| --- | --- |
| `/` | Site público existente |
| `/agendar` | Formulário de solicitação |
| `/privacidade` | Aviso técnico inicial, ainda sujeito à aprovação jurídica/operacional |
| `/acesso` | Login, recuperação, convite, senha e MFA |
| `/interno` | Indicadores reais limitados à autorização |
| `/interno/pacientes` | Identificações mascaradas e atendimentos autorizados |
| `/interno/solicitacoes` | Listagem, filtros, ordenação e paginação |
| `/interno/solicitacoes/:id` | Detalhes, comentários, histórico e operações autorizadas |
| `/interno/laboratorio` | Acompanhamento dos estados independentes |
| `/interno/historico` | Auditoria ADM ou orientação ao histórico dos próprios atendimentos |
| `/interno/usuarios` | Gestão exclusiva de administradores com MFA |
| `/interno/configuracoes` | Conta, segurança e situação das integrações |
| `/api/*` | Backend BFF com autorização por operação |

## 4. Banco e RLS

A migration cria `profiles`, `patients`, `exam_requests`, `patient_comments`,
`request_status_history`, `laboratory_integrations`, `integration_outbox`,
`laboratory_events`, `audit_logs` e `private.rate_limits`.
Inclui constraints, índices, transações, histórico e funções privilegiadas com
`search_path` fixo e EXECUTE restrito.

Todas as tabelas têm RLS. Visitantes não leem pacientes nem solicitações.
Funcionários ativos só leem solicitações atribuídas; administradores precisam de AAL2.
Não existem concessões de escrita direta ao frontend. Documentos criptografados,
contatos, outbox e recibos de webhook não têm leitura pública/autenticada indiscriminada.
O cadastro público usa o BFF seguro e RPC transacional service-only, mantendo a stack
existente como alternativa às Edge Functions para esse endpoint.

## 5. Autenticação e permissões

Supabase Auth é usado somente no backend. Cookies HttpOnly/SameSite e Secure em
HTTPS; nenhuma sessão em localStorage. `getUser`, atividade do perfil e AAL são
verificados no servidor. MFA obrigatório para ADM e desafio exigido para qualquer
conta que já tenha MFA habilitado. Cadastro público não é oferecido.

Convites e permissões usam o backend administrativo. A interface não permite alterar
o próprio papel. Desativação é verificada a cada operação e também aplica ban no Auth.
Logout solicita escopo global; as limitações da revogação administrativa por ID estão
documentadas no guia operacional.

## 6. Agendamento

Identificação → contato → exame CNH/CLT → revisão. Validação compartilhada de CPF,
RG, data, e-mail, telefone, exame e aviso de privacidade. Navegação preserva os dados
somente na memória da página. Há progresso, foco, erros acessíveis, loading e bloqueio
de duplicidade no cliente e por chave persistida no banco.

O BFF verifica origem, tamanho, rate limit, honeypot e Turnstile antes da gravação.
Documento é protegido com AES-256-GCM e chave exclusiva do servidor. A transação
cria solicitação, paciente, protocolo único, histórico, auditoria e outbox. O retorno
confirma **recebimento da solicitação**, sem data ou horário de exame inventados.

## 7. Dashboard

Indicadores agregados no PostgreSQL respeitam RLS. A listagem tem busca por POST,
filtros, período, ordenação e páginas de 20 registros. Há estados vazios, de erro e
loading; atualização periódica acontece apenas com a aba visível.

Detalhes incluem espera baseada nos timestamps persistidos, estado atual, aceite,
integração, responsável, histórico e comentários renderizados como texto. Dados
pessoais completos exigem permissão específica e registro prévio de auditoria.
Confirmação manual do laboratório é separada, exclusiva de ADM, justificada e identificada.

Nenhum SLA oficial foi presumido. Configuração de alertas operacionais de SLA e
políticas de retenção dependem de definição e aprovação da MUGUI.

## 8. Integração e Edge Functions

Existem os contratos internos de envio, consulta de protocolo e verificação de
webhooks. O adaptador real permanece não configurado; não foram inventados endpoints,
autenticação ou contratos externos.

Outbox usa leases, SKIP LOCKED, chave idempotente, timeout, backoff, tentativas limitadas
e erros sanitizados. Há deduplicação persistida de eventos e separação entre envio,
aceite e andamento operacional.

`integration-dispatch` exige segredo do agendador; `laboratory-webhook` permanece
fechado até implementar a validação de assinatura/timestamp do contrato real.
As duas funções retornam indisponibilidade enquanto o adaptador estiver desabilitado.
Simulações de aceite, recusa, falha e timeout estão exclusivamente nos testes.

## 9. Segurança

- Deny-by-default, RLS e menor privilégio.
- Anti-CSRF por origem exata e cookies SameSite.
- Limites de corpo e validação de entrada no backend.
- Rate limiting persistente e proteção anti-bot no cadastro público.
- Criptografia autenticada dos documentos e fingerprints HMAC internos.
- Comentários sem HTML executável; sem exportação irrestrita de pacientes.
- Auditoria sem documentos completos, senhas, tokens ou payloads clínicos.
- Termos de busca fora das URLs.
- CSP com nonce validada no build de produção; sem cache de documentos HTML com nonce.
- nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors/X-Frame-Options e HSTS condicionado a HTTPS de produção.
- Arquivos de ambiente ignorados no Git; sem alteração de `.env` real.

## 10. Resultados de validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado |
| `npx tsc --noEmit` | Aprovado |
| `npm test` | 38 testes, 9 arquivos, todos aprovados |
| Migration em PostgreSQL embarcado/PGlite | Executou e passou nos testes de roles, RLS e transações |
| `deno check` nas duas Edge Functions | Aprovado |
| ESLint do código novo | Sem erros |
| `npm run lint` global | Ainda falha: milhares de ocorrências de formatação herdadas; não foi feita reformatação geral fora do escopo |
| `npm audit --omit=dev` | Zero vulnerabilidades conhecidas reportadas |
| `npm audit` completo | 14 alertas moderados em dependências de desenvolvimento; sem altos/críticos |
| Navegador 375/768/1440 px | Formulário, login e painel/detalhes sem overflow horizontal |
| Build de produção no navegador | CSP/hidratação e navegação do formulário aprovadas |

Os testes verificam CPF, RG, datas, contato, navegação, envio duplicado, confirmação
somente após resposta, falha do backend, busca/filtros, estados vazios, isolamento
horizontal, usuário inativo, MFA/ADM, tentativas de autoelevação, escrita direta,
criptografia/tampering, idempotência, leases e replay de eventos.

O painel no navegador foi validado com interceptação **explicitamente sintética**,
sem criar dados fictícios no runtime ou em banco remoto. Os testes SQL usam claims
sintéticas para validar as policies; isso não substitui sessões reais do Supabase.

Sem credenciais externas, os fluxos reais de login, SMTP, recuperação, TOTP no Auth,
Turnstile, gravação remota e API laboratorial não foram homologados.
O navegador pode buscar `/favicon.ico` automaticamente e receber 404, pois o site
permanece deliberadamente sem favicon.

## 11. Configuração, primeiro ADM e pendências

O guia [PLATFORM_SETUP.md](PLATFORM_SETUP.md) contém todas as variáveis, configuração
do Supabase Auth, templates de e-mail, migrations, secrets, procedimento de bootstrap,
deploy das funções, chaves, retenção, backups e resposta a incidentes.

Para homologar:

1. Criar/configurar Supabase de homologação e aplicar a migration após autorização.
2. Validar cada policy com contas reais ADM AAL1/AAL2, funcionário, inativo e anônimo.
3. Configurar secrets, origem HTTPS, ingress e Turnstile com hostnames reais.
4. Configurar SMTP/templates e provisionar o primeiro ADM pelo script documentado.
5. Testar convite, recuperação, MFA, expiração/revogação e desativação de ponta a ponta.
6. Aprovar política de privacidade, bases legais, canais, retenção, backups e SLA.
7. Revisar os alertas moderados das ferramentas de desenvolvimento e a formatação herdada.
8. Receber contratos/credenciais do laboratório, implementar o adaptador e homologar
   assinatura, replay, mapeamentos, ordenação, reconciliação e idempotência remota.

Nenhuma integração real ou conformidade jurídica integral é declarada neste relatório.
