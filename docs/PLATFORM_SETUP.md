# MUGUI — configuração e operação

## O que está local e o que ainda depende de serviços externos

A aplicação mantém React, TanStack Start, Vite, Tailwind e a landing page existente.
O backend HTTP é o servidor TanStack Start (BFF), compatível com Nitro/Cloudflare.
Ele recebe o cadastro público e usa a chave administrativa apenas no servidor.
Não há cliente Supabase nem tokens de autenticação no armazenamento do navegador.
As Edge Functions ficam reservadas ao processamento da fila e aos webhooks.

As migrations de convites foram aplicadas pelo responsável no SQL Editor.
Um único convite real de teste foi enviado com autorização explícita e validado
pelo destinatário; consulte `STAFF_INVITATIONS_REPORT.md` para o escopo da validação.
Sem configuração, a API retorna 503 e o formulário não apresenta confirmação fictícia.
A API do laboratório permanece intencionalmente desabilitada.

## 1. Ambiente

Use `.env.example` como referência. Não versione `.env` nem exponha segredos com prefixo `VITE_`.
O Vite carrega as variáveis locais somente no processo do backend; elas não são inseridas em `define`.
Em produção, configure secrets no runtime, não apenas durante o build.

| Variável | Finalidade |
| --- | --- |
| `APP_ORIGIN` | Origem exata do site, sem barra final; HTTPS em produção |
| `APP_DEV_ORIGINS` | Lista opcional de origens exatas de desenvolvimento; ignorada em produção. O Vite inclui localhost e os IPs privados da máquina na porta efetiva do servidor |
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_ANON_KEY` | Chave pública usada pelo servidor com o JWT do funcionário e RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa exclusivamente no servidor |
| `DOCUMENT_ENCRYPTION_KEY` | 32 bytes aleatórios em base64 para AES-256-GCM |
| `DATA_HMAC_KEY` | Segredo independente com pelo menos 32 caracteres aleatórios |
| `TURNSTILE_SITE_KEY` | Chave pública do widget; único valor de provedor disponibilizado pela configuração pública |
| `TURNSTILE_SECRET_KEY` | Segredo do Turnstile no backend |
| `TRUSTED_CLIENT_IP_HEADER` | Vazio ou cabeçalho sobrescrito pelo ingress confiável |
| `INTEGRATION_WORKER_SECRET` | Segredo independente do agendador das Edge Functions |
| `LAB_API_BASE_URL`, `LAB_API_CREDENTIAL`, `LAB_WEBHOOK_SECRET` | Reservas de backend; não ativam o adaptador por si só |

Gere chaves de criptografia em uma estação confiável, por exemplo com
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
Execute separadamente para cada segredo e armazene em um gerenciador de segredos.
O comando gera uma chave; não é executado automaticamente pelo projeto.

Sem IP confiável, o rate limit usa um bucket compartilhado restritivo e falha fechado
se o banco estiver indisponível. Em Cloudflare, configure `cf-connecting-ip` somente
quando requisições diretas que possam falsificar esse cabeçalho estiverem bloqueadas.
Não use `X-Forwarded-For` de origem arbitrária.

## 2. Banco

Revise `supabase/migrations/202611040001_platform.sql` em homologação.
O arquivo cria tabelas novas; não executa DROP de tabelas existentes.
Ele deve ser aplicado uma vez, por ferramenta de migrations, em projeto compatível.
Se já existirem tabelas com os mesmos nomes, prepare uma migration de adaptação antes de aplicar.

Com Supabase CLI instalado, para desenvolvimento isolado:

```sh
supabase start
supabase db reset
```

`db reset` é destrutivo: use somente no banco local descartável.
Para ambiente remoto, faça backup, revise o destino e obtenha autorização explícita
antes de `supabase db push`. Nenhum desses comandos é executado automaticamente.

Tabelas: `profiles`, `patients`, `exam_requests`, `patient_comments`,
`request_status_history`, `laboratory_integrations`, `integration_outbox`,
`laboratory_events` e `audit_logs`; rate limits ficam no schema privado.

Cada solicitação preserva um snapshot de identificação e contato em `patients`.
Cadastros públicos novos não sobrescrevem dados de solicitações anteriores,
mesmo que o documento coincida. Isso evita que conhecer um CPF permita alterar um paciente.
O fingerprint HMAC é interno e não é retornado ao navegador.
O documento é criptografado com IV aleatório, autenticação GCM e versão de chave.

## 3. Supabase Auth

- Desabilite cadastro público em Auth e no provedor de e-mail.
- Configure Site URL e redirecionamentos exatos da origem real; evite curingas.
- Habilite TOTP, limites de login/OTP e proteção contra senhas comprometidas quando disponível.
- Configure SMTP próprio, expiração curta de links e alertas dos logs protegidos de autenticação.
- Defina expiração de JWT e limites de sessão compatíveis com o atendimento (por exemplo, JWT de 15 minutos).
- O sistema valida `getUser`, perfil ativo e nível AAL em todas as operações protegidas.
- Administrador precisa de AAL2 também nas policies SQL. Funcionário com MFA habilitado precisa concluir o desafio.
- Cookies de sessão são HttpOnly, SameSite=Lax, Path=/ e sem Domain. Secure é obrigatório na origem HTTPS de produção; em desenvolvimento HTTP, o servidor usa a origem local efetiva para permitir cookies no IP da rede e localhost.
- Não configure um cliente Supabase de navegador em paralelo a esta estratégia BFF.

**Templates de e-mail:** não coloque access/refresh tokens na query string:

Convite: preserve o template **Invite user** e o link oficial:
`<a href="{{ .ConfirmationURL }}">Aceitar convite</a>`.
O backend informa `${origemAutorizada}/auth/callback` como `redirectTo`.
Autorize essa URL exata em Authentication → URL Configuration → Redirect URLs.
No desenvolvimento local validado: `http://localhost:8080/auth/callback`.

Recuperação de senha de contas existentes (fluxo separado):
`{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=recovery`

O backend passa `/login?redefinir=1` em `redirectTo`. Autorize os endereços exatos de localhost/IP local e do domínio HTTPS no painel do Supabase. O uso de `.RedirectTo` no template faz o link retornar ao ambiente que solicitou a operação; não use curingas amplos. Se o template for usado fora da aplicação, configure uma alternativa segura para quando `.RedirectTo` estiver vazio.

Funcionários agora recebem convites por `auth.admin.inviteUserByEmail()`, somente
após autorização ADM/AAL2. Não há `createUser`, senha provisória nem recuperação
de senha no cadastro do dashboard. O Supabase envia o template Invite user pelo
SMTP Resend configurado no próprio Supabase. Não existe integração Resend no
frontend. O cadastro público deve permanecer desabilitado.

O callback remove o fragmento imediatamente e envia access/refresh tokens por POST
ao BFF, exclusivamente para estabelecer a sessão de convite pelo SDK oficial e
validar `getUser`. Os tokens não são salvos em localStorage. O convite oficial
não usa PKCE. Links anteriores com `token_hash` continuam sendo verificados por
OTP no backend. Cookies seguem HttpOnly, SameSite=Lax e Secure em HTTPS.
Não registre URLs completas de e-mails em ferramentas de analytics.

O perfil permanece `invitation_pending=true` até salvar a senha no Auth e concluir
a RPC de ativação. Isso bloqueia dashboard, pacientes e operações protegidas tanto
no servidor quanto nas RLS. A conclusão não muda `active`, `role` nem
`can_view_sensitive`. Administradores convidados ainda precisam de MFA antes do
dashboard. Perfis inativos continuam bloqueados. A senha tem de 12 a 128 caracteres
e também está sujeita à política configurada no Supabase.

Reenvio é permitido apenas para perfil pendente ativo e conta Auth convidada com
e-mail ainda não confirmado. Auth v2.197.0 aceita reenvio nessa condição; contas
já confirmadas são recusadas. Após aceitar o link, retome a sessão existente para
concluir a senha. O backend limita o envio por ADM e por destinatário, sem
tentativas automáticas. Não substitua o reenvio por recuperação de senha.

Configure no Supabase: SMTP `smtp.resend.com`, porta 465, usuário `resend`, senha
obtida no Resend, remetente `acesso@muguitoxicologico.com.br`, nome `MUGUI`.
Essas credenciais ficam no painel Supabase. Verifique domínio de envio e DNS no
Resend. Aceite da API não comprova entrega.
Consulte o [relatório de convites](STAFF_INVITATIONS_REPORT.md) para validações e limites.

### Primeiro administrador

Após aplicar a migration e configurar os templates, execute manualmente, em ambiente confiável:

```sh
node --env-file=.env.local scripts/provision-first-admin.mjs "administrador@dominio" "Nome do administrador"
```

O script se recusa a prosseguir se já existir um administrador. Não cria senha padrão.
O e-mail é confirmado administrativamente; o destinatário recebe instruções, configura TOTP, verifica o código e define uma senha pessoal.
Novos funcionários devem ser cadastrados pela tela Gerenciar Usuários após login ADM com MFA.
Não execute o bootstrap simultaneamente em duas estações.

A migration complementar `202611040002_auth_profiles.sql` prepara um perfil inativo para cada novo usuário Auth e recupera vínculos ausentes sem promover contas existentes. Metadados de cadastro não determinam papel, atividade ou permissões. Sua aplicação remota exige autorização e revisão; não é executada automaticamente.

Depois dela, aplique `202611050001_staff_invitations.sql` para o estado pendente,
RPCs de convites e proteção RLS. `202611050002_staff_invitation_trigger.sql`
instala a inicialização automática se o trigger estiver ausente, sem modificar
contas existentes. Verificação somente de leitura em
`supabase/checks/staff_invitation_trigger.sql`. Nenhuma migration é aplicada
automaticamente pelo aplicativo.

### Diagnóstico local sem segredos

```sh
npm run check:auth
npm run check:auth -- --probe
```

O primeiro comando valida nomes/formato das variáveis, papéis e projeto das chaves JWT legadas, HTTPS remoto e chaves de criptografia. O segundo acrescenta consultas somente de leitura ao Auth público, Auth administrativo e tabela de perfis. Exibe apenas campos/regras de configuração e status HTTP, sem chaves, usuários ou respostas completas do provedor.

Se o servidor foi iniciado antes de salvar o `.env.local`, reinicie o processo do Vite. O carregador também acompanha os valores que ele próprio inseriu para poder atualizá-los em reinícios internos sem sobrescrever variáveis realmente fornecidas pelo ambiente de execução.

Se o administrador perder o autenticador, o procedimento de recuperação depende de
verificação de identidade pela operação e recuperação controlada no Supabase.
Não existe bypass de MFA implementado no frontend.

### Desativação e sessões

A desativação marca o perfil inativo e aplica ban no Supabase Auth. RLS e backend
negam operações protegidas imediatamente, inclusive para JWT ainda válido.
O logout do próprio usuário solicita escopo global ao Auth.
O SDK não oferece aqui uma revogação por ID sem token da sessão do destinatário;
revogação administrativa adicional deve seguir os recursos suportados no ambiente Supabase.
Não prometa que JWTs já emitidos desapareceram do dispositivo.

## 4. Turnstile e agendamento

Cadastre os hostnames reais e configure as duas chaves. O servidor valida sucesso,
hostname e ação `booking`, além de limitar tamanho, validar todos os campos,
normalizar contato, verificar o honeypot e limitar requisições no PostgreSQL.
O hostname esperado corresponde à origem efetiva autorizada da aplicação.
Em produção, configure um par real e autorize os hostnames públicos no painel
Cloudflare, sem protocolo, caminho ou porta. Chaves oficiais de teste e tokens
dummy são recusados fora do modo local isolado.

Em `NODE_ENV=development`, acessos por localhost ou IP privado cuja origem
corresponda à lista confiável do servidor usam automaticamente o par oficial de
teste. O Siteverify continua obrigatório; o widget exibe “Somente para teste”.
Domínios públicos não recebem esse par. Para usar um widget real de desenvolvimento
com hostname autorizado, defina `TURNSTILE_LOCAL_TEST_MODE=false`. Não utilize
chaves de teste em produção. Consulte o [relatório de diagnóstico e validação](TURNSTILE_FIX_REPORT.md).

Fluxo: quatro etapas → validação no navegador → POST `/api/booking` → validação
no BFF → Turnstile → criptografia → RPC transacional `submit_exam_request` →
snapshot do paciente + solicitação + histórico + auditoria + outbox → protocolo.
Uma chave UUID preservada durante reenvios evita duplicação; reutilização com conteúdo
diferente é rejeitada. O cliente precisa realizar nova verificação Turnstile em cada tentativa.
O protocolo não confirma dia/horário. O início é `awaiting_review`, com aceite
`awaiting` e integração `not_configured`.

## 5. Permissões

- `anon`: sem leitura de tabelas e sem execução das RPCs privilegiadas.
- Funcionário ativo: somente solicitações atribuídas e respectivos dados mascarados,
  comentários, histórico e metadados de integração.
- Dados pessoais completos: autorização específica `can_view_sensitive` ou ADM,
  verificação do registro e auditoria obrigatória antes da resposta.
- ADM ativo com MFA: gestão da equipe, atribuições, auditoria e confirmação manual identificada.
- Nenhum cliente tem INSERT/UPDATE/DELETE direto nessas tabelas.
- Busca por nome usa POST; os termos não são inseridos nas URLs de acesso.
- Escritas operacionais passam por RPCs com autorização, `search_path` fixo e EXECUTE restrito.
- Documentos criptografados e contatos não têm SELECT concedido a `authenticated`.
- Outbox, recibos de webhook e rate limits são exclusivos do backend.
- Não é possível alterar o próprio perfil/role pela interface administrativa.

Os testes executam a migration em PostgreSQL embarcado com roles e claims sintéticas.
Ainda é obrigatório testar no Supabase de homologação com sessões reais, AAL1/AAL2,
JWT expirado, logout, usuário banido e cada policy, antes de produção.

## 6. Laboratório

`supabase/functions/_shared/laboratory.ts` define contratos internos, sem presumir
endpoints, autenticação ou payloads externos. O adaptador padrão retorna não configurado.
As simulações existem exclusivamente nos testes.

As Edge Functions `integration-dispatch` e `laboratory-webhook` retornam 503 enquanto
o adaptador estiver desabilitado. `integration-dispatch` exige o segredo do agendador
no Authorization; não publique esse segredo no cliente. Webhook só será habilitado
após implementar verificação de assinatura, janela de timestamp, replay e mapeamento
do protocolo externo para a solicitação interna conforme contrato real.

Para implantar as funções, somente após revisão/autorização:

```sh
supabase functions deploy integration-dispatch
supabase functions deploy laboratory-webhook
```

Configure secrets no ambiente das funções e um agendador com frequência operacional
aprovada. Não habilite cron antes de implementar/homologar o adaptador.
O público não acessa o processador da fila nem suas tabelas.

Outbox: reivindicação atômica com `SKIP LOCKED`, lease de 2 minutos, chave idempotente
persistida, timeout por envio, backoff exponencial limitado a 1 h, até 8 tentativas.
Após o limite, a solicitação continua salva para intervenção autorizada. Não apague jobs.
Confirme o suporte do laboratório à idempotência ou implemente reconciliação antes
de reenvio após timeout: uma chamada remota pode ter sido aceita mesmo sem resposta.
Não é possível garantir entrega exatamente uma vez sem cooperação da API externa.

Os três estados são independentes:

- Integração: `not_configured`, `pending`, `sending`, `sent`, `failed`, `acknowledged`.
- Aceite: `awaiting`, `accepted`, `rejected`, com origem `api` ou `manual`.
- Operação: `awaiting_review`, `processing`, `scheduled`, `performed`, `completed`, `cancelled`.

Confirmação manual exige ADM, justificativa e auditoria; não se passa por resposta de API.
`apply_laboratory_event` deduplica eventos por ID persistido e só pode ser chamada pelo backend.
Após a homologação, prepare migration operacional auditada para ativar os jobs
`not_configured`, sincronizando solicitação, integração e outbox. Não habilite por variável isolada.

Pendências externas: documentação OpenAPI/contratos, sandbox, credenciais, requisitos
de assinatura, IDs de eventos, ordenação de eventos, mapeamento de status, limites,
semântica de idempotência, cancelamento, reconciliação e homologação de ponta a ponta.

## 7. Deploy, cabeçalhos e operação

```sh
npm ci
npm test
npx tsc --noEmit
npm run build
```

O destino padrão continua Cloudflare/Nitro. Configure secrets no Worker e preserve
`nodejs_compat`. Não use hosting puramente estático: autenticação e cadastro precisam do BFF.
Revise o nome gerado do Worker e o domínio real antes de qualquer publicação.
Nenhum deploy é executado por este trabalho.

CSP usa nonce por requisição em produção, restringe scripts à origem e ao Turnstile,
permite estilos inline necessários aos componentes existentes e fontes Google.
São aplicados nos responses do servidor: frame-ancestors/X-Frame-Options, nosniff,
Referrer-Policy, Permissions-Policy e HSTS para HTTPS de produção.
As APIs e documentos da área interna não devem ser armazenados em cache pelo CDN.
Replique as proteções relevantes no ingress para assets estáticos e erros gerados fora do app.
Teste fontes, animações, hidratação e Turnstile no domínio real após configurar o ingress.

### Retenção, backups e incidentes

Antes de atender pacientes reais, a MUGUI deve aprovar:

1. Controlador/encarregado e contatos reais; bases legais para dados de saúde e laboratório destinatário.
2. Prazos de retenção por categoria, inclusive comentários, auditoria e backups.
3. Rotina autorizada de expurgo/anonimização respeitando obrigações de preservação e trilhas de auditoria.
4. Atendimento a solicitações de titulares, conferência de identidade e tratamento de bloqueios legais.
5. Backup e recuperação compatíveis com o plano contratado; teste de restauração e metas de RPO/RTO.
6. Monitoramento de falhas/abuso sem PII, resposta a incidentes e rotação de secrets.
7. SLA interno opcional com limite formalmente aprovado; nenhum prazo laboratorial foi inventado.

O aviso em `/privacidade` é um espaço técnico inicial e **não é a política jurídica final**.
Não abrir a operação antes dessa aprovação.
Não existe rotina automática de exclusão de pacientes nem exportação irrestrita.
Para os rate limits, agende limpeza de entradas expiradas no schema privado por tarefa
administrativa, em ambiente revisado, sem exportar as chaves HMAC.

### Chaves

Guarde `DOCUMENT_ENCRYPTION_KEY` em secret manager com acesso restrito e backup separado.
A versão atual é `v1`. Perder a chave impede recuperar documentos.
Rotação exige introduzir uma nova versão, recriptografar registros em lote auditado
e preservar a chave antiga até concluir a migração e o ciclo de backups.
Rotação HMAC também exige estratégia versionada; não troque diretamente durante a operação.

## Referências oficiais utilizadas

- [TanStack Start: server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [Supabase: servidor e cookies](https://supabase.com/docs/guides/auth/server-side)
- [Supabase: MFA e AAL](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase: escopos de logout](https://supabase.com/docs/guides/auth/signout)
- [Cloudflare: configurações do widget Turnstile](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)
