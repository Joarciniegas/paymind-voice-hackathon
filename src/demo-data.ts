// Datos 100 % ficticios para la demo del hackathon: «Lone Star Motors» no existe
// y ningún comprador es real. Con DEMO activo el Worker nunca llama al backend
// de PayMind, así que en el repo público no viaja ningún dato de clientes.

export type Deudor = {
  id: string;
  lang: 'es' | 'en';
  firstName: string;
  vehicle: string;
  pastDue: number;
  daysPastDue: number;
  paymentAmount: number;
  nextPaymentDate: string | null;
};

export const DEALER_DEMO = {
  dealerName: 'Lone Star Motors',
  dealerPhone: '(555) 010-2030',
  rules: { freeExtensionDays: 3, maxExtensionDays: 7, allowSplitPayment: true, tone: 'warm' },
};

export const DEUDORES_DEMO: Deudor[] = [
  { id: 'maria', lang: 'es', firstName: 'María', vehicle: 'Toyota Camry 2019', pastDue: 350, daysPastDue: 6, paymentAmount: 350, nextPaymentDate: null },
  { id: 'james', lang: 'en', firstName: 'James', vehicle: 'Ford F-150 2017', pastDue: 0, daysPastDue: 0, paymentAmount: 425, nextPaymentDate: '2026-11-06' },
  { id: 'luis', lang: 'es', firstName: 'Luis', vehicle: 'Nissan Altima 2018', pastDue: 640, daysPastDue: 15, paymentAmount: 320, nextPaymentDate: null },
];
