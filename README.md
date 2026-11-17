# agenda-entregas-mcp

Servidor **MCP (Model Context Protocol)** que deixa um assistente de IA (Claude, por exemplo) consultar o estoque de uma concessionária e **agendar entregas de veículos com segurança**.

Nasceu de um problema real. Trabalho no recebimento e entrega de uma concessionária e criei o app web que a equipe usa para acompanhar cada carro, da chegada à entrega. Este projeto é a camada que permite conversar com esse sistema em linguagem natural ("o que tem pendente hoje?", "marca a entrega do 303 pra quinta às 10h") sem deixar a IA fazer besteira.

> Os dados deste repositório são **fictícios**. Nenhum cliente, chassi ou vendedor real.

## O que ele faz

| Ferramenta | Tipo | O que faz |
|---|---|---|
| `listar_carros` | leitura | Carros na loja, com o local derivado (showroom, pátio, oficina) |
| `buscar_carro` | leitura | Busca pelo final do chassi (`303`, `VB000303`...) |
| `agenda` | leitura | Entregas agendadas num intervalo de datas |
| `pendencias` | leitura | O "bom dia" do recebimento: chegada não conferida, acessório antes da entrega, carro na oficina com entrega marcada, vendido sem entrega |
| `propor_entrega` | leitura | Valida e devolve um **código de confirmação**. Não grava |
| `confirmar_entrega` | escrita | Grava, mas só com o código |

## As decisões que importam

O ponto deste projeto não é "ligar uma IA num banco". É **como** a IA é colocada perto de dados que importam.

1. **Escrita em duas etapas (humano no circuito).** A IA nunca grava direto. `propor_entrega` valida e devolve um resumo com código; a gravação só acontece em `confirmar_entrega`, depois que a pessoa aprova. O código vale 5 minutos e só pode ser usado uma vez.
2. **Revalidação na confirmação.** Entre propor e confirmar, outra pessoa pode ter marcado o mesmo horário. A confirmação roda as regras de novo e recusa se a agenda mudou (há um teste só pra isso).
3. **Regras de negócio fora do modelo.** Domingo fechado, horário da loja, choque de horário, carro já entregue: tudo é código determinístico em `src/dominio.ts`, testado. O modelo não "decide" se pode, ele recebe o motivo do bloqueio e explica pro usuário.
4. **Bloqueio x aviso.** Bloqueio impede a gravação (choque de horário). Aviso grava, mas aparece no resumo (acessório pendente, carro na oficina). É assim que a operação funciona de verdade.
5. **Anotações MCP honestas.** Ferramentas de leitura vão com `readOnlyHint`; o cliente MCP sabe o que precisa de permissão.
6. **Auditoria.** Toda gravação gera uma linha de auditoria.
7. **Banco trocável.** O servidor só conhece a interface `Repositorio`. A versão em memória serve pra demo e teste; a de produção é outra classe com os mesmos 4 métodos.

## Estrutura

```
src/dominio.ts       regras de negócio (funções puras)
src/ferramentas.ts   lógica das ferramentas, sem depender do protocolo
src/repositorio.ts   interface de dados + implementação em memória
src/seed.ts          dados fictícios
src/server.ts        registro das ferramentas no MCP (stdio)
test/                testes com node:test
```

## Rodando

```bash
npm install
npm test          # 8 testes
npm run build
```

No Claude Code:

```bash
claude mcp add agenda-entregas -- node /caminho/para/agenda-entregas-mcp/dist/server.js
```

No Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agenda-entregas": { "command": "node", "args": ["/caminho/para/agenda-entregas-mcp/dist/server.js"] }
  }
}
```

Exemplo de conversa:

> **Você:** o que tem pendente hoje?
> **Claude** *(chama `pendencias`)*: o CS55 404 chegou e ainda não teve documentos conferidos; o UNI-T 303 precisa da película antes da entrega de quinta; o CS75 202 está vendido e sem entrega marcada.
> **Você:** marca o 202 pra amanhã às 10h
> **Claude** *(chama `propor_entrega`)*: Carlos Lima, CS75 Plus branco, quarta 18/11 às 10h, vendedora Duda. Confirmo?
> **Você:** pode
> **Claude** *(chama `confirmar_entrega`)*: agendado.

## Como usei IA para construir

Usei o Claude Code como par de programação. Eu defini as regras da operação (que vêm do meu dia a dia), o desenho de segurança (duas etapas, revalidação) e os casos de teste; a IA acelerou a escrita do código e eu revisei cada parte. Os testes foram escritos pra provar as regras que eu conheço na prática, não só pra cobrir linhas.

## Licença

MIT
