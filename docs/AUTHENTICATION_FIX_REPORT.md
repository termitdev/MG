# Correção de autenticação — 04/11/2026

O cadastro inicial de funcionários descrito neste relatório foi substituído pelo
[convite oficial Supabase + SMTP Resend](STAFF_INVITATIONS_REPORT.md).

## Causas confirmadas

1. **`GET /api/auth/session` 503:** o processo Vite na porta 8082 havia sido iniciado antes da configuração local. A resposta era “Serviço aguardando configuração segura”, não um erro de senha. Um processo novo, com o mesmo código anterior e o arquivo atual, devolveu 401 para uma consulta sem sessão, comprovando a diferença de ambiente carregado.
2. **`POST /api/auth/login` 403:** o corpo da resposta era “Origem não autorizada”. A proteção comparava a origem pública de `APP_ORIGIN` com `http://192.168.0.217:8082`, rejeitando a chamada antes de consultar as credenciais.
3. **Configuração inicialmente inconsistente:** URL remota do Supabase em HTTP e chave com papel `anon` no campo administrativo. O usuário corrigiu os valores no `.env.local`. A revisão final passou, incluindo consultas reais com as chaves corretas. As chaves de criptografia também passaram na verificação de formato. Nenhuma chave foi publicada ou registrada nos logs.

O processo antigo da porta 8082 foi identificado como o Vite deste projeto e reiniciado. O servidor de desenvolvimento continua disponível nessa porta. O usuário confirmou que o login real voltou a funcionar.

## Correções implementadas

- Carregamento de `.env.local` no backend com atualização dos valores inseridos pelo próprio Vite em reinícios internos, sem transformar segredos em variáveis públicas de frontend.
- Origem de desenvolvimento calculada a partir da porta efetiva e das interfaces locais privadas da máquina, sem confiar em Host ou cabeçalhos encaminhados para definir permissões. A origem recebida também precisa coincidir com a origem do destino da requisição; `cross-site` continua rejeitado.
- Em produção, a lista local é ignorada e `APP_ORIGIN` exige HTTPS. A configuração revisada pelo usuário já utiliza HTTPS na origem pública.
- Cookies HttpOnly, SameSite=Lax, Path=/ e sem Domain. Secure em HTTPS de produção; cookies funcionais no HTTP local. Renovação e exclusão no logout preservadas. A validade efetiva da sessão continua subordinada aos tokens e às políticas de sessão do Supabase; o armazenamento do cookie não concede acesso por si só.
- `getUser()` valida a identidade com o provedor. O perfil correspondente precisa existir, estar ativo e ter papel reconhecido. Erros de consulta não são mais confundidos com conta inativa. Administradores continuam sujeitos a MFA/AAL2.
- Login e sessão distinguem autenticação, autorização, configuração, limites e indisponibilidade. Falhas previsíveis não viram 503 indiscriminadamente.
- Removidas repetições automáticas de operações PostgREST no BFF. A renovação legítima de sessão pelo Auth permanece disponível.
- `Access.tsx` não oculta erros de configuração da consulta inicial. A verificação de link/sessão é compartilhada entre as execuções de efeito do StrictMode, e uma trava imediata impede envios simultâneos. Não há retry automático de login. Falhas liberam o formulário.
- O cliente HTTP trata falhas de rede e respostas não JSON com mensagens seguras, preservando cancelamentos explícitos usados pelo agendamento.

| Situação | Resposta |
| --- | --- |
| Sem sessão, token inválido, sessão expirada sem renovação ou credenciais rejeitadas | 401 |
| Perfil ausente/inativo, papel sem permissão, MFA pendente para operação protegida ou origem rejeitada | 403 |
| Campos inválidos | 400 |
| Conta já existente ou divergência de e-mail entre Auth e perfil | 409 |
| Limite de tentativas | 429 |
| Configuração ausente/inválida ou estrutura obrigatória do banco indisponível | 500 com código de configuração |
| Falha transitória do provedor/banco/rede | 503 |

Os códigos públicos não incluem segredos, SQL, resposta interna do provedor ou detalhes de pacientes.

## Cadastro exclusivo pela administração

- Backend usa `supabase.auth.admin.createUser()` com endereço validado, `email_confirm: true` e sem senha temporária/compartilhada. Não usa `signUp()` nem confirma automaticamente cadastros públicos.
- Exige administrador autenticado, perfil ativo e AAL2 antes de acessar a API privilegiada. Funcionários e administradores com MFA incompleto não podem criar contas. A chave administrativa permanece no backend.
- A função `manage_staff_profile` cria/atualiza o vínculo e registra auditoria. Alterações no próprio acesso continuam proibidas. Ativação/desativação também atualiza o bloqueio no Auth; perfil e RLS impedem operações com JWT ainda válido de conta desativada.
- O funcionário define sua senha pessoal por link de recuperação de uso único. Nenhuma senha é enviada por e-mail. O template e os redirecionamentos devem seguir [PLATFORM_SETUP.md](PLATFORM_SETUP.md).
- Falha no envio de e-mail não é apresentada como entrega bem-sucedida e não provoca nova criação da conta. A tela permite reenviar instruções para um acesso ativo.
- O backend verifica a correspondência entre o e-mail Auth e o perfil antes de alterar permissões ou reenviar instruções, evitando direcionar o link à conta errada.
- O bootstrap manual do primeiro administrador foi ajustado para o mesmo modelo, sem senha fixa. Não foi executado nesta correção.

## Migration preparada, sem aplicação remota

`supabase/migrations/202611040002_auth_profiles.sql` adiciona a inicialização transacional de perfis inativos em novos registros Auth e recupera vínculos ausentes como funcionários inativos. Não promove contas a partir de `user_metadata`, não sobrescreve perfis existentes e registra auditoria. Não remove usuários ou tabelas nem flexibiliza RLS.

A migration foi executada somente em PostgreSQL local descartável nos testes. Não foi aplicada ao Supabase remoto. O fluxo principal já grava o perfil pela RPC existente; a migration acrescenta proteção contra cadastros incompletos e criação externa de usuários Auth.

## Validação

- `npm run check:auth -- --probe`: variáveis válidas; Auth público, API administrativa e tabela `profiles` responderam 200. O comando sinaliza falha enquanto `disable_signup` permanecer falso, conforme a pendência abaixo.
- Leitura remota: o perfil administrativo ativo corresponde a um usuário Auth com e-mail confirmado e sem bloqueio. As RPCs de rate limit e gestão de perfis estão disponíveis.
- Consulta anônima à tabela de perfis: 401, nenhum perfil exposto.
- Requisições reais em localhost e IP local: sem sessão, 401; login com corpo vazio, 400; origem não autorizada, 403. Não foram feitas tentativas artificiais de senha contra usuários reais.
- Login real confirmado pelo usuário após reiniciar o backend.
- Navegador em 375 e 1440 px, em localhost e IP local: uma consulta inicial de sessão por página, nenhum loop, erro JavaScript, alerta indevido ou overflow. Capturas e resultados em `artifacts/mugui-review/auth/`.
- **79 testes passaram em 17 arquivos.** Os novos testes usam o BFF e SDK Supabase reais com HTTP do provedor interceptado, verificando login, perfil ativo, token inválido, renovação, flags dos cookies, logout, CSRF, MFA obrigatório, criação administrativa, falha de e-mail, configuração e prevenção de elevação de privilégios. Testes React verificam envio único e uso único de links; PostgreSQL local verifica a migration e preservação de permissões.
- TypeScript, lint do conjunto alterado e build de produção passaram. O lint global apresentou 4.184 erros da regra `prettier/prettier` e sete avisos, mantendo as pendências de formatação já registradas no repositório; o conjunto revisado passou sem erros ou avisos.
- Varredura dos 28 arquivos públicos do build: nenhuma ocorrência dos valores reais da chave administrativa ou das chaves de criptografia/HMAC.

## Arquivos modificados

- Backend: `src/services/backend/{api.server,supabase.server,origin.server,crypto.server}.ts`, `src/lib/{security,backend-config}.ts`.
- Interface: `src/services/api.ts`, `src/components/auth/Access.tsx`, `src/components/admin/Users.tsx`.
- Configuração/diagnóstico: `vite.config.ts`, `.env.example`, `.gitignore`, `package.json`, `scripts/check-auth-config.mjs`, `scripts/provision-first-admin.mjs`.
- Banco: nova migration `202611040002_auth_profiles.sql`.
- Testes: `src/test/{auth-http.test,auth-config.test,auth-profile-migration.test,auth.test,document-crypto.test}.ts` e `auth-ui.test.tsx`.
- Documentação: este relatório, `PLATFORM_SETUP.md` e referência no README.

Nenhuma dependência foi adicionada. Os arquivos reais `.env` não foram editados pelo agente; somente o exemplo foi atualizado. Cópias com nomes como `.env copy.example` também passam a ser ignoradas pelo Git.

## Limites e pendências

Não foram criados funcionários, enviados e-mails, alteradas permissões ou executadas migrations no Supabase remoto por esta validação. A criação administrativa e o ciclo completo do e-mail foram testados com provedor interceptado; entrega SMTP e abertura do link por um novo funcionário dependem do template, allowlist e SMTP reais. A migration complementar aguarda revisão/aplicação autorizada. Nenhum mecanismo de segurança foi desativado e o design não foi alterado. Sem commit, push ou publicação.

**Configuração externa encontrada:** na consulta ao Auth, `disable_signup` estava falso. A MUGUI não expõe cadastro público e exige perfil ativo autorizado no backend, mas a opção “Allow new users to sign up” também deve ser desativada no painel Supabase. A chave administrativa da aplicação não substitui acesso ao painel/Management API para alterar essa configuração. O diagnóstico `--probe` agora sinaliza essa condição e termina com falha enquanto o provedor permitir novos cadastros públicos.

Referências: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates), [SSR e cookies](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [tipos de chave](https://supabase.com/docs/guides/getting-started/api-keys), [configuração de novos cadastros](https://supabase.com/docs/guides/auth/general-configuration) e [configuração pela Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
