# Adaptação da timeline original — 04/11/2026

Fonte: código fornecido pelo usuário no anexo `4140aa18-04c9-4787-ade7-cf19edc592a7/Pasted text.txt`, identificado como construído com [Hyperiux Vault](https://vault.hyperiux.com). A atribuição foi mantida em `Process.tsx`.

## Alterações

- `src/components/landing/Process.tsx`: adotada a sequência original de crescimento simultâneo da ramificação e do ponto, seguida pela revelação de títulos e descrições com SplitText `chars, words, lines` e `mask: lines`. Títulos e descrições são divididos separadamente, como no código recebido. As ramificações alternam sua origem de crescimento acima e abaixo do eixo.
- `src/styles.css`: incluídos os ramos e pontos terminais, com os azuis MUGUI sobre fundo claro. Mantidos os marcadores centrais e a leitura em ordem das cinco etapas.
- `docs/SITE_UPDATE_REPORT.md`: atualizada a informação sobre a disponibilidade do original.

Mantidos os cinco textos exatos, título e subtítulo, a seção única `#processo`, a fixação no desktop e o deslocamento calculado pelo conteúdo real. As animações dos itens agora compartilham a timeline de scroll para garantir sincronização e reversão até a quinta etapa, sem depender dos percentuais de uma demonstração com sete eventos. No mobile permanece a alternativa vertical animada autorizada. O modo de redução de movimento oferece todos os textos sem fixação ou deslocamento horizontal.

O código original utiliza um hook local que encapsula `gsap.context`. A adaptação reutiliza o `gsap.matchMedia` já existente no projeto para gerenciar os mesmos recursos com troca de breakpoint, escopo local e limpeza. Não foi adicionada uma dependência de hook. Todos os SplitText são revertidos ao desmontar ou trocar o modo de exibição.

Não foram reintroduzidos anos, meses, períodos históricos, textos demonstrativos ou a imagem remota. Header, Footer, logo, loading, formulário, autenticação e integração com Supabase não foram alterados nesta adaptação.

## Validação

- TypeScript e ESLint do componente: passaram.
- Testes existentes: 53 passaram, em 13 arquivos.
- Build de produção: passou.
- Verificação em navegador nos tamanhos 320, 375, 430, 768, 1024, 1440 e 1920 px, incluindo scroll reverso e redução de movimento: resultados em `artifacts/mugui-review/final/original-timeline-results.json`, com capturas na mesma pasta.

Não houve instalação de dependências, commit, push ou operação no Supabase.
