import type { Carro, Entrega } from "./dominio.js";

// Dados 100% fictícios. Nenhum cliente, chassi ou vendedor real.
const ok = { v: "ok" as const, em: "10/11 09:00" };

export const carrosDemo: Carro[] = [
  { chassi: "VB000101", modelo: "CS55 Plus", cor: "Preto", cliente: "Ana Souza", vendedor: "Bruno", chegada: "2026-11-03", checks: { docs: ok, chave: ok, manual: ok, showroom: ok } },
  { chassi: "VB000202", modelo: "CS75 Plus", cor: "Branco Pérola", cliente: "Carlos Lima", vendedor: "Duda", chegada: "2026-11-05", checks: { docs: ok, chave: ok, manual: ok } },
  { chassi: "VB000303", modelo: "UNI-T", cor: "Azul", cliente: "Elisa Rocha", vendedor: "Bruno", chegada: "2026-11-12", checks: { docs: ok, chave: ok, manual: ok }, acessorio: "película G20" },
  { chassi: "VB000404", modelo: "CS55 Plus", cor: "Cinza", chegada: "2026-11-16", checks: { docs: ok } },
  { chassi: "VB000505", modelo: "UNI-K", cor: "Vermelho", cliente: "Fábio Nunes", vendedor: "Duda", chegada: "2026-10-28", checks: { docs: ok, chave: ok, manual: ok }, oficina: true },
  { chassi: "VB000606", modelo: "CS75 Plus", cor: "Preto", cliente: "Gabi Torres", vendedor: "Bruno", chegada: "2026-10-20", checks: { docs: ok, chave: ok, manual: ok }, entregue: true },
];

export const entregasDemo: Entrega[] = [
  { id: "e1", chassi: "VB000101", cliente: "Ana Souza", vendedor: "Bruno", data: "2026-11-19", hora: "11:00", status: "agendada" },
  { id: "e2", chassi: "VB000303", cliente: "Elisa Rocha", vendedor: "Bruno", data: "2026-11-19", hora: "14:00", status: "agendada" },
  { id: "e3", chassi: "VB000606", cliente: "Gabi Torres", vendedor: "Bruno", data: "2026-11-10", hora: "10:00", status: "entregue" },
];
