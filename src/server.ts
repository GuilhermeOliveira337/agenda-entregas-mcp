#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Ferramentas } from "./ferramentas.js";
import { RepositorioEmMemoria } from "./repositorio.js";
import { carrosDemo, entregasDemo } from "./seed.js";
import { HORARIO } from "./dominio.js";

const hoje = () => process.env.HOJE ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const f = new Ferramentas(new RepositorioEmMemoria(carrosDemo, entregasDemo), hoje);

const server = new McpServer({ name: "agenda-entregas", version: "1.0.0" });
const json = (dado: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(dado, null, 2) }] });
const leitura = { readOnlyHint: true, openWorldHint: false };

server.registerTool("listar_carros", {
  title: "Listar carros da loja",
  description: "Lista os carros que estão na loja (não entregues). Filtra por local e por modelo.",
  inputSchema: { local: z.enum(["showroom", "pátio", "oficina", "entregue"]).optional(), modelo: z.string().optional() },
  annotations: leitura,
}, async (a) => json(await f.listarCarros(a)));

server.registerTool("buscar_carro", {
  title: "Buscar carro pelo chassi",
  description: "Busca um carro pelo final do chassi (ex.: 303 ou VB000303). Mostra local, conferência e entrega marcada.",
  inputSchema: { chassi: z.string().min(1) },
  annotations: leitura,
}, async ({ chassi }) => json((await f.buscarCarro(chassi)) ?? "Carro não encontrado."));

server.registerTool("agenda", {
  title: "Agenda de entregas",
  description: "Entregas agendadas entre duas datas (AAAA-MM-DD), em ordem.",
  inputSchema: { de: z.string(), ate: z.string() },
  annotations: leitura,
}, async ({ de, ate }) => json(await f.agenda(de, ate)));

server.registerTool("pendencias", {
  title: "Pendências do dia",
  description: "O que precisa de atenção: chegada não conferida, acessório antes da entrega, carro na oficina, vendido sem entrega.",
  annotations: leitura,
}, async () => json(await f.pendencias()));

server.registerTool("propor_entrega", {
  title: "Propor agendamento (não grava)",
  description: `Valida um agendamento e devolve um código de confirmação. NÃO grava. Horário da loja: ${HORARIO.abre} às ${HORARIO.fecha}, entregas de ${HORARIO.duracaoMin} min, fechado aos domingos.`,
  inputSchema: { chassi: z.string(), data: z.string().describe("AAAA-MM-DD"), hora: z.string().describe("HH:MM"), obs: z.string().optional() },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async (a) => json(await f.proporEntrega(a)));

server.registerTool("confirmar_entrega", {
  title: "Confirmar agendamento",
  description: "Grava o agendamento proposto. Só chamar depois que o usuário aprovar o resumo de propor_entrega.",
  inputSchema: { codigo: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async ({ codigo }) => json(await f.confirmarEntrega(codigo)));

await server.connect(new StdioServerTransport());
