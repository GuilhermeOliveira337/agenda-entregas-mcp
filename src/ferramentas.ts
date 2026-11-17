import { randomUUID } from "node:crypto";
import {
  localDoCarro, chegadaConferida, normalizarChassi, validarAgendamento, pendencias,
  type Entrega, type Local,
} from "./dominio.js";
import type { Repositorio } from "./repositorio.js";

// Lógica das ferramentas separada do protocolo MCP: dá pra testar sem subir servidor.

type Rascunho = { entrega: Entrega; criadoEm: number };
const VALIDADE_MS = 5 * 60_000;

export class Ferramentas {
  // Escrita em duas etapas: a IA propõe, o humano confirma com o código.
  private rascunhos = new Map<string, Rascunho>();
  readonly auditoria: string[] = [];

  constructor(private repo: Repositorio, private hoje: () => string, private agora = () => Date.now()) {}

  async listarCarros(filtro: { local?: Local; modelo?: string }) {
    const carros = await this.repo.carros();
    return carros
      .map((c) => ({ chassi: c.chassi, modelo: c.modelo, cor: c.cor, cliente: c.cliente ?? null, local: localDoCarro(c), chegadaConferida: chegadaConferida(c) }))
      .filter((c) => (filtro.local ? c.local === filtro.local : c.local !== "entregue"))
      .filter((c) => (filtro.modelo ? c.modelo.toLowerCase().includes(filtro.modelo.toLowerCase()) : true));
  }

  async buscarCarro(chassi: string) {
    const c = await this.repo.carro(normalizarChassi(chassi));
    if (!c) return null;
    const entrega = (await this.repo.entregas()).find((e) => e.chassi === c.chassi && e.status === "agendada") ?? null;
    return { ...c, local: localDoCarro(c), chegadaConferida: chegadaConferida(c), entrega };
  }

  async agenda(de: string, ate: string) {
    return (await this.repo.entregas())
      .filter((e) => e.status === "agendada" && e.data >= de && e.data <= ate)
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  }

  async pendencias() {
    return pendencias(await this.repo.carros(), await this.repo.entregas(), this.hoje());
  }

  /** Etapa 1: valida e devolve um rascunho com código. Não grava nada. */
  async proporEntrega(p: { chassi: string; data: string; hora: string; obs?: string }) {
    const carro = await this.repo.carro(normalizarChassi(p.chassi));
    const problemas = validarAgendamento(carro, p, await this.repo.entregas(), this.hoje());
    if (!carro || problemas.some((x) => x.tipo === "bloqueio")) return { ok: false as const, problemas };
    if (!carro.cliente || !carro.vendedor)
      return { ok: false as const, problemas: [{ tipo: "bloqueio" as const, msg: "Carro sem cliente/vendedor cadastrado." }] };

    const codigo = randomUUID().slice(0, 6).toUpperCase();
    const entrega: Entrega = {
      id: "e-" + randomUUID().slice(0, 8), chassi: carro.chassi, cliente: carro.cliente, vendedor: carro.vendedor,
      data: p.data, hora: p.hora, status: "agendada", obs: p.obs,
    };
    this.rascunhos.set(codigo, { entrega, criadoEm: this.agora() });
    return { ok: true as const, codigo, entrega, avisos: problemas, instrucao: "Mostre o resumo ao usuário e só chame confirmar_entrega se ele aprovar." };
  }

  /** Etapa 2: grava. Revalida, porque a agenda pode ter mudado entre as etapas. */
  async confirmarEntrega(codigo: string) {
    const r = this.rascunhos.get(codigo.toUpperCase());
    if (!r) return { ok: false as const, erro: "Código inexistente ou já usado." };
    this.rascunhos.delete(codigo.toUpperCase());
    if (this.agora() - r.criadoEm > VALIDADE_MS) return { ok: false as const, erro: "Código expirou. Proponha de novo." };

    const carro = await this.repo.carro(r.entrega.chassi);
    const problemas = validarAgendamento(carro, r.entrega, await this.repo.entregas(), this.hoje());
    if (problemas.some((x) => x.tipo === "bloqueio")) return { ok: false as const, erro: "A agenda mudou.", problemas };

    await this.repo.salvarEntrega(r.entrega);
    this.auditoria.push(`${new Date(this.agora()).toISOString()} agendou ${r.entrega.chassi} ${r.entrega.data} ${r.entrega.hora}`);
    return { ok: true as const, entrega: r.entrega };
  }
}
