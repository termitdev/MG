# Atualização cromática MUGUI — 04/11/2026

Aplicada a paleta do anexo `d2ba6cdf-2bb9-4e36-976f-5a8d15c5f155/Pasted text.txt`. Esta atualização substitui a direção cromática dos relatórios anteriores. A imagem atual `public/logomg.png` é colorida e foi preservada sem edição.

## Arquivos modificados

- `src/styles.css`: nova paleta centralizada, aliases dos tokens existentes, superfícies claras, textos, cards, botões, estados de foco/hover, formulário, painel e cores da timeline.
- `src/components/landing/Navbar.tsx`: removida a base azul-marinho e o arredondamento do contêiner da logo. Padding, tamanho da imagem, navegação e breakpoints preservados.
- `src/components/auth/Access.tsx` e `src/components/admin/AdminShell.tsx`: removida a mesma base escura da marca, preservando os demais componentes e comportamentos.
- `src/components/landing/Footer.tsx`: textos e bordas adaptados ao Footer claro, sem cápsula atrás da logo. Endereço, telefone, WhatsApp, Instagram, CNPJ, links e crédito Termit preservados.
- Documentação: este relatório, referência no README e aviso de atualização no relatório anterior.

## Tokens e componentes

| Token oficial | Valor | Uso |
| --- | --- | --- |
| `--mugui-blue-50` | `#E3F2FD` | Superfícies claras, seções institucionais e fundo das áreas internas |
| `--mugui-blue-200` | `#90CAF9` | Linha da timeline e hover dos CTAs públicos |
| `--mugui-blue-500` | `#2196F3` | Botões, ícones, marcadores, destaques e progresso |
| `--mugui-blue-900` | `#0D47A1` | Títulos, links, textos institucionais e foco |
| `--mugui-white` | `#FFFFFF` | Header, Hero, Footer, cards, campos e superfícies |

Os nomes anteriores, como `--mugui-navy` e `--mugui-blue-primary`, agora são aliases destes tokens. Não existe um segundo sistema de tema. Textos e bordas neutros continuam disponíveis, assim como cores semânticas de erro. O azul profundo é usado principalmente em textos e estados de interação, sem grandes superfícies escuras.

As cores anteriores `#002040`, `#003060`, `#005090`, `#0090F0`, `#20B0F0` e `#ABB5BF` deixaram de definir a identidade da interface. A busca no código encontrou uma ocorrência remanescente de `#002040` no parâmetro óptico `logoColor` do adaptador Liquid Glass: foi preservada intencionalmente, pois o pedido proíbe alterar esse efeito. Esse parâmetro define um reflexo do shader e não um fundo ou uma recoloração da imagem. Não foram editados o shader, suas animações, nem as imagens/fotografias da marca.

Timeline: a linha usa azul-claro e os ramos/pontos usam azul principal. O código GSAP, ScrollTrigger, SplitText, posições, duração, deslocamento e cinco etapas não foram alterados.

## Contraste

O azul principal não oferece contraste AA com letras pequenas brancas. Por isso, botões nesse azul usam texto neutro `#111827`. Os links pequenos usam azul profundo, e o hover da navegação recebe sublinhado azul principal. Os destaques grandes do Hero usam azul principal sobre branco. Textos auxiliares de baixa opacidade foram ajustados para neutro legível.

| Combinação | Contraste calculado |
| --- | --- |
| Azul profundo / branco | 8,63:1 |
| Azul profundo / azul muito claro | 7,56:1 |
| Texto neutro / azul principal | 5,68:1 |
| Texto neutro / azul-claro | 10,14:1 |
| Texto secundário / azul muito claro | 6,62:1 |
| Azul principal / branco (texto grande) | 3,12:1 |

Essas verificações de pares críticos não equivalem a uma certificação completa WCAG.

## Validação e limites

- TypeScript: passou.
- ESLint dos quatro componentes editados: zero erros, um aviso de Fast Refresh em `AdminShell.tsx`.
- Lint global executado: 4.184 erros, todos da regra `prettier/prettier`, e sete avisos. A formatação dos demais arquivos do repositório não foi alterada indiscriminadamente.
- Testes existentes: 53 passaram, em 13 arquivos.
- Build de produção: passou.
- Revisão em navegador: 131 verificações nas larguras 320, 375, 430, 768, 1024, 1440 e 1920 px, incluindo página pública, Footer, etapas de agendamento, login, recuperação, MFA e páginas administrativas; nenhum overflow horizontal ou erro JavaScript detectado. Resultados e capturas em `artifacts/mugui-review/palette/`; galeria em `artifacts/mugui-review/palette/index.html`.
- Cores computadas no navegador confirmam fundo transparente no link da logo, botão `rgb(33, 150, 243)` com texto `rgb(17, 24, 39)` e Footer branco. Hover dos links e textos auxiliares também foram conferidos.

Os dados administrativos usados na revisão de navegador são interceptações sintéticas exclusivas do teste; nenhum dado fictício foi inserido no projeto ou no banco. Integrações reais com Supabase, laboratório e serviços externos não foram reconfiguradas nem homologadas nesta alteração visual.

Nenhuma mudança de layout, fontes, breakpoints, regras de negócio, SQL, RLS, autenticação ou dependências. Sem favicon novo, commit, push ou publicação.
