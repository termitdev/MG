# MUGUI — atualização do site e validação local

> Atualização posterior: a logo atual é colorida e a paleta foi substituída pelos quatro novos azuis. As observações abaixo sobre logo branca e base azul descrevem a versão anterior. Consulte [a identidade cromática atual](COLOR_IDENTITY_REPORT.md).

Data: 04/11/2026. Alterações realizadas nos arquivos existentes, sem commit, push, publicação ou execução de migrations remotas. As fotografias alteradas pelo usuário foram preservadas.

## Aparência e conteúdo

- Interface predominantemente branca, com fundos `#F8FBFF`, `#F0F8FF` e `#EAF4FC`, bordas `#E2E8F0` e azuis institucionais. Header, Hero, cards, formulário, login e painel receberam a direção visual clara solicitada. Tipografias, fotografias, composição, navegação e interações foram mantidas. Footer permanece azul-marinho.
- Logo original branca mantida sem recoloração. O Header utiliza uma base azul-marinho para permitir sua leitura, sem cápsula branca. Header e Footer compartilham `/logomg.png`.
- Removidos os três indicadores públicos de experiência, exames e prazo, incluindo seu componente de contagem. Também foram retirados dois placeholders numéricos da seção de diferenciais. Os indicadores internos do painel continuam consultando dados autorizados do backend.
- Dados institucionais centralizados em `src/config/company.ts`: endereço, telefone, WhatsApp, Instagram e CNPJ. O CNPJ passou na verificação matemática dos dígitos; isso não comprova situação cadastral na Receita Federal. Crédito “Site desenvolvido por Termit” preservado como texto, pois não foi fornecida uma URL confirmada.
- Incluídas as explicações institucionais sobre exigências CNH/CLT/RBAC 120 e finalidade das matrizes, com qualificações e fontes oficiais. Não foram inventados horários, avaliações, coordenadas ou prazos universais de detecção. O conteúdo deve receber aprovação técnica/jurídica da MUGUI antes da publicação.

## Timeline Como funciona

GSAP 3.15.0, ScrollTrigger e SplitText, com cinco etapas e os textos exatamente solicitados. No desktop, a seção é fixada, o deslocamento usa a largura real do conteúdo, os blocos alternam acima e abaixo da linha e a linha, os marcadores e as palavras são revelados conforme o scroll. A rolagem reversa desfaz a animação. Mobile e janelas baixas usam timeline vertical; redução de movimento mantém conteúdo estático legível. Recursos e divisões do SplitText são revertidos ao desmontar ou trocar o modo responsivo.

O código original do Hyperiux Vault foi recebido posteriormente no anexo `4140aa18-04c9-4787-ade7-cf19edc592a7/Pasted text.txt` e a timeline foi atualizada a partir dele. A adaptação preserva a sequência de ramificações verticais, pontos e revelação de linhas mascaradas do SplitText. Foram removidos anos, meses e imagem demonstrativa. O contexto GSAP responsivo existente foi mantido para limpeza, redução de movimento e fallback vertical, e percentuais fixos de deslocamento foram substituídos pela largura real. Consulte [o complemento da timeline](TIMELINE_ORIGINAL_REPORT.md).

## Loading Liquid Glass

A instalação pelo registro do 21st.dev foi tentada e exigiu autenticação. Conforme a alternativa expressamente autorizada, foi adaptado o shader completo da implementação MIT [glass-icon-reveal](https://github.com/zanwei/glass-icon-reveal), com licença preservada em `src/components/ui/glass/LICENSE.glass-icon-reveal`.

- Gota, expansão, refração, dispersão cromática, SDF e dinâmica de molas preservados. Reflexos de ambiente foram ajustados para tornar a superfície de vidro perceptível sobre branco.
- Exclusivamente `/logomg.png`, cores originais e fundo branco; nenhuma marca demonstrativa. Sem texto visível no loading inicial, com nome acessível para leitores de tela.
- Loading inicial aguarda o callback de conclusão real da animação. Existe limite de segurança de seis segundos para falhas, não uma duração mínima artificial. Sem WebGL2 ou com redução de movimento, mostra o PNG original.
- No agendamento, a animação ocorre uma vez; a logo permanece enquanto a requisição está pendente. Somente resposta confirmada do backend produz sucesso. Timeout ou falha ambígua preserva o formulário e a chave idempotente, permitindo verificar o recebimento antes de reenviar.
- Nova reconciliação `POST /api/booking/reconcile`, protegida por origem, limite de requisições e correspondência entre chave idempotente e impressão HMAC da solicitação. Não retorna dados de pacientes.

Foi encontrado um 404 causado pela ausência do nome canônico `logomg.png`, enquanto a imagem existia com outro nome. O arquivo foi restaurado por cópia byte a byte, preservando também o arquivo original. SHA-256: `C28E6883ECA6A462AD693E2CE4620603B049156201387EAF23CB4829DFAAD494`.

**Limitação aceita expressamente pelo usuário:** a imagem é branca sobre transparência. Ao final da revelação sobre fundo branco, sua leitura tem baixo contraste. A imagem não foi recolorida. Os reflexos do vidro durante a animação não alteram suas cores originais.

## Acesso e administração

- Botão “Área do Funcionário” no Header e menu mobile direciona para `/login`.
- `/login` reutiliza o componente de autenticação existente. `/acesso` permanece como alias compatível com links de convite e recuperação já configurados.
- Painel existente integrado, sem cadastro público: sessão, usuário ativo, recuperação, logout, proteção de rotas, permissões no backend e RLS. Administradores precisam de MFA.
- Área administrativa identificada como “Gerenciar Usuários”, com convites, perfis, ativação/desativação e auditoria no backend. Funcionários não recebem essas operações privilegiadas.
- Nenhuma migration adicional foi necessária nesta atualização. A estrutura preparada está em `supabase/migrations/202611040001_platform.sql`, com RLS e funções restritas. Provisionamento seguro do primeiro administrador descrito em [PLATFORM_SETUP.md](PLATFORM_SETUP.md), sem senha fixa.
- Não houve aplicação remota de SQL ou alteração de permissões em produção. Chaves administrativas permanecem exclusivamente no servidor.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Passou, incluindo saída SSR/Nitro |
| `npx tsc --noEmit` | Passou |
| `npm test` | 53 testes, 13 arquivos, todos passaram |
| Lint global | Falha por regras de formatação Prettier em arquivos do repositório; não foi feita reformatação indiscriminada dos componentes existentes |
| Responsividade | 296 verificações em 16 cenários de viewport, incluindo 320, 375, 430, 768, 1024, 1440 e 1920 px, tamanhos intermediários, 2560 px e orientação horizontal; sem overflow horizontal ou erros JavaScript detectados |
| Zoom nativo Chrome 200% | 19 verificações de páginas públicas, formulário e áreas internas sem overflow detectado |
| Lint do conjunto revisado | Zero erros; um aviso de Fast Refresh |
| Prévia do build | 320, 768 e 1440 px: HTTP 200, CSP ativa, PNG carregado, cinco etapas e login acessível. Nenhum erro de execução JavaScript |
| Timeline | Sete larguras obrigatórias, cinco etapas, avanço/reversão e redução de movimento verificados |
| Overlays | Dialog, AlertDialog, Drawer e Popover em quatro larguras; conteúdo dentro do viewport, Escape e rolagem interna verificados |
| WebGL real | Mobile e desktop: `gl.getError() = 0`, cores originais habilitadas e parâmetros do shader evoluindo durante a animação; nenhum texto inicial visível |

As capturas e resultados JSON estão em `artifacts/mugui-review/`, ignorado pelo Git. Abra `artifacts/mugui-review/index.html` para consultar a galeria, que reúne o estado claro atual e capturas anteriores para comparação. O Chrome procura `/favicon.ico` automaticamente mesmo sem referência no HTML; essa solicitação retorna 404, conforme a remoção do favicon solicitada. Não foi adicionado um favicon para ocultar essa mensagem de rede.

Os cenários de painel usam respostas sintéticas interceptadas **somente no teste de navegador**, sem inserir dados fictícios no aplicativo ou banco. Testes PostgreSQL locais verificam RLS e transações; não substituem homologação no projeto Supabase real.

Pares críticos de contraste medidos incluem branco sobre azul de ação (~5,02:1), azul-marinho sobre azul vibrante (~4,88:1) e texto secundário sobre branco (~5,88:1). Isso não representa certificação completa de acessibilidade.

Não foram testados aparelhos físicos ou teclados virtuais nativos. Supabase remoto, SMTP, convites reais, MFA em conta real, Turnstile e integração efetiva com laboratório dependem de configuração e homologação. As funções de integração permanecem fechadas até existir um adaptador real; não simulam aceite do laboratório.

## Arquivos desta atualização

- Conteúdo e identidade: `src/config/company.ts`, `src/components/landing/{Navbar,Footer,Hero,Differentials,Process,Reveal,ExamRequirements,ExamPurpose,Cta,Logo}.tsx`, exclusão de `Metrics.tsx`, `src/routes/index.tsx`, `src/styles.css`, `public/logomg.png`.
- Loading: `src/components/ui/{MuguiLoading,liquid-glass-logo-reveal}.tsx`, `src/components/ui/glass/{engine.js,engine.d.ts,LICENSE.glass-icon-reveal}`, `src/routes/__root.tsx`.
- Responsividade de overlays: `src/components/ui/{dialog,alert-dialog,drawer,popover,sheet}.tsx`.
- Acesso e painel: `src/routes/login.tsx`, `src/routeTree.gen.ts`, `src/components/auth/Access.tsx`, `src/components/admin/{AdminShell,AdminView,useData}.tsx`.
- Agendamento: `src/components/booking/BookingForm.tsx`, `src/services/backend/api.server.ts` e respectivos testes. Consultar o histórico de alterações local para os demais arquivos da plataforma já implementados durante esta sessão.
- Testes: arquivos em `src/test/` para empresa, loading, ciclo de vida, formulário, reconciliação e demais fluxos da plataforma.
- Dependências e documentação: `package.json`, `package-lock.json`, `bun.lock`, `README.md`, este relatório. GSAP foi a dependência de animação adicionada; não foi adicionada biblioteca visual para o loading.

## Fontes técnicas e institucionais

- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) e [SplitText](https://gsap.com/docs/v3/Plugins/SplitText/).
- [Regras do CTB — Ministério dos Transportes](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/novas-regras-do-ctb).
- [Portaria MTE 612/2024](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/sst-portarias/2024/portaria-mte-no-612-exame-toxicologico-altera-portaria-mtp-no-672_21.pdf/view).
- [ANAC — RBAC 120](https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac/rbac-120).
- [Resolução CONTRAN 923/2022](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-contran/resolucoes/Resolucao9232022.pdf).
