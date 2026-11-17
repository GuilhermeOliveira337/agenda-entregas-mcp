// Regras de negócio da agenda de entregas, sem nenhuma dependência de MCP ou banco.
// Tudo aqui é função pura, o que deixa fácil testar e reaproveitar.

export type Check = { v: "ok" | "pendente"; em?: string };

export type Carro = {
  chassi: string; // ex.: "VB001234"
  modelo: string;
  cor: string;
  cliente?: string;
  vendedor?: string;
  chegada?: string; // AAAA-MM-DD
  checks: Partial<Record<"docs" | "chave" | "manual" | "showroom", Check>>;
  oficina?: boolean;
  acessorio?: string;
  entregue?: boolean;
};

export type Entrega = {
  id: string;
  chassi: string;
  cliente: string;
  vendedor: string;
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM
  status: "agendada" | "entregue" | "cancelada";
  obs?: string;
};

export type Local = "showroom" | "pátio" | "oficina" | "entregue";

export function localDoCarro(c: Carro): Local {
  if (c.entregue) return "entregue";
  if (c.oficina) return "oficina";
  if (c.checks.showroom?.v === "ok") return "showroom";
  return "pátio";
}

const CHECKS_DE_CHEGADA = ["docs", "chave", "manual"] as const;

export function chegadaConferida(c: Carro): boolean {
  return CHECKS_DE_CHEGADA.every((k) => c.checks[k]?.v === "ok");
}

/** Aceita "1234", "001234" ou "VB001234" e devolve o chassi no formato do sistema. */
export function normalizarChassi(entrada: string): string {
  const s = entrada.trim().toUpperCase().replace(/\s+/g, "");
  if (/^VB\d{6}$/.test(s)) return s;
  const digitos = s.replace(/\D/g, "");
  if (!digitos || digitos.length > 6) throw new Error(`Chassi inválido: "${entrada}"`);
  return "VB" + digitos.padStart(6, "0");
}

export const HORARIO = { abre: "09:00", fecha: "18:00", duracaoMin: 60 };

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export type Problema = { tipo: "bloqueio" | "aviso"; msg: string };

/**
 * Valida um agendamento antes de gravar. Bloqueio impede a gravação;
 * aviso grava, mas precisa aparecer pra quem confirmou.
 */
export function validarAgendamento(
  carro: Carro | undefined,
  pedido: { data: string; hora: string },
  agenda: Entrega[],
  hoje: string,
): Problema[] {
  const p: Problema[] = [];
  if (!carro) return [{ tipo: "bloqueio", msg: "Carro não encontrado no estoque." }];
  if (carro.entregue) p.push({ tipo: "bloqueio", msg: "Esse carro já foi entregue." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pedido.data)) p.push({ tipo: "bloqueio", msg: "Data deve ser AAAA-MM-DD." });
  if (!/^\d{2}:\d{2}$/.test(pedido.hora)) p.push({ tipo: "bloqueio", msg: "Hora deve ser HH:MM." });
  if (p.length) return p;

  if (pedido.data < hoje) p.push({ tipo: "bloqueio", msg: "Data no passado." });
  const diaSemana = new Date(pedido.data + "T12:00:00").getDay();
  if (diaSemana === 0) p.push({ tipo: "bloqueio", msg: "Loja fechada no domingo." });

  const ini = minutos(pedido.hora);
  if (ini < minutos(HORARIO.abre) || ini + HORARIO.duracaoMin > minutos(HORARIO.fecha))
    p.push({ tipo: "bloqueio", msg: `Fora do horário de entrega (${HORARIO.abre} às ${HORARIO.fecha}).` });

  const choque = agenda.find(
    (e) =>
      e.status === "agendada" &&
      e.data === pedido.data &&
      Math.abs(minutos(e.hora) - ini) < HORARIO.duracaoMin,
  );
  if (choque) p.push({ tipo: "bloqueio", msg: `Choca com a entrega de ${choque.cliente} às ${choque.hora}.` });

  if (agenda.some((e) => e.chassi === carro.chassi && e.status === "agendada"))
    p.push({ tipo: "bloqueio", msg: "Esse carro já tem entrega agendada." });

  if (!chegadaConferida(carro)) p.push({ tipo: "aviso", msg: "Chegada ainda não conferida (documentos, chave ou manual)." });
  if (carro.oficina) p.push({ tipo: "aviso", msg: "Carro está na oficina." });
  if (carro.acessorio) p.push({ tipo: "aviso", msg: `Acessório pendente: ${carro.acessorio}` });
  return p;
}

export type Pendencia = { chassi: string; modelo: string; motivo: string };

/** O que precisa de atenção hoje: o "bom dia" do recebimento. */
export function pendencias(carros: Carro[], agenda: Entrega[], hoje: string): Pendencia[] {
  const out: Pendencia[] = [];
  const agendados = new Map(agenda.filter((e) => e.status === "agendada").map((e) => [e.chassi, e]));
  for (const c of carros) {
    if (c.entregue) continue;
    const e = agendados.get(c.chassi);
    if (!chegadaConferida(c)) out.push({ chassi: c.chassi, modelo: c.modelo, motivo: "chegada não conferida" });
    if (e && c.acessorio) out.push({ chassi: c.chassi, modelo: c.modelo, motivo: `acessório antes da entrega de ${e.data}` });
    if (e && c.oficina) out.push({ chassi: c.chassi, modelo: c.modelo, motivo: `na oficina com entrega em ${e.data}` });
    if (e && e.data < hoje) out.push({ chassi: c.chassi, modelo: c.modelo, motivo: `entrega de ${e.data} passou e não foi baixada` });
    if (!e && c.cliente) out.push({ chassi: c.chassi, modelo: c.modelo, motivo: "vendido e sem entrega marcada" });
  }
  return out;
}
