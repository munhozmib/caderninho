// Utilidades de data e texto. Nada aqui depende do Supabase.

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export function parseISO(s) {
  if (!s) return null;
  const [a, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

export function dISO(data) {
  if (!data) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

export function dBR(s) {
  const d = parseISO(s);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function dCurto(s) {
  const d = parseISO(s);
  if (!d) return '';
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function diasEntre(aISO, bISO = hojeISO()) {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

// Próxima vez que a data "acontece" (aniversários), tolerando 29/02.
export function proximaOcorrencia(sISO, refISO = hojeISO()) {
  const d = parseISO(sISO);
  const ref = parseISO(refISO);
  if (!d || !ref) return null;
  const monta = (ano) => {
    const cand = new Date(ano, d.getMonth(), d.getDate());
    // 29/02 em ano comum escorrega para 01/03; puxamos para 28/02.
    if (cand.getMonth() !== d.getMonth()) return new Date(ano, 1, 28);
    return cand;
  };
  let c = monta(ref.getFullYear());
  if (c < ref) c = monta(ref.getFullYear() + 1);
  return dISO(c);
}

export function idadeEm(nascISO, refISO = hojeISO()) {
  const n = parseISO(nascISO);
  const r = parseISO(refISO);
  if (!n || !r) return null;
  let anos = r.getFullYear() - n.getFullYear();
  const antes =
    r.getMonth() < n.getMonth() ||
    (r.getMonth() === n.getMonth() && r.getDate() < n.getDate());
  if (antes) anos -= 1;
  return anos;
}

// "6 anos", "8 meses" — para filhos pequenos o mês importa.
export function idadeRotulo(nascISO) {
  const anos = idadeEm(nascISO);
  if (anos === null) return '';
  if (anos >= 2) return `${anos} anos`;
  const n = parseISO(nascISO);
  const h = new Date();
  const meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
  if (meses < 1) return 'recém-nascido';
  if (meses < 24) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  return `${anos} anos`;
}

export function emDias(n) {
  if (n === null || n === undefined) return '';
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n < 0) return `${Math.abs(n)} dias atrás`;
  if (n < 14) return `em ${n} dias`;
  if (n < 60) return `em ${Math.round(n / 7)} semanas`;
  return `em ${Math.round(n / 30)} meses`;
}

export function tempoRelativo(dias) {
  if (dias === null || dias === undefined) return 'nunca';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  if (dias < 60) return 'há um mês';
  if (dias < 365) return `há ${Math.round(dias / 30)} meses`;
  const anos = Math.floor(dias / 365);
  return anos === 1 ? 'há um ano' : `há ${anos} anos`;
}

export const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const ROTULO_TIPO = {
  nota: 'fato',
  data: 'data',
  pendencia: 'eu devo',
  gancho: 'gancho',
};

export const CANAIS = ['conversa', 'almoço', 'café', 'ligação', 'mensagem', 'e-mail', 'evento'];
