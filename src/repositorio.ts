import type { Carro, Entrega } from "./dominio.js";

// O servidor só conhece esta interface. Trocar a memória por Firestore,
// Postgres ou uma API é escrever outra classe com os mesmos métodos.
export interface Repositorio {
  carros(): Promise<Carro[]>;
  carro(chassi: string): Promise<Carro | undefined>;
  entregas(): Promise<Entrega[]>;
  salvarEntrega(e: Entrega): Promise<void>;
}

export class RepositorioEmMemoria implements Repositorio {
  constructor(private _carros: Carro[], private _entregas: Entrega[]) {}
  async carros() { return structuredClone(this._carros); }
  async carro(chassi: string) { return structuredClone(this._carros.find((c) => c.chassi === chassi)); }
  async entregas() { return structuredClone(this._entregas); }
  async salvarEntrega(e: Entrega) {
    const i = this._entregas.findIndex((x) => x.id === e.id);
    if (i >= 0) this._entregas[i] = e; else this._entregas.push(e);
  }
}
