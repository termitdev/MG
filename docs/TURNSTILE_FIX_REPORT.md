# Correção do Turnstile — MUGUI

## Revisão do callback e da responsividade

A revisão seguinte identificou uma falha no próprio carregador: o evento `load`
resolvia a promessa e removia `window.muguiTurnstileReady`, embora o SDK ainda
pudesse procurar essa função. Isso explica os avisos de callback inexistente,
inclusive quando o widget já mostrava sucesso. Não era um acesso a `window`
durante SSR nem uma falha na leitura da sitekey.

O carregador agora utiliza exclusivamente o evento `load` do script com
`?render=explicit`, sem parâmetro `onload` e sem callback global. A promessa
compartilhada mantém um script por documento. Strict Mode, desmontagem,
remontagem, troca da função de callback e callbacks tardios foram cobertos por
testes. A desmontagem remove apenas o widget pela API do provedor.

O contêiner é medido com `ResizeObserver`: tamanho oficial `compact` abaixo de
300 px disponíveis e `flexible` a partir de 300 px. Uma mudança de categoria
remove o widget anterior e invalida seu token; variações de largura dentro da
mesma categoria não o remontam. Não há escala, recorte de iframe nem alterações
no layout geral. O aviso oficial de testes continua visível no ambiente local;
seu texto é desenhado pelo próprio Cloudflare.

O botão final agora exige explicitamente consentimento, campos obrigatórios
válidos, configuração disponível e token presente, além de ausência de envio em
andamento ou confirmação incerta. O manipulador também verifica essas condições
para bloquear submissão direta. A validação definitiva continua no backend.

Arquivos de implementação desta revisão:

- `src/components/booking/Turnstile.tsx`.
- `src/components/booking/BookingForm.tsx`.
- `src/test/turnstile-ui.test.tsx`.
- `src/test/booking-ui.test.tsx`.
- Este relatório.

Validação desta revisão:

- **97 testes aprovados em 21 arquivos**. Dois testes existentes de formulário
  ainda emitem aviso de sincronização `act`, sem falhas nas asserções.
- TypeScript e build de produção aprovados.
- ESLint dos quatro arquivos de código alterados: zero erros e avisos.
- Lint global: 4.184 erros de formatação e 7 avisos preexistentes, sem alteração
  em relação ao diagnóstico anterior.
- SDK real em `localhost:8090` e `192.168.15.2:8090`: sucesso, Siteverify real
  aprovado, script único, ausência dos avisos de callback e de exceções de página.
  Verificados retorno à etapa anterior, remontagem e atualização da página.
- Larguras 320, 375, 430, 768, 1024, 1440 e 1920 px nos dois hosts, sem overflow
  horizontal. Tamanhos oficiais também cobertos por teste de redimensionamento.
- Falha do script, expiração, falha do widget e recuperação manual verificadas
  com callbacks controlados: token invalidado, envio bloqueado, dados preservados.
- Submissão da interface verificada nos dois hosts com Siteverify real e somente
  a resposta final de agendamento simulada para evitar pacientes fictícios.
- As políticas de chaves de produção, rejeição de tokens inválidos/expirados e
  proteção anterior à gravação continuam cobertas pela suíte do backend.
- Produção ao vivo **não validada**: DNS do domínio público retorna `ENOTFOUND`.
  A CSP continua bloqueando uma tentativa não fatal de `eval` do desafio;
  não foi enfraquecida para ocultar esse evento.

Evidências desta revisão: `artifacts/mugui-review/turnstile-callback/`, arquivos
`real-browser.json`, `recovery.json`, `submit.json` e capturas. Nenhum arquivo de
ambiente, segredo, autenticação, dashboard, configuração Supabase ou SQL foi
alterado. Sem commit, push ou deploy.

As seções seguintes preservam o diagnóstico e a implementação da primeira correção.

## Causa identificada

O navegador recebeu o código Cloudflare **110200 (Domain not authorized)** tanto
em `localhost:8082` quanto no IP local `192.168.0.217:8082`. A sitekey configurada
era lida corretamente, mas não autorizava esses hosts. O script oficial carregava
com HTTP 200; o iframe da verificação falhava com HTTP 400.

A CSP já autorizava `challenges.cloudflare.com` em `script-src`, `frame-src` e
`connect-src`. Não foi necessário enfraquecê-la. Também havia dois problemas
secundários: ausência de recuperação visível no widget e validação do hostname
do token sempre contra `APP_ORIGIN`, mesmo no acesso local autorizado.

Durante a validação no IP HTTP foi identificada outra falha: `crypto.randomUUID`
não está disponível nesse contexto. A geração da chave de idempotência agora
possui alternativa UUID v4 usando `crypto.getRandomValues`, preservando o formato
e a aleatoriedade criptográfica.

## Implementação

- `src/components/booking/Turnstile.tsx`: carregamento único do script oficial,
  inicialização explícita por callback `onload`, nonce da CSP, limites de tempo,
  descarte de callbacks após desmontagem, mensagens de erro e tentativa manual.
  Falha ou expiração apaga o token e bloqueia o envio. Alterações nos campos não
  remontam o widget. A recuperação preserva os dados e não inicia loops.
- `src/services/backend/turnstile.server.ts`: configuração centralizada e
  validação obrigatória no Siteverify, com timeout, erros seguros e verificação
  de hostname e ação `booking` para chaves reais.
- `src/services/backend/api.server.ts`: reutiliza essa configuração no endpoint
  público e na validação anterior à criação da solicitação. Apenas a sitekey
  pública é entregue ao navegador.
- `src/lib/submission-id.ts` e `src/components/booking/BookingForm.tsx`: UUID
  criptográfico também no acesso por IP HTTP.
- `.env.example`, `docs/PLATFORM_SETUP.md` e `README.md`: configuração e documentação.
- Testes: `turnstile-server.test.ts`, `turnstile-ui.test.tsx`,
  `submission-id.test.ts` e `booking-reconcile.test.ts`.

### Isolamento das chaves de teste

O par oficial de teste é selecionado automaticamente apenas quando
`NODE_ENV=development`, o hostname é local/privado e a origem completa corresponde
à lista confiável do servidor de desenvolvimento. `TURNSTILE_LOCAL_TEST_MODE=false`
desativa essa seleção. Domínios públicos continuam usando as chaves configuradas.

Mesmo no modo local, o backend chama o Siteverify e exige sucesso. Os metadados
fixos das respostas de teste são tratados somente nesse modo isolado. Fora dele,
chaves oficiais de teste e o token dummy são recusados; hostname e ação são
obrigatórios. A secret key permanece exclusivamente no servidor.

O aviso **“Somente para teste”** exibido pelo Cloudflare é esperado localmente.
Ele não deve ser ocultado. Em produção, configure o par real e autorize os
hostnames públicos no painel Cloudflare.

## Validação executada

- TypeScript: `npx tsc --noEmit` aprovado.
- Testes: **94 aprovados em 21 arquivos** (`npm test`).
- Build: `npm run build` aprovado.
- ESLint dos arquivos de código desta correção: zero erros e avisos.
- ESLint global: permanece bloqueado por 4.184 erros de formatação
  `prettier/prettier` e 7 avisos. Não foi feita reformatação geral do projeto.
- Navegador real, localhost e IP local: widget oficial de teste concluído,
  token recebido e Siteverify real com sucesso, um script ativo e envio
  habilitado após o consentimento.
- Falha de carregamento, expiração e falha do widget: envio bloqueado;
  recuperação manual funcional, sem perda de dados. Navegação entre etapas e
  rerenderizações também verificadas. Cenários de falha foram controlados por
  interceptações no navegador e testes automatizados.
- Envio completo da interface nos dois hosts: token real de teste validado no
  Siteverify; somente a resposta final de `/api/booking` foi simulada para não
  criar pacientes fictícios. Não houve gravação de agendamentos de teste.
- Token inválido com a chave real configurada: Siteverify respondeu
  `success=false`, código `invalid-input-response`. Teste automatizado confirma
  que rejeição impede a chamada à RPC de criação.
- Busca no bundle público: o valor da secret key configurada não foi encontrado.

Evidências locais em `artifacts/mugui-review/turnstile/`: `before.json`,
`after.json`, `recovery.json`, `submit.json` e respectivas capturas.

## Limites e configuração pendente

O domínio `muguitoxicologico.com.br` não resolveu DNS nesta estação (`ENOTFOUND`),
portanto a verificação no domínio público não pôde ser concluída. A política de
produção foi testada automaticamente, mas o funcionamento do widget no domínio
real depende de DNS, publicação e autorização do hostname no painel Cloudflare.
Cadastre os nomes públicos efetivamente utilizados, sem protocolo, caminho ou
porta, incluindo a variante `www` quando aplicável à configuração do widget.

Foi observado um evento não fatal de CSP bloqueando uma tentativa de `eval`
durante a execução do desafio. O widget e o Siteverify concluíram com sucesso;
`unsafe-eval` não foi adicionado. Esse evento continua bloqueado pela política.

Nenhum arquivo de ambiente real, configuração de Supabase, autenticação ou SQL
foi alterado nesta correção. Não houve deploy, commit ou push.

## Referências oficiais

- [Códigos de erro do Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/)
- [Chaves e comportamento de teste](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Renderização explícita](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/)
- [Validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Hostnames autorizados](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
