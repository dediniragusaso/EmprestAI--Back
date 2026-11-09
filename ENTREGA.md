# ENTREGA — EMPREST.AI

Data da entrega: 09/11/2026. Linguagem impersonal. Regra deste documento: toda afirmação aponta para
arquivo, hash de commit ou tabela do verificador; decisão que está só aqui e não na spec não conta.
Os caminhos `docs/`, `rules/`, `.claude/` e `AGENTS.md` ficam no repositório da raiz (EmprestAI--Docs);
`back/` e `front/` são repositórios separados e este mesmo arquivo está na raiz de cada um dos três.
Hash sem indicação de repositório é da raiz.

## Links
- Back (Vercel): https://emprestai-back-drab.vercel.app
- Front (Vercel): https://emprest-ai-six.vercel.app
- Repositório do front: https://github.com/dediniragusaso/EmprestAI
- Repositório do back: https://github.com/dediniragusaso/EmprestAI--Back
- Repositório dos agentes, regras, specs e documentação (raiz): https://github.com/dediniragusaso/EmprestAI--Docs

## Estado das specs (honesto)
| spec | estado | prova |
|---|---|---|
| 001-login | **EM ABERTO**, com dívida documentada | docs/specs/001-login/spec.md ("Dívida de processo"); docs/specs/001-login/verificacao-rodada-1.md (`NÃO PRONTA`) |
| 002-dados-iniciais | **PRONTA** | docs/specs/002-dados-iniciais/verificacao-rodada-6.md (`Veredito: PRONTA`); status 165f19b |
| 003-solicitar-emprestimo | **EM ABERTO** (`NÃO PRONTA` na rodada 5) | docs/specs/003-solicitar-emprestimo/verificacao-rodada-5.md; commit 4327985 |

## Resumo do que ficou sem prova ou fora do combinado
- **003, CA-20 (recusa 409 em texto na tela) e CA-21 (Meus empréstimos com 3 itens e com atraso): sem
  prova.** O operador decidiu em 09/11/2026 não produzir mais prints, por prazo; nada foi inventado
  para cobrir a falta | docs/evidencias/003-indice.md; docs/specs/003-solicitar-emprestimo/spec.md ("Estado da entrega"); verificacao-rodada-5.md
- **002:** a 1ª população de produção (12 criados) é só declaração do operador, e o verificador não
  autentica a origem das saídas coladas | docs/specs/002-dados-iniciais/verificacao-rodada-6.md
- **Regra do operador posta à prova (R14 da 003):** "testes manuais em produção só com a conta de teste,
  nunca a do professor" era só regra escrita, sem trava técnica. Na prática o TI-0001 ficou emprestado à
  conta do professor por engano; o operador limpou por SQL (registrado) e a consulta final deu 0
  empréstimos do professor, mas as duas auditorias `loan.open` permanecem (a tabela é append-only). O
  operador decidiu que o desvio não reprova o CA-24 | docs/specs/003-solicitar-emprestimo/evidencias-producao.md; Seção 7 abaixo
- **Hook de push:** bloqueia pushes feitos pelo harness assim que outro repositório ganha commits (a
  evidência da 002 guarda os HEADs dos três); limitação aceita pelo operador, que empurra pelo
  terminal | Seção 7 abaixo
- **Não publicado:** o agente não fez push nem tag em nenhum repositório; a Vercel do back precisa da
  variável `DATABASE_URL` para a 003 subir, e o agente não consegue conferir isso | commit d68291a (repo back)


## Seção 1 · Conflitos
| pedido | contrariava | o que foi feito | por quê | registro | commit |
|---|---|---|---|---|---|
| Verificador corrige teste (tech lead) | requisito de independência; rules/spec-flow.md | Recusado | O verificador não corrige; quem corrige é o agente principal | .claude/agents/verificador-spec.md | fc42860 |
| Agente cria usuário no Auth remoto (permitido em rules/restrictions.md) | Enunciado: o agente nunca escreve em produção | Permissão removida; "produção" definida como banco, Storage e Auth do deploy | A escrita em produção é do operador | rules/restrictions.md | c45aa18 |
| Pexels trocado por Pixabay (orientação do professor) | Enunciado: "só a API do Pexels" | Seguida a orientação | Pixabay exigido pelo professor; a orientação foi verbal, sem print nem mensagem escrita (registro em docs/evidencias/orientacao-pixabay.md) | skill imagens-equipamentos; docs/evidencias/orientacao-pixabay.md | 6ace99b (skill, raiz); 769cc9c (evidência) |
| Busca alterada de 8 equipamentos (TI-0001, 0003, 0004, 0005, 0006, 0007, 0011 e 0012) | Pedido: "usar exatamente esta lista" de equipamentos | Alterado só o campo `busca` desses 8 itens; a original foi preservada em `buscaOriginal`. Numa segunda rodada, nova troca de `busca` dos 6 que seguiam sem foto (TI-0003, 0004, 0006, 0007, 0011, 0012), com a mesma `buscaOriginal` | As buscas originais não produziram foto aprovável (marca ou logo legível, pessoa, texto, tela com conteúdo, fora de tema) | back/scripts/imagens-equipamentos/equipamentos.json; back/scripts/imagens-equipamentos/revisao.json | 8607551 e ec487f5 (busca); 75d8e5a e aee6656 (revisao.json), repo back |
| Escolha manual de 4 fotos por id do Pixabay (2917533, 4795762, 7223054, 3036166) | Fluxo da skill: foto escolhida pela busca da lista | Consultadas pela API do Pixabay por id e triadas em 800x600. 1ª rodada: 2917533 (teclado com texto legível), 4795762 (tela com conteúdo) e 7223054 (logo "YI" legível) descartadas, e 3036166 (notebook genérico) não usada por caber em mais de um equipamento. 2ª rodada: o operador decidiu aplicar 3036166 em TI-0003 e 5641391 em TI-0004, via `--escolher`, depois de nova triagem em 800x600 (5641391 com ressalva: letras das teclas só legíveis com ampliação; a reserva 2300686 ficou pior, com marcas de cartão na carteira) | Regra do pedido: foto com marca, texto, tela com conteúdo ou que cabe em mais de um equipamento não se usa, salvo decisão do operador | .claude/skills/imagens-equipamentos/SKILL.md; back/scripts/imagens-equipamentos/preparar.mjs | af52930 (`--escolher` por id na API, repo back); 7cf2858 (SKILL.md, raiz); o arquivo das fotos fica em back/.preparo-imagens/, ignorado pelo git |
| Briefing cita 2 equipamentos em manutenção (C1) | Enunciado: "usar exatamente esta lista", que marca 3 (TI-0004, TI-0007, TI-0010) | Valem os 3 da lista | O enunciado manda usar exatamente a lista; o PRD diz que item em manutenção não aparece como disponível | docs/specs/002-dados-iniciais/spec.md (C1, R1) | c2ff42a |
| Seed passa a criar equipamentos e usuário (C2) | docs/modelagem-banco.md §9 ("Nada além disso") e linha "Seed" do ADR-001 | O seed existente (`back/prisma/seed.ts`) não é alterado e segue só criando o tenant; os dados iniciais ficam em script separado, `back/prisma/dados-iniciais.ts`, com `npm run db:dados-iniciais` | Elimina o conflito sem reescrever documento aprovado | docs/specs/002-dados-iniciais/spec.md (C2, R9, CA-14) | c2ff42a |
| Conta do professor criada fora do convite (C3) | ADR-001 §7: cadastro fechado, somente por convite de administrador | Exceção desta prática: a conta do professor é criada pelo script, pela API admin do Auth; o fluxo de convite continua não decidido | O professor precisa entrar e o convite não está definido | docs/specs/002-dados-iniciais/spec.md (C3, Q10) | c2ff42a |
| Decisões do operador sobre a spec 002: Q1 (equipamento existente: atualiza nome, categoria e imagem, nunca o `status`), Q2 (unique de imagem por tenant, `(tenantId, imagePixabayId)`), Q6 (Jest e Testcontainers com Auth simulado; Auth real provado em produção pelo login do professor) | n/a (decisões em aberto da spec) | Incorporadas à spec, ao plano e às tarefas; Testcontainers instalado em versão fixa 12.0.4 (a 12.1.0 em diante exige Node >= 22.22) | `status` muda com os empréstimos da 003; o Postgres do Testcontainers não tem o schema `auth` | docs/specs/002-dados-iniciais/ (R2, R5, R10); back/package.json | c2ff42a (raiz); 761867f (back) |
| Limite 5, 14 dias úteis, sharp, senha no `back/.env` (ignorado pelo git), crédito do catálogo, TI-0010 | PRD, ADR-003, rules, enunciado | Decididos. A linha dizia "senha no arquivo": **corrigida**, é o `back/.env`, ignorado pelo git (Q14), e a R4 da spec 002 vale. Registrados: sharp no ADR-004; senha (R4) e TI-0010 em manutenção (C1) na spec 002. Seguiam para a spec 003: limite 5, 14 dias úteis e crédito do catálogo (Q15, Q9). **Na 003 prevaleceu o PRD** (3 itens por pessoa, 14 dias corridos), pedido pelo operador ao abrir a spec; o crédito virou o rodapé "Fotos: Pixabay" (R4) | Evitar senha em arquivo versionado | docs/adr/004-biblioteca-de-imagem.md; docs/specs/002-dados-iniciais/spec.md; docs/specs/003-solicitar-emprestimo/spec.md (R4, R6, R8) | 3593277 (ADR-004); c2ff42a (spec 002); 0cc810a (spec 003) |

## Seção 1b · Lacunas
Lacuna = pergunta que o PRD e o layout não respondiam e que ficou escrita na spec, sem suposição do agente (rules/spec-flow.md, passo 3). Alternativas, quando a spec as registra, são as que estão no texto dela.
| spec | o que faltava | alternativas | o que decidiu | por quê | registro / commit |
|---|---|---|---|---|---|
| 001-login | Q1: origem de `nome` e `papel` | deduzir do e-mail (rules/spec-flow.md cita este caso) ou esperar `memberships` | fora de escopo: `/v1/me` não devolve papel; o papel virá da membership | modelagem-banco.md ainda era proposta | docs/specs/001-login/spec.md (Fora de escopo, Q1); b726744, 4f9a30b |
| 001-login | Q2 botão "Entrar como Operações"; Q3 recuperação de senha e convite; Q4 menu da área autenticada | não registradas além da proposta | Q2 não implementado; Q3 e Q4 ficam fora (Q4 veio com a 003) | atalho do protótipo não é papel; convite não decidido | docs/specs/001-login/spec.md (Q2 a Q4); b726744 |
| 002-dados-iniciais | Q3 nome do usuário; Q4 papel da conta de teste; Q5 observação dos itens em manutenção | não registradas além da proposta | Q3: `name` fica com o e-mail (fallback do trigger); Q4: `COLABORADOR`; Q5: `observacao` vazia | a lista não traz motivo nem previsão | docs/specs/002-dados-iniciais/spec.md (Q3 a Q5); 8706843 |
| 002-dados-iniciais | Q8 senha do professor ausente; Q12 troca de senha; Q16 tenant ausente | "pular o usuário em silêncio"; alterar a senha existente; duplicar a criação do tenant (a spec descarta as três) | falhar antes de tocar no Auth, citando só o nome da variável; não alterar senha; exigir o tenant e mandar rodar `db:seed` | não esconder falha; seed segue dono do tenant | docs/specs/002-dados-iniciais/spec.md (Q8, Q12, Q16); 8706843 |
| 002-dados-iniciais | Q13 confirmação de produção; Q17 migrations no teste | `prisma migrate deploy` no teste (negado ao agente) | `DADOS_INICIAIS_CONFIRMO_PRODUCAO=sim`; migrations por `psql -f` no contêiner | padrão do `ENVIAR_CONFIRMO_PRODUCAO`; sem dependência nova | docs/specs/002-dados-iniciais/spec.md (Q13, Q17); 8706843, aea2f9f (back) |
| 002-dados-iniciais | Q7 nome da pasta da 003; Q9 crédito na tela; Q10 convite; Q15 limite 5 e 14 dias úteis | n/a | Q7 `003-catalogo` (depois a pasta virou `003-solicitar-emprestimo`, a pedido do operador); Q9, Q10 e Q15 adiadas para a 003 | fora do escopo da 002 | docs/specs/002-dados-iniciais/spec.md (Q7, Q9, Q10, Q15); 8706843; 0cc810a |
| 003-solicitar-emprestimo | Q1 origem do tenant | claim do JWT (ADR-001 §6; o JWT do Supabase não traz tenant) ou vínculo em `memberships` | vínculo em `memberships`, nunca do body | o servidor resolve o tenant | docs/specs/003-solicitar-emprestimo/spec.md (Q1); 2642daa |
| 003-solicitar-emprestimo | Q2 fuso de "hoje" | data do banco (UTC) ou America/Sao_Paulo | America/Sao_Paulo, calculado no servidor | usuário e prazo em dias corridos são do Brasil | spec 003 (Q2, R8); 2642daa |
| 003-solicitar-emprestimo | Q3 nome de quem está com o item | "Com {pessoa}" do layout.md §5.2 ou sem nome | sem nome de pessoa; "Emprestado · devolução prevista até…" e "Está com você" | privacidade (cada pessoa vê só os próprios empréstimos); diferença do layout registrada | spec 003 (Q3, R2, R5); 2642daa |
| 003-solicitar-emprestimo | Q4 texto das recusas; Q12 ordem das verificações | só havia rótulos de botão (ADR-003 §7) | frases propostas aceitas; equipamento, depois atraso, depois limite | recusa sempre com motivo em texto | spec 003 (Q4, Q12, R7); 2642daa |
| 003-solicitar-emprestimo | Q5 cliente HTTP; Q6 dependência de teste | orval e `nestjs-zod` (ADR-001) ou cliente à mão | cliente à mão e Zod direto (dívida registrada); só `supertest` instalado | bibliotecas fora do que o operador aprovou | spec 003 (Q5, Q6, Dívida de processo); 2642daa; ce107cf (back) |
| 003-solicitar-emprestimo | Q8 auditoria; Q9 "A vencer" e "Devolver"; Q10 item sem foto; Q11 cursor com 12 itens | não registradas além da proposta | só `loan.open`; sem "A vencer" e sem "Devolver"; quadro neutro; cursor com contagem "X de Y" feita na tela | modelagem §10 perguntas 6 e 8 abertas; devolução é de outra fatia | spec 003 (Q8 a Q11); 2642daa |
| 003-solicitar-emprestimo | Q13 prova manual em produção | provar limite e atraso em produção (exigiria SQL de escrita) | limite e atraso no banco local; em produção só um pedido, com a conta de teste; SQL de limpeza do operador | cada pedido deixa um item emprestado sem devolução | spec 003 (Q13); evidencias-producao.md; 2642daa, 65ba3cc |

## Seção 2 · Onde o agente tentou decidir
- Convenção `Status: PRONTA` criada pelo agente sem estar escrita (reportada por ele) | commit 8169e71
- Frase extra em rules/restrictions.md além do pedido (reportada por ele) | commit c45aa18
- O agente criou a convenção do hook e, ao ser testada, barrava todo push por uma spec fora da prática; escopo corrigido | commit 3f39782
- Num teste de `--posicao`, o `preparar` rodou sem `--pular` para TI-0011 e TI-0012 e escolheu foto sozinho, contra a instrução de não aplicar nenhuma; o agente notou na tabela do `validar` (ids 3480569 e 551287) e desfez com `--pular`. Sem commit: as fotos ficam em área ignorada pelo git (reportado pelo agente)
- Na 002, o agente trocou por conta própria a versão do Testcontainers (12.0.4 → 12.0.1) ao descobrir que o Jest não carregava o pacote no Node 22.13; a primeira escolha olhou só o `engines` do pacote principal e não o da dependência transitiva (`undici`) (reportado pelo agente) | commits 761867f e aea2f9f (repo back)
- Na 002, o agente gerou o SQL da migration por `prisma migrate diff` em vez de `migrate dev --create-only`, que a `rules/migration.md` manda usar e que falhou com `P4002` (reportado pelo agente) | commit 399517d (repo back)
- Na 002, o agente divergiu do plano em dois pontos sem pedir: deixou `DADOS_INICIAIS_CONFIRMO_PRODUCAO` só comentada no `.env.example` e entregou T6 e T7 num commit único (reportado pelo agente) | commits 9e0d17f e 17254e0 (repo back)
- Na 002, o agente editou `docs/specs/001-login/spec.md` (uma linha da renumeração), arquivo que a lista da spec 002 não previa (reportado pelo agente) | commit bc93f86

- Na 003, o agente acrescentou `openedOn` (data civil de Brasília da retirada) ao contrato de `GET /v1/loans/mine`, que a spec não previa, para a tela não converter fuso no navegador (reportado pelo agente) | commit 49900af (repo back)
- Na 003, o agente tornou `AuthModule` global e criou `ClockModule` para montar o app de teste à mão, porque `@nestjs/testing` não está aprovado; o operador só autorizou o `supertest` (reportado pelo agente) | commit 7833375 (repo back)
- Na 003, `DATABASE_URL` virou obrigatória no boot do back (ADR-001 §9); o deploy da Vercel do back precisa ter a variável antes do próximo push, e o agente não consegue conferir (reportado pelo agente) | commit d68291a (repo back)
- Na 003, o primeiro teste de concorrência do CA-10 reutilizava as mesmas 10 pessoas nas 20 repetições e falhou pelo limite de 3: erro do teste, não do código; corrigido criando pessoas novas a cada repetição (reportado pelo agente) | commit 5219a89 (repo back)
- Na 003, o agente escreveu um `!` em `front/src/lib/api.ts`, que `rules/qualidade-codigo.md` proíbe, e o corrigiu antes da verificação (reportado pelo agente) | commit 3e11337 (repo front)
- Na 003, no AGENTS.md o agente afirmou sem verificar que não havia deploy ligado à raiz; removeu a frase no commit seguinte (reportado pelo agente) | commits 877dd87 e 0e4a63f
- Na 003, o agente implementou com a spec `EM ABERTO` depois de duas rodadas `NÃO PRONTA` por falta de código; o operador decidiu em 09/11/2026 que isso não é desvio | commits 1600998 e 862e66f

## Seção 3 · Candidata a ADR
- Mecanismo para tornar o verificador obrigatório: hook do harness, git hook ou CI (alternativas e limitações levantadas pelo agente). Decidir se virou ADR.
- ADR da biblioteca de imagem (Pixabay não entrega 800x600): escrito pelo time, docs/adr/004-biblioteca-de-imagem.md | commit 3593277
- **A decisão que virou ADR é a 004 (biblioteca de imagem).** As decisões desta prática sobre a spec 002 (C1, C2, C3, Q1, Q2, Q6, Q14) ficaram registradas na spec, não em ADR. O C2 foi resolvido justamente para não contrariar a tabela do ADR-001 nem a modelagem §9; o C3 **é** uma exceção declarada pelo operador ao ADR-001 §7 (cadastro por convite), limitada a esta prática, e o fluxo de convite segue não decidido | docs/specs/002-dados-iniciais/spec.md | commit c2ff42a

## Seção 4 · Imagens dos equipamentos (revisão humana e entrega)
- Revisão humana até agora: 8 fotos aprovadas (TI-0001, 0002, 0005, 0006, 0007, 0008, 0009 e 0010, após revisão visual do operador) e 10 reprovadas, em 18 decisões registradas. Motivos das reprovadas (uma foto pode ter mais de um): fora de tema 4, logo legível 4, texto legível 2, pessoa 2, tela com conteúdo 1 | back/scripts/imagens-equipamentos/revisao.json | commits 75d8e5a, aee6656 e 3dacb59 (repo back)
- **Atualização (09/11/2026): 12 de 12 fotos aprovadas pelo operador** (TI-0003, TI-0004, TI-0011 e TI-0012 aprovadas depois da contagem abaixo; 10 reprovadas no caminho) e `creditos.json` gerado | commits 6f99c10 e 7310f8e (repo back)
- Contagem anterior (superada pela linha acima): 12 fotos preparadas em 800x600 e validadas (`validar` sem erro); 8 aprovadas e 4 pendentes de revisão (TI-0003 id 3036166, TI-0004 id 5641391, TI-0011 id 1163880 e TI-0012 id 8670926), as quatro escolhidas pelo operador por id e aplicadas com `--escolher`. Reprovadas no total: 10, sem mudança nesta rodada. Para TI-0011 e TI-0012 foram examinadas 30 candidatas cada, com 5 variações de busca; as aplicadas não têm texto nem logo legível em 800x600 (conferido com ampliação: só um ícone de ligar e um indicador minúsculo na 1163880; só um ponto e reflexos na 8670926) | docs/handoffs/2026-11-09-imagens-equipamentos-parcial.md (estado anterior, 7 sem foto) | commits 96cdc70, 8607551, ec487f5, 3dacb59 e af52930 (as fotos ficam em back/.preparo-imagens/, ignorado pelo git)
- Nova opção `--posicao=<patrimonio>:<posicao>` no `preparar` (posição do recorte "cover" do sharp), documentada no SKILL.md. Verificada por comparação de pixels: só desloca o enquadramento, sem esticar (diferença média ≈1 contra a referência, 30 a 50 contra o deslocamento errado). Em fonte 3:2 a folga é de 100 px na horizontal, então só tira do quadro uma marca a menos de 50 px da borda lateral; nenhuma das 60 candidatas examinadas tinha marca nessa faixa, então a opção não resgatou nenhuma | back/scripts/imagens-equipamentos/preparar.mjs; .claude/skills/imagens-equipamentos/SKILL.md | commits af52930 (repo back) e 7cf2858 (raiz)
- Commits da etapa, repo back: sharp 0.35.5 `8e99c4a` · scripts `a883bf4` · nomes no .env.example `05459f6` · revisao.json `75d8e5a` · opções --escolher e --pular `7c6652d` · revisão da TI-0003 `aee6656` · novas buscas `8607551` · segunda troca de busca `ec487f5` · aprovações `3dacb59` · `--escolher` por id e `--posicao` `af52930`
- Commits da etapa, raiz: skill `6ace99b` · rules/secrets.md `afc3890` · SKILL.md com as opções `04f6d7a` · handoff `96cdc70` · SKILL.md com `--escolher` por id e `--posicao` `7cf2858`

## Seção 5 · Verificador
- Gatilho: hook PreToolUse (.claude/settings.json) | commits 8169e71, 3f39782
- Ferramentas: Read, Grep, Glob, Bash; sem Edit nem Write | commit fc42860
- Limitação: o Bash não restringe escrita; a barreira de ambiente cobre só o que está em permissions.deny | commit 221a8dd
- Três repositórios: um intervalo de commits por repo | commit fc42860
- Na 002 foram três rodadas, todas salvas e commitadas sem sobrescrever (`verificacao-rodada-1.md` a `-3.md`) | commits f2dde1d, 5815318 e 2163aea
- O verificador rodou `npm test` de verdade (Testcontainers com Docker) e `npm run build`, só leu e rodou, e ele mesmo salvou o arquivo da rodada; não foi avisado do erro plantado | docs/specs/002-dados-iniciais/verificacao-rodada-2.md
- Limitação: o critério do veredito por CA não está fixado no `.claude/agents/verificador-spec.md`. Para os mesmos CA ("prova local atendida, produção pendente") a rodada 1 escreveu "ATENDIDO (local); produção pendente" e a 2 escreveu "SEM TESTE"; foi preciso pedir o mesmo critério na rodada 3 | commits f2dde1d, 5815318 e 2163aea
- Limitação: o portão da spec depende de ação humana. Com prova de produção prevista em CA, o verificador não declara PRONTA enquanto o operador não preencher `evidencias-producao.md`; três rodadas deram `NÃO PRONTA` pelo mesmo motivo | docs/specs/002-dados-iniciais/verificacao-rodada-3.md

## Seção 6 · Verificador em ação
- Rodada 1 da 001-login: NÃO PRONTA (CA-01 a CA-10 sem teste) | commit af6d2e7 | docs/specs/001-login/verificacao-rodada-1.md
- 002-dados-iniciais, rodada 1: `NÃO PRONTA`. CA reprovado ou sem prova: CA-06 (sem prova) e a parte de produção de CA-01, CA-02, CA-04, CA-05 e CA-07. Causa: prova que só o operador produz (a spec exige evidência de produção para esses CA). Correção: nenhuma possível ao agente; entregue o modelo `evidencias-producao.md` | commit f2dde1d | docs/specs/002-dados-iniciais/verificacao-rodada-1.md
- 002-dados-iniciais, rodada 2: `NÃO PRONTA`. **CA-13 REPROVADO**: o teste falhou na execução (esperado `EMPRESTADO`, recebido `DISPONIVEL`). Causa: o erro plantado, o `update` do upsert regravava o `status`. Correção: commit 52c13d2 | commit 5815318 | docs/specs/002-dados-iniciais/verificacao-rodada-2.md
- 002-dados-iniciais, rodada 3: `NÃO PRONTA` só pela produção pendente; CA-13 voltou a atendido, 30 de 30 testes passam | commit 2163aea | docs/specs/002-dados-iniciais/verificacao-rodada-3.md
- **Prova com erro plantado (spec 002):** plantado em `37b4b70` (repo back, mensagem "TESTE: erro plantado para provar o verificador"), reprovado pelo verificador no CA-13 na rodada 2, desfeito em `52c13d2` (mensagem "desfaz erro plantado"). O verificador não foi avisado do erro. Depois de desfeito voltou ao estado da rodada 1 (só produção pendente), e não a `PRONTA`, porque a prova de produção depende do operador | hashes 37b4b70 e 52c13d2 (repo back)
- Tabela final (rodada 3): CA-03, CA-08, CA-09, CA-10, CA-11, CA-12, CA-13 e CA-14 ATENDIDO; CA-01, CA-02, CA-04, CA-05, CA-06 e CA-07 SEM TESTE (a parte local passa, falta a produção do operador, e o CA-06 só tem prova de produção) | docs/specs/002-dados-iniciais/verificacao-rodada-3.md | commit 2163aea
- 002-dados-iniciais, rodada 4: `NÃO PRONTA`. CA-06 sem prova; CA-01, CA-02, CA-04, CA-05 e CA-07 só com declaração do operador, sem saída colada | commit 483afa8 | docs/specs/002-dados-iniciais/verificacao-rodada-4.md
- 002-dados-iniciais, rodada 5: `NÃO PRONTA`. CA-01, CA-03, CA-05, CA-06, CA-07 e CA-10 passaram a ter prova (SQL e `migrate status` colados, print do login); CA-02 (sem a dimensão 800x600) e CA-04 (sem saída colada) seguiram só declarados. O verificador não aceitou declaração como prova | commit bcaa853 | docs/specs/002-dados-iniciais/verificacao-rodada-5.md
- 002-dados-iniciais, rodada 6: **`PRONTA`**. O operador colou as saídas reais de produção (12 URLs com 800x600; `imagens:enviar` e `db:dados-iniciais` duas vezes; SQL após as repetições). `Status: PRONTA` marcado depois do veredito | commits 1a3fd14 (relatório) e 165f19b (status) | docs/specs/002-dados-iniciais/verificacao-rodada-6.md
- Evidências de produção registradas em `evidencias-producao.md`: 4902cc2, e3c4e19, 0e6049b e 45f2d3b. Ressalvas do verificador, que não mudam o veredito: a origem das saídas coladas não é autenticável pelo agente; a 1ª população (12 criados) é só declaração do operador (as duas execuções registradas deram 0 criados, 12 atualizados); o CA-06 prova o `GET /v1/me` de forma indireta, pelo e-mail no print

- 003-solicitar-emprestimo, rodada 1: `NÃO PRONTA`; só spec, plano e tarefas, os 26 CA SEM TESTE por falta de código; achou 7 lacunas na própria spec (contagem "X de Y", CA-16 sem caso no POST, referências antigas, busca do CA-24, dependências das Q, ator da auditoria, rótulo do CA-16) | commit d0e7ed9 | docs/specs/003-solicitar-emprestimo/verificacao-rodada-1.md
- 003-solicitar-emprestimo, rodada 2: `NÃO PRONTA`; as 7 lacunas corrigidas, spec/plano/tarefas coerentes, ainda sem código | commit 1600998 | docs/specs/003-solicitar-emprestimo/verificacao-rodada-2.md
- 003-solicitar-emprestimo, rodada 3: `NÃO PRONTA`; com código, 14 suítes e 80 testes passando; CA-02, 04, 19 a 23 sem print e CA-24 sem o resultado do operador | commit 30da800 | docs/specs/003-solicitar-emprestimo/verificacao-rodada-3.md
- 003-solicitar-emprestimo, rodada 4: `NÃO PRONTA`; CA-02 e CA-21 reprovados por prova parcial, CA-04, 20 e 23 sem print, CA-24 ambíguo por causa do desvio da R14 | commit dfbdf18 | docs/specs/003-solicitar-emprestimo/verificacao-rodada-4.md
- 003-solicitar-emprestimo, rodada 5 (final): `NÃO PRONTA`; só CA-20 (recusa 409 em texto) e CA-21 (Meus empréstimos com 3 itens e com atraso) sem prova; o operador decidiu não produzir mais prints, por prazo. A spec fica `Status: EM ABERTO` | commit 4327985 | docs/specs/003-solicitar-emprestimo/verificacao-rodada-5.md

**Tabela final da 002-dados-iniciais (rodada 6, `Veredito: PRONTA`, 30 testes)** | docs/specs/002-dados-iniciais/verificacao-rodada-6.md | relatório 1a3fd14, status 165f19b
| CA | veredito | tipo de prova |
|---|---|---|
| CA-01 | ATENDIDO | teste + saída de SQL colada (12; 9 DISPONIVEL; 3 MANUTENCAO) |
| CA-02 | ATENDIDO | teste + saída colada das 12 URLs (200, image/jpeg, 800x600) |
| CA-03 | ATENDIDO | teste (12 fotos distintas) |
| CA-04 | ATENDIDO | teste + saídas coladas (enviar 2x, dados iniciais 2x); a 1ª população é só declaração |
| CA-05 | ATENDIDO | teste + SQL colada + print do login |
| CA-06 | ATENDIDO | print do login do professor (só produção) |
| CA-07 | ATENDIDO | teste + SQL colada (0 empréstimos) |
| CA-08 | ATENDIDO | teste |
| CA-09 | ATENDIDO | teste (guarda de produção) |
| CA-10 | ATENDIDO | teste + `migrate status` remoto colado |
| CA-11 | ATENDIDO | teste (conta de teste opcional) |
| CA-12 | ATENDIDO | busca de texto |
| CA-13 | ATENDIDO | teste (o `update` nunca toca o `status`) |
| CA-14 | ATENDIDO | teste + diff vazio do `seed.ts` |

**Tabela final da 003-solicitar-emprestimo (rodada 5, `Veredito: NÃO PRONTA`, 80 testes)** | docs/specs/003-solicitar-emprestimo/verificacao-rodada-5.md | commit 4327985
| CA | veredito | tipo de prova |
|---|---|---|
| CA-01, 03, 05 a 18 | ATENDIDO | teste automatizado (Jest, supertest, Testcontainers) |
| CA-02 | ATENDIDO | print de produção (12 cards; o quadro neutro sem foto não tem print) |
| CA-04 | ATENDIDO | prints: produção ("Indisponível", "Está com você") e local ("Emprestado", sem nome) |
| CA-19 | ATENDIDO | prints de produção (modal, toast, card, Meus empréstimos) |
| CA-20 | **SEM TESTE** | existem limite e atraso (prints locais); **não existe** o print da recusa 409 em texto |
| CA-21 | **SEM TESTE** | existem 1 item e vazio (prints de produção); **não existem** 3 itens e atraso em Meus empréstimos |
| CA-22 | ATENDIDO | print do rodapé + busca de texto |
| CA-23 | ATENDIDO | prints de produção (busca e chip) |
| CA-24 | ATENDIDO | busca + saída de SQL colada; desvio da R14 não reprova, por decisão do operador |
| CA-25, 26 | ATENDIDO | busca de texto |

**Erro plantado (spec 002):** `37b4b70` (repo back, mensagem "TESTE: erro plantado para provar o verificador") fez o `update` do upsert reescrever o `status` (viola o CA-13); o verificador, sem aviso, reprovou o CA-13 na rodada 2 (`5815318`); `52c13d2` ("desfaz erro plantado") o desfez e a rodada 3 (`2163aea`) voltou a atender o CA-13 | hashes 37b4b70 e 52c13d2 (repo back)

## Seção 7 · Regra posta à prova
- restrictions.md permitia criar usuário no Auth remoto, em conflito com o enunciado | commit c45aa18
- Paths antigos (frontend/, backend/) e globs de migration.md que deixaram de casar | commits 3a3e666, 7f63bb8
- front/ registrado como gitlink na raiz (por 63a264d, sem .gitmodules) e removido do índice | commit cc59fe0
- Na 002, `rules/migration.md` manda `prisma migrate dev --name <nome> --create-only`; contra o Supabase local falhou com `P4002` (FK de `public.users` para o schema `auth`), então a regra não se cumpre como está escrita | commit 399517d (repo back)
- Na 002, `rules/checks.md` passo 2 manda `prisma migrate reset` no banco local; o Prisma recusa quando o invoca um agente de IA ("detected that it was invoked by Claude Code") e exige consentimento do usuário. A regra supõe um passo que o agente não pode fazer sozinho; a prova de "aplica do zero" passou a ser um teste em Postgres descartável | docs/specs/002-dados-iniciais/spec.md (Dívida de processo)
- Na 002, o `permissions.deny` nega ao agente `prisma migrate deploy` mesmo contra um Postgres descartável, o que obrigou a aplicar as migrations do teste por `psql -f` dentro do contêiner (Q17) | commit aea2f9f (repo back)
- Na 002, `rules/restrictions.md` ("o agente nunca escreve em produção") só vale se o script não alcançar o remoto por acidente: o `@prisma/client` carrega o `back/.env` na importação, antes do código do script. Foi preciso uma guarda que julga os valores efetivos, com teste que roda o script de verdade com destino remoto falso | commits a4188a6 e 36d9442 (repo back)
- Na 002, `rules/checks.md` passo 3 manda rodar o build; o `npm run build` não compila `prisma/` (o `tsconfig.json` só inclui `src` e `api`), então o build não prova nada sobre o código do script: quem tipa são o `ts-node` e o `ts-jest` | docs/specs/002-dados-iniciais/spec.md (Dívida de processo)
- Na 002, `rules/tests.md` diz que "nenhum runner existe hoje" e trata a matriz do ADR-001 §8 como pendente; o Testcontainers do ADR só rodou depois de descer para a 12.0.1 por causa da versão do Node da máquina | commit aea2f9f (repo back)
- Na 002, `rules/secrets.md` e `rules/spec-flow.md` foram exercitadas sem falha: os três lugares da variável nova (o painel da Vercel não muda, os scripts não rodam lá) e a marca `Status: EM ABERTO`, sem `PRONTA` por conta própria; o hook de push passou nos 18 casos | commits e651ad3 e 2163aea

- Na 003, `rules/spec-flow.md` ("Antes de declarar uma spec pronta") só aceita `PRONTA` com a implementação verificada; o pedido de implementar "se a spec ficar PRONTA" é circular: a spec sem código só alcança `NÃO PRONTA` (rodadas 1 e 2). O operador resolveu aprovando a implementação com a spec `EM ABERTO` | commits d0e7ed9 e 1600998
- Na 003, o hook `exige-verificacao.mjs` passou a barrar todo `git push` feito pelo harness (ex.: "spec 002-dados-iniciais marcada PRONTA sem evidência válida: HEAD de front mudou") assim que o `front/` e o `back/` ganharam commits da 003, porque a evidência da 002 guarda os HEADs dos três repositórios. Qualquer fatia nova invalida a evidência das anteriores. **Limitação do hook, aceita pelo operador em 09/11/2026**: a 002 não será reverificada só por isso; o operador empurra pelo próprio terminal, que não passa pelo hook | comando conferido em 09/11/2026 sobre HEAD 3e11337 (front)
- Na 003, `rules/tests.md` e `rules/qualidade-codigo.md` citavam "Tarefa 9 da 003", "Q4 da 003 … Tarefa 12" e `MeusEmprestimos.tsx` de uma numeração e de um protótipo que não existiam na fatia real; foram acertadas | commit 59544cf
- Na 003, `rules/restrictions.md` ("não escolha biblioteca fora do ADR-001") obrigou a montar o app de teste sem `@nestjs/testing`; funcionou, mas custou um helper próprio | commit 7833375 (repo back)
- Na 003, `rules/checks.md` passo 2 (reset de migration) não se aplicou: a fatia não tem migration; `rules/checks.md` passo 3 (build) não compila `src/testing` por escolha do `tsconfig.build.json`, então o helper de teste só é tipado pelo `ts-jest` | commit 7833375 (repo back)
- Na 003, o teste de concorrência provou a regra de verdade: os 4 casos (CA-10, CA-11 duas vezes e CA-12) falharam antes do lock e passaram depois | commit 5219a89 (repo back)

- Na 003, a R14 ("testes manuais em produção só com a conta de teste, nunca a do professor") é só regra escrita, sem imposição técnica, e a prática a pôs à prova: segundo o operador, o TI-0001 chegou a ficar emprestado à conta do professor por engano antes do teste; foi limpo por SQL (registrado em `evidencias-producao.md`) e a consulta final deu 0 empréstimos do professor, mas as duas auditorias `loan.open` permanecem (append-only). Decisão do operador em 09/11/2026: o estado final cumpre o CA-24 e o desvio da R14 não é motivo para reprovar | docs/specs/003-solicitar-emprestimo/evidencias-producao.md

## Seção 8 · Ficou de fora
- 001-login em aberto como dívida | commit 4f9a30b
- Front sem runner de teste; ADR 002 inexistente
- Spec 002-dados-iniciais: `PRONTA` desde a rodada 6 (relatório 1a3fd14, status 165f19b). As saídas de produção das seções 3 e 4 do `evidencias-producao.md` foram coladas pelo operador, mas a 1ª população (12 criados) é só declaração; o verificador não consegue autenticar a origem das saídas coladas
- Imagens: 12 de 12 fotos aprovadas pelo operador (a linha anterior sobre TI-0003, 0004, 0011 e 0012 está superada) | commits 6f99c10 e 3dacb59 (repo back)
- Limitação das fotos de webcam e câmera compacta: são aproximações do tipo de equipamento. TI-0011 (Webcam Full HD) usa uma câmera de videoconferência (1163880) e TI-0012 (Câmera compacta) usa uma câmera de ação (8670926), porque o Pixabay não ofereceu, entre 30 candidatas por equipamento, foto de webcam de mesa ou de compacta convencional sem marca ou texto legível (a webcam 1219748 tem "1.3 MEGA PIXELS" na lente; as compactas trazem marca ou legendas de botões) | commit af52930 (repo back, opções `--escolher` e `--posicao`)
- Limitação do `enviar`: o teste de "repetir não duplica" não foi feito antes (Docker parado e Supabase CLI ausente, sem ambiente local); será feito no envio real, pelo operador. Até lá a idempotência é só de desenho (upsert em caminho fixo e listagem de conferência no fim), não comprovada | commit a883bf4 (repo back)
- Limitações do hook (evidência forjável; só vale no harness; trabalho não commitado não é conferido)
- **Estado final das specs:** 001-login `EM ABERTO` (dívida documentada, rodada 1 `NÃO PRONTA`, af6d2e7); 002-dados-iniciais `PRONTA` (rodada 6); 003-solicitar-emprestimo `EM ABERTO` (rodada 5 `NÃO PRONTA`, 4327985)
- 003 **sem prova, por prazo (decisão do operador, 09/11/2026):** recusa 409 em texto na tela (CA-20) e Meus empréstimos com 3 itens e com atraso (CA-21); o arquivo `003-local-ca21-tres.png` mostra o catálogo, não Meus empréstimos | docs/evidencias/003-indice.md; docs/specs/003-solicitar-emprestimo/spec.md ("Estado da entrega")
- 003: a prova de tela é por print do operador (o agente não tem navegador); parte dos prints de CA-21 e CA-23 é de produção e parte de CA-04 e CA-20 é local | docs/evidencias/003-indice.md
- 003: o back e o front da 003 não foram publicados pelo agente (sem push); a Vercel do back precisa de `DATABASE_URL` (o agente não consegue conferir) | commit d68291a (repo back)
- Dívida da 003 (spec, "Dívida de processo"): cliente HTTP à mão e Zod direto no Nest em vez de orval e `nestjs-zod` (Q5); front sem teste automatizado (ADR 002 reservado); `lint` não existe no back nem no front
- 003: devolução (PRD item 4), renovação, tela de Operações (item 5), "A vencer" e etiqueta de papel ficam para outras fatias; sem devolução, o item pedido em produção só volta a `DISPONIVEL` pelo SQL de limpeza que o operador executa
- 003: o `npm install` do `supertest` mostrou avisos de `npm audit` que não foram avaliados; o lockfile também subiu `qs` 6.16.1 → 6.17.1 | commit ce107cf (repo back)

## Como conferir
- Specs, planos, tarefas e rodadas do verificador: `docs/specs/<NNN>/` (cada `verificacao-rodada-<N>.md` termina em `Veredito:`).
- Evidências de tela e de produção: `docs/evidencias/` e `docs/specs/003-solicitar-emprestimo/evidencias-producao.md`.
- Handoffs datados: `docs/handoffs/`.
- Notas de origem deste documento: `docs/entrega-notas.md`.
