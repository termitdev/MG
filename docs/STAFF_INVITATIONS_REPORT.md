# Convites de funcionários — 05/11/2026

## Resultado

O cadastro do dashboard usa o convite oficial do Supabase Auth, com envio pelo
SMTP configurado no Supabase. O único envio real autorizado foi aceito pela API.
O destinatário confirmou recebimento, definição da senha e acesso ao painel no
ambiente local. A leitura posterior confirmou perfil `staff`, `active=true`,
`invitation_pending=false`, `can_view_sensitive=false` e e-mail confirmado.
Os eventos de envio e conclusão também foram confirmados na auditoria remota.

Não houve outros convites, alteração de contas preexistentes, gravação de
pacientes, envio de senha, integração direta com a API Resend, commit ou push.
A conta de teste foi mantida conforme a orientação recebida.

## Antes e depois

Antes, o endpoint criava uma conta confirmada com `createUser()` e enviava
`resetPasswordForEmail()` para definir a primeira senha. Agora ele exige ADM
ativo com MFA, valida os campos, consulta a existência do e-mail e chama
`auth.admin.inviteUserByEmail()` exclusivamente no backend. A recuperação de
senha continua disponível para contas existentes e não é usada como convite.

O formulário preserva nome, e-mail, perfil, acesso ativo e autorização auditada de
dados pessoais completos. O botão passou a ser **Enviar convite**, com estado
discreto de envio. A mensagem solicitada só aparece após confirmação real do
backend. Falhas SMTP não produzem falso sucesso; os dados do formulário são
preservados. Os estados são Convite pendente, Ativo e Inativo.

## Callback, sessão e senha

`redirectTo` aponta para a origem autorizada mais `/auth/callback`. O template
Invite user preserva `{{ .ConfirmationURL }}` no botão Aceitar convite. O link
oficial é consumido pelo Supabase; a página recebe os tokens no fragmento,
remove-os imediatamente da URL e os encaminha ao BFF por POST.

O BFF estabelece a sessão com `auth.setSession()` e valida `auth.getUser()` e o
perfil no banco. Cookies permanecem HttpOnly, SameSite=Lax e Secure em HTTPS.
Não há tokens em localStorage nem redirecionamento externo recebido do cliente.
A rota é noindex/noarchive e declara no-referrer. Links anteriores com token hash
continuam usando `verifyOtp`. Erros, expiração e links já concluídos são tratados.

A tela mostra **Bem-vindo à MUGUI**, a descrição solicitada, nova senha,
confirmação e **Concluir cadastro**. Exige correspondência e 12–128 caracteres;
o Supabase aplica também sua política configurada. A senha é salva apenas por
`auth.updateUser()`. Não é escrita em tabelas públicas nem registrada em logs.
Requisições simultâneas são bloqueadas.

Depois de atualizar a senha, uma RPC confirma que o Auth possui e-mail confirmado
e senha cadastrada, conclui o estado pendente e registra auditoria. A operação é
idempotente. Se Auth salvar a senha e a conclusão do perfil falhar, uma nova
tentativa com a mesma senha pode concluir a etapa sem ficar presa no erro
`same_password`. Administradores novos ainda precisam concluir MFA antes do
dashboard; a definição inicial da senha não concede acesso aos dados antes disso.

## Permissões, RLS e falhas parciais

`invitation_pending` foi adicionado ao perfil existente, sem tabelas novas. Tanto
`requireStaff` quanto os predicados RLS `private.is_active_staff()` e
`private.is_admin()` bloqueiam convites pendentes. A sessão pendente permite
somente concluir o acesso e as operações de autenticação necessárias.

Papéis e permissões são gravados por operações administrativas do servidor.
Metadados do convidado não concedem papel, atividade nem visualização de dados
pessoais. O marcador de convite usado pelo trigger somente restringe o perfil.
Concluir a senha não modifica `active`, `role` ou `can_view_sensitive`. Uma conta
desativada não é reativada pela aceitação do convite.

Consulta de contas, registro das permissões do convite e conclusão são RPCs
exclusivas de `service_role`. O backend valida ADM/AAL2 antes das operações
administrativas. O gerenciamento anterior e as regras de acesso por solicitação
foram preservados. Administradores não alteram o próprio acesso.

Envio e banco não formam uma transação distribuída. Se o e-mail for aceito e a
configuração do perfil falhar, o servidor retorna erro explícito, registra a
falha e tenta preservar uma entrada pendente, inativa e sem privilégios para
recuperação administrativa. Não exclui contas nem sobrescreve perfis existentes
nessa recuperação. Não há reenvio automático após falha de transporte.

## Reenvio

O serviço conectado informou Auth **v2.197.0** em `/auth/v1/health`. A implementação
oficial dessa versão permite convidar novamente uma conta ainda não confirmada
e rejeita contas confirmadas. O backend restringe o reenvio a perfil pendente
ativo, conta realmente convidada, e-mail correspondente e ainda não confirmado.
Há limite por ADM e por destinatário, compartilhado com o envio inicial.

Depois de aceitar o link, o funcionário deve retomar sua sessão para concluir a
senha. O botão não envia recuperação como substituto de convite. Reenvio real
não foi executado: a autorização limitava o teste a um único convite.

## Migrations e configuração remota

- `202611050001_staff_invitations.sql`: coluna pendente, RLS, lookup de contas,
  registro administrativo do convite e conclusão auditada.
- `202611050002_staff_invitation_trigger.sql`: instalação idempotente do trigger
  quando ausente, sem alteração de contas existentes.
- `supabase/checks/staff_invitation_trigger.sql`: diagnóstico somente de leitura.

O responsável aplicou as duas migrations no SQL Editor e confirmou sucesso.
A consulta de diagnóstico executada por ele retornou o trigger
`mugui_auth_profile_created`, habilitado, AFTER INSERT em `auth.users`, apontando
para `private.ensure_auth_profile()`.

No teste real inicial, o Auth criou a conta sem o perfil correspondente. Isso foi
detectado antes de conceder qualquer acesso. Somente o perfil dessa conta nova
autorizada foi inicializado como Funcionário pendente e sem permissão sensível,
com auditoria. Não foi necessário reenviar o convite. A migration complementar
corrige a instalação automática para os próximos usuários. Seu comportamento
foi testado em PostgreSQL local, inclusive sem trigger prévio e sem duplicações.
Não foram criadas outras contas remotas para exercitá-la.

O responsável confirmou manualmente SMTP Resend, remetente MUGUI, template
personalizado, uso de ConfirmationURL e allowlist
`http://localhost:8080/auth/callback`. A chave administrativa Auth não permite
inspecionar diretamente a configuração SMTP ou os catálogos SQL; não havia token
de Management API disponível. Essas verificações remotas dependeram do painel,
além do recebimento real confirmado pelo destinatário.

## Arquivos alterados nesta implementação

- `src/components/admin/Users.tsx`: formulário, mensagens, estados e reenvio.
- `src/components/admin/AdminShell.tsx`: redireciona perfis pendentes ao acesso.
- `src/components/auth/Access.tsx`: callback e configuração inicial de senha.
- `src/routes/auth.callback.tsx` e `src/routeTree.gen.ts`: rota e registro gerado.
- `src/lib/scheduling.ts`: estado pendente no tipo de perfil.
- `src/services/backend/api.server.ts`: endpoints e integração do convite.
- `src/services/backend/supabase.server.ts`: autorização e sessão pendente.
- `src/services/backend/invitations.server.ts`: envio, reenvio e falhas parciais.
- As duas migrations e a consulta SQL citadas acima.
- `scripts/check-invitation-config.mjs`: checagem sem envio e saída sem segredos.
- `src/test/auth-http.test.ts`, `src/test/auth-ui.test.tsx`,
  `src/test/invitation-ui.test.tsx`, `src/test/invitation-migration.test.ts`.
- `README.md`, `docs/PLATFORM_SETUP.md`, `docs/AUTHENTICATION_FIX_REPORT.md`
  e este relatório.

Nenhuma dependência foi adicionada. Arquivos `.env`, logo, navegação pública,
paleta, animações e layout geral do dashboard não foram modificados.

## Testes e limites

- **118 testes aprovados em 23 arquivos**. Incluem SDK Supabase real com HTTP
  controlado, UI em Strict Mode, duplicidade, MFA, campos/permissões, falhas SMTP,
  callback inválido/expirado, estados pendentes e inativos, reenvio elegível,
  recuperação existente e retomada após falha parcial na definição de senha.
- PostgreSQL local PGlite: migrations completas, trigger, privilégios de RPC,
  bloqueios RLS e conclusão idempotente sem reativação administrativa.
- TypeScript e build de produção aprovados.
- ESLint dos arquivos de código alterados: zero erros e um aviso anterior de
  Fast Refresh em `AdminShell.tsx`. Lint global permanece com 4.184 erros de
  formatação e 7 avisos anteriores; não foi feita reformatação geral.
- Dois testes anteriores de agendamento ainda emitem aviso `act`, sem falhas.
- Navegador real: formulário administrativo e callback em 320, 375, 430, 768,
  1024, 1440 e 1920 px, sem overflow horizontal ou exceções de página.
  Esses cenários de interface usam respostas sintéticas isoladas, identificadas
  como SIMULACAO; não enviaram e-mails reais.
- Integração real autorizada: um convite aceito, recebimento e conclusão
  confirmados pelo destinatário, estado final e auditoria lidos no Supabase.
- Pacientes: leitura anônima recusada no banco conectado. Não foram lidos ou
  alterados dados de pacientes durante a validação.
- Valores administrativos de ambiente não encontrados no bundle público.
- Evidências locais em `artifacts/mugui-review/invitations/`.

O fluxo real foi validado em localhost. O domínio público configurado continuou
com `ENOTFOUND` nesta estação; publicação, DNS e callback HTTPS de produção não
foram validados ao vivo. Novos convites ADM, falhas SMTP e reenvio foram testados
com respostas controladas, sem envios adicionais. Não há pendência de alteração
de código para o fluxo local validado.

## Referências oficiais

- [Supabase: inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- [Auth v2.197.0: condições de convite e reenvio](https://github.com/supabase/auth/blob/v2.197.0/internal/api/invite.go)
- [Supabase: templates e ConfirmationURL](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase: SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend: SMTP no Supabase](https://resend.com/docs/send-with-supabase-smtp)
