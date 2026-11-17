import { test } from "node:test";
import assert from "node:assert/strict";
import { Ferramentas } from "../src/ferramentas.js";
import { RepositorioEmMemoria } from "../src/repositorio.js";
import { carrosDemo, entregasDemo } from "../src/seed.js";
import { normalizarChassi, validarAgendamento } from "../src/dominio.js";

const HOJE = "2026-11-17"; // terça
const nova = (agora = () => Date.now()) =>
  new Ferramentas(new RepositorioEmMemoria(structuredClone(carrosDemo), structuredClone(entregasDemo)), () => HOJE, agora);

test("normaliza chassi digitado de vários jeitos", () => {
  assert.equal(normalizarChassi("303"), "VB000303");
  assert.equal(normalizarChassi(" vb000303 "), "VB000303");
  assert.throws(() => normalizarChassi("abc"));
});

test("lista só carros na loja, com local derivado", async () => {
  const lista = await nova().listarCarros({});
  assert.ok(!lista.some((c) => c.chassi === "VB000606"), "entregue não aparece");
  assert.equal(lista.find((c) => c.chassi === "VB000101")?.local, "showroom");
  assert.equal(lista.find((c) => c.chassi === "VB000505")?.local, "oficina");
});

test("bloqueia domingo, passado, fora do horário e choque de horário", () => {
  const carro = carrosDemo[1];
  const msg = (data: string, hora: string) => validarAgendamento(carro, { data, hora }, entregasDemo, HOJE).map((p) => p.msg).join(" | ");
  assert.match(msg("2026-11-22", "10:00"), /domingo/);
  assert.match(msg("2026-11-16", "10:00"), /passado/);
  assert.match(msg("2026-11-18", "17:30"), /horário/);
  assert.match(msg("2026-11-19", "11:30"), /Choca com a entrega de Ana Souza/);
  assert.equal(msg("2026-11-18", "10:00"), "");
});

test("propor não grava; confirmar grava uma vez só", async () => {
  const f = nova();
  const p = await f.proporEntrega({ chassi: "202", data: "2026-11-18", hora: "10:00" });
  assert.ok(p.ok);
  assert.equal((await f.agenda("2026-11-18", "2026-11-18")).length, 0, "rascunho não grava");
  const c = await f.confirmarEntrega(p.codigo);
  assert.ok(c.ok);
  assert.equal((await f.agenda("2026-11-18", "2026-11-18")).length, 1);
  assert.equal((await f.confirmarEntrega(p.codigo)).ok, false, "código não reaproveita");
  assert.equal(f.auditoria.length, 1);
});

test("código expira em 5 minutos", async () => {
  let t = 0;
  const f = nova(() => t);
  const p = await f.proporEntrega({ chassi: "202", data: "2026-11-18", hora: "10:00" });
  assert.ok(p.ok);
  t = 6 * 60_000;
  const c = await f.confirmarEntrega(p.codigo);
  assert.equal(c.ok, false);
});

test("revalida na confirmação se a agenda mudou no meio", async () => {
  const repo = new RepositorioEmMemoria(structuredClone(carrosDemo), structuredClone(entregasDemo));
  const f = new Ferramentas(repo, () => HOJE);
  const p = await f.proporEntrega({ chassi: "202", data: "2026-11-18", hora: "10:00" });
  assert.ok(p.ok);
  // outra pessoa marcou o mesmo horário antes da confirmação
  await repo.salvarEntrega({ id: "x", chassi: "VB000505", cliente: "Fábio Nunes", vendedor: "Duda", data: "2026-11-18", hora: "10:00", status: "agendada" });
  const c = await f.confirmarEntrega(p.codigo);
  assert.equal(c.ok, false);
  assert.equal(f.auditoria.length, 0);
});

test("avisa acessório e chegada não conferida, sem bloquear", async () => {
  const p = await nova().proporEntrega({ chassi: "505", data: "2026-11-20", hora: "09:00" });
  assert.ok(p.ok);
  assert.match(p.avisos.map((x) => x.msg).join(), /oficina/);
});

test("pendências do dia", async () => {
  const motivos = (await nova().pendencias()).map((p) => `${p.chassi}: ${p.motivo}`);
  assert.ok(motivos.includes("VB000404: chegada não conferida"));
  assert.ok(motivos.some((m) => m.startsWith("VB000303: acessório")));
  assert.ok(motivos.includes("VB000202: vendido e sem entrega marcada"));
});
