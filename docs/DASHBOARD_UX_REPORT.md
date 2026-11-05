# Loading, acesso e dashboard — 04/11/2026

## Diagnóstico do Liquid Glass

O loading era montado no componente raiz em cada novo documento. Vários links da própria aplicação eram âncoras HTML com navegação completa, incluindo os links públicos para agendamento e os links do painel. Cada navegação desse tipo recriava o documento e o loading inicial. O formulário de agendamento também montava explicitamente uma segunda instância fullscreen durante o envio.

Não foi encontrado um listener global de clique ou interceptor de API acionando a animação. A correção atua nos pontos de navegação e no indicador do formulário, preservando o componente visual, shader, logo original colorida e ciclo de liberação dos recursos WebGL.

## Comportamento atual

| Situação | Liquid Glass |
| --- | --- |
| Abrir um documento do site ou atualizar com F5 | Uma animação inicial |
| Entrar em `/login` ou `/acesso` a partir da área pública | Uma transição |
| Alternar entre as duas rotas de autenticação | Sem repetição |
| Login concluído e entrada no painel | Sem nova animação |
| Navegar entre módulos internos, conta e logout | Sem nova animação |
| Menu, filtros, busca, cards, etapas, validação e envio do formulário | Sem nova animação |
| WhatsApp, telefone, links externos e links em nova aba | Comportamento nativo preservado |

`AppLink` mantém a semântica da âncora e usa `router.navigate` para navegação local. Modificadores de teclado, download, nova aba e links externos permanecem nativos; links para seções da página mantêm seu scroll. A página raiz permanece montada nas navegações internas.

`EntryLoading` observa mudanças de contexto de rota. O estado de loading não está vinculado a cliques ou requisições. O formulário utiliza uma mensagem local de envio/verificação, mantém o bloqueio de envio simultâneo e só apresenta sucesso após a resposta do backend. Conta e redirecionamentos de sessão usam o mesmo roteador, preservando destino, autorização e substituição do histórico quando aplicável. O estado do histórico é preservado ao remover tokens do fragmento da URL.

O loading inicial continua sem texto visível, com fundo branco, cores originais, fallback PNG, redução de movimento, conclusão real da animação e limite de segurança para falhas. Não foi adicionada repetição infinita ou alterado o motor Liquid Glass. Uma navegação que abra um novo documento, como nova aba ou URL digitada, recebe naturalmente sua animação inicial.

## Acesso discreto

O Header e o menu mobile exibem **Acesso**, apontando para `/login`. O link tem apresentação discreta e área de toque de pelo menos 44 px. O CTA de agendamento permanece destacado. O título da rota passou para “Acesso — MUGUI”. Logo, navegação pública, conteúdo, composição e identidade do site público foram preservados.

## Dashboard

A imagem `Scadule board.jpg`, fornecida pelo usuário, orientou a sidebar compacta com cantos arredondados, a hierarquia, os controles discretos e a organização das superfícies. Não foi incluída como asset do produto.

Foram auditados e mantidos somente os módulos reais:

- Visão geral: indicadores recebidos da API e atualização existente.
- Pacientes, solicitações e laboratório: listagens autorizadas, busca, filtros, ordenação, datas, paginação e detalhes.
- Detalhes: dados mascarados/protegidos, responsável, status, comentários e histórico existentes.
- Histórico: auditoria ADM e orientação de consulta individual para funcionários.
- Gerenciar Usuários: cadastro, permissões, ativação/desativação e instruções de senha existentes, restritos ao ADM.
- Configurações: conta, segurança, informações de integração e privacidade já implementadas.

### Alterações visuais

- Workspace e conteúdo principal brancos, sidebar vertical com borda suave, cantos arredondados e navegação por ícones. Página ativa destacada em azul muito claro; detalhes de solicitação mantêm a seção correspondente selecionada.
- Header interno com identificação da página, iniciais derivadas do nome real, perfil, conta e logout. Drawer mobile reutiliza Radix Sheet, foco e Escape.
- Indicadores existentes reorganizados em cards compactos. O total recebe destaque suave. Não foram adicionadas tendências, gráficos, calendários ou números demonstrativos. Valores ausentes usam “—” e a espera média indisponível usa estado explícito; valores zero recebidos da API continuam sendo zero.
- Filtros agrupados em superfície própria, cabeçalho de tabela suave, hover discreto e listas de usuários/auditoria com bordas e espaçamento consistentes.
- Preservadas todas as colunas e as alternativas móveis existentes. Tabelas largas mantêm scroll local, sem expandir o documento.
- Troca de solicitação reinicia o componente de detalhes pela identidade do registro, evitando manter dados protegidos da solicitação anterior na navegação SPA. Troca de contexto de listagem reinicia seus filtros como ocorria na navegação anterior.

São utilizados os tokens existentes: `#FFFFFF`, `#E3F2FD`, `#90CAF9`, `#2196F3` e `#0D47A1`. Textos usam azul profundo ou neutros legíveis. Não foi criado um segundo tema nem adicionada dependência.

## Validação

- **82 testes passaram em 18 arquivos**, incluindo os testes existentes de autenticação, cookies, MFA, permissões, RLS e agendamento.
- Novos testes verificam a política de montagem do loading, navegação via roteador e preservação de âncoras externas/hash/modificadores. O teste de envio do agendamento verifica indicador local e ausência de Liquid Glass enquanto a resposta está pendente.
- TypeScript e build de produção passaram.
- Lint do conjunto alterado: zero erros, um aviso existente de Fast Refresh em `AdminShell.tsx`. Lint global: 4.184 erros de formatação `prettier/prettier` e sete avisos. Não foi feita reformatação indiscriminada do repositório.
- **148 verificações em oito larguras:** 320, 375, 430, 768, 1024, 1440, 1920 e 2560 px. Páginas públicas, formulário, login/recuperação/MFA, módulos internos, menus e detalhes sem overflow do documento ou erros JavaScript detectados.
- WebGL real em 375 e 1440 px: uma criação na abertura, outra ao entrar pelo Acesso; o identificador do documento e a contagem de contextos permaneceram iguais durante as ações rotineiras. F5 criou um novo documento com uma animação inicial. Retorno à conta e logout não criaram novos contextos.
- Verificação visual de ADM/funcionário: fundo principal branco, itens restritos ao ADM preservados, menu mobile e ausência de números inventados quando os indicadores não estão disponíveis.

Os cenários de navegador usam respostas sintéticas interceptadas exclusivamente para teste, identificadas nas capturas como SIMULAÇÃO. Não foram inseridos dados fictícios no produto ou no Supabase. A autenticação e as mutações privilegiadas não foram simuladas como sucesso em produção: os testes do backend continuam validando suas restrições de forma independente.

Capturas, galeria e JSON de evidências: `artifacts/mugui-review/dashboard-ux/`, ignorado pelo Git. A galeria local está em `index.html` nessa pasta. Nenhuma captura de dados reais de pacientes foi gerada.

## Arquivos modificados

- Novos: `src/components/platform/AppLink.tsx`, `src/components/platform/EntryLoading.tsx`, `src/test/navigation-loading.test.tsx` e este relatório.
- Raiz/rota: `src/routes/__root.tsx`, `src/routes/login.tsx`.
- Navegação pública: `src/components/landing/{Navbar,Footer,Hero,Cta}.tsx` — links e identificação Acesso, preservando o restante da apresentação.
- Fluxos existentes: `src/components/auth/Access.tsx`, `src/components/booking/BookingForm.tsx`.
- Painel: `src/components/admin/{AdminShell,AdminView,Overview,Requests,RequestDetail,Users,useData}.tsx/ts`.
- Estilos: `src/styles.css`, com regras do workspace isoladas do site público.
- Validação/documentação: `src/test/booking-ui.test.tsx`, `README.md`.

## Preservação e limites

Backend, APIs, SQL, RLS, chaves de ambiente, permissões e integrações não foram alterados nesta atualização. O menu discreto não modifica a segurança das rotas. A integração com laboratório continua no estado real em que estava, sem aceite ou dados inventados.

A verificação de UI do dashboard utilizou interceptações para não ler dados clínicos reais nem executar gravações remotas. Não foi feita uma nova homologação externa de SMTP, laboratório ou dispositivos físicos. As pendências operacionais registradas no [relatório de autenticação](AUTHENTICATION_FIX_REPORT.md) permanecem independentes desta atualização visual.

Sem commit, push, publicação ou execução de migrations.
