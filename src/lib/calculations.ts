/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Brazilian Labor and Tax Calculations (2024/2025 constants)
 */

export function numeroParaExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';

  const inteiros = Math.floor(valor);
  const centavos = Math.round((valor - inteiros) * 100);

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas10 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function converterGrupo(n: number): string {
    if (n === 100) return 'cem';
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res += centenas[c];
    if (d === 1) {
      if (res) res += ' e ';
      res += dezenas10[u];
      return res;
    }
    if (d > 1) {
      if (res) res += ' e ';
      res += dezenas[d];
    }
    if (u > 0) {
      if (res) res += ' e ';
      res += unidades[u];
    }
    return res;
  }

  let extenso = '';
  
  if (inteiros > 0) {
    const milhares = Math.floor(inteiros / 1000);
    const resto = inteiros % 1000;

    if (milhares > 0) {
      if (milhares === 1) extenso += 'mil';
      else extenso += converterGrupo(milhares) + ' mil';
    }

    if (resto > 0) {
      if (extenso) {
        if (resto < 100 || resto % 100 === 0) extenso += ' e ';
        else extenso += ' ';
      }
      extenso += converterGrupo(resto);
    }
    
    extenso += inteiros === 1 ? ' real' : ' reais';
  }

  if (centavos > 0) {
    if (extenso) extenso += ' e ';
    extenso += converterGrupo(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }

  return extenso;
}
const INSS_TABLE = [
  { limit: 1412.00, rate: 0.075 },
  { limit: 2666.68, rate: 0.09 },
  { limit: 4000.03, rate: 0.12 },
  { limit: 7786.02, rate: 0.14 },
];

export function calculateINSS(salary: number): number {
  let inss = 0;
  let remainingSalary = salary;
  let previousLimit = 0;

  for (const tier of INSS_TABLE) {
    const amountInTier = Math.min(remainingSalary, tier.limit - previousLimit);
    if (amountInTier <= 0) break;
    
    inss += amountInTier * tier.rate;
    remainingSalary -= amountInTier;
    previousLimit = tier.limit;
    
    if (salary <= tier.limit) break;
  }

  // Ceiling check (Teto do INSS)
  const maxINSS = 908.85; // Approximately for 2024 ceiling
  return Math.min(inss, maxINSS);
}

// --- IRPF 2024 Table ---
const IRPF_TABLE = [
  { limit: 2259.20, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 169.44 },
  { limit: 3751.05, rate: 0.15, deduction: 381.44 },
  { limit: 4664.68, rate: 0.225, deduction: 662.77 },
  { limit: Infinity, rate: 0.275, deduction: 896.00 },
];

const DEPENDENT_VALUE = 189.59;

export function calculateIRPF(salary: number, inss: number, dependents: number): number {
  const baseCalculo = salary - inss - (dependents * DEPENDENT_VALUE);
  
  if (baseCalculo <= 2259.20) return 0;

  for (const tier of IRPF_TABLE) {
    if (baseCalculo <= tier.limit) {
      const tax = (baseCalculo * tier.rate) - tier.deduction;
      return Math.max(0, tax);
    }
  }
  return 0;
}

// --- Salário Família 2024 ---
const FAMILY_SALARY_LIMIT = 1819.26;
const FAMILY_SALARY_VALUE = 62.04;

export function calculateFamilySalary(salary: number, dependents: number): number {
  if (salary <= FAMILY_SALARY_LIMIT) {
    return dependents * FAMILY_SALARY_VALUE;
  }
  return 0;
}

// --- Simples Nacional Tables (Anexo III) ---
// Note: This is an abstraction. Real SN involves complex RBT12 formulas.
const SIMPLES_ANEXO_III = [
  { limit: 180000, rate: 0.06, deduction: 0 },
  { limit: 360000, rate: 0.112, deduction: 9360 },
  { limit: 720000, rate: 0.135, deduction: 17640 },
  { limit: 1800000, rate: 0.16, deduction: 35640 },
  { limit: 3600000, rate: 0.21, deduction: 125640 },
  { limit: 4800000, rate: 0.33, deduction: 648000 },
];

export function calculateSimplesNacional(monthlyRevenue: number, rbt12: number, anexo: 'III' | 'IV' = 'III'): {
  effectiveRate: number;
  dasValue: number;
} {
  // Formula: Effective Rate = (RBT12 * Nominal Rate - Deduction) / RBT12
  const table = SIMPLES_ANEXO_III; // Assuming III for funerary services (depends on CNAE)
  
  let tier = table.find(t => rbt12 <= t.limit) || table[table.length - 1];
  
  const effectiveRate = rbt12 > 0 
    ? ((rbt12 * tier.rate) - tier.deduction) / rbt12 
    : tier.rate;

  return {
    effectiveRate: Math.max(0, effectiveRate),
    dasValue: monthlyRevenue * effectiveRate,
  };
}

// --- Advanced Calculations ---
export function calculatePayroll(salary: number, dependents: number, useVT: boolean, events: any[] = []): any {
  // Aggregate events
  let otherProventos = 0;
  let otherDescontos = 0;
  events.forEach(ev => {
    if (ev.type === 'provento') otherProventos += ev.value;
    else if (ev.type === 'desconto') otherDescontos += ev.value;
  });

  // Simplified: proventos incidem sobre INSS/FGTS? Depende do provento, mas vamos usar uma modelagem básica
  // O correto seria algumas rubricas terem ou n incidência, 
  // aqui consideraremos para simplificar que hora extra/bonus incidem na base
  const salaryBaseCalc = salary + otherProventos; 

  const inss = calculateINSS(salaryBaseCalc);
  const irpf = calculateIRPF(salaryBaseCalc, inss, dependents);
  const fgts = salaryBaseCalc * 0.08;
  const familySalary = calculateFamilySalary(salaryBaseCalc, dependents);
  const vtDeduction = useVT ? Math.min(salary * 0.06, 9999) : 0; // Simplified VT

  // Provisions (1/12 rule) based on base calculation
  const thirteenth = salaryBaseCalc / 12;
  const vacation = salaryBaseCalc / 12;
  const vacationBonus = vacation / 3;
  const taxesOnProvisions = (thirteenth + vacation + vacationBonus) * (0.08); // Only FGTS for SN Anexo III

  const netSalary = salaryBaseCalc - inss - irpf - vtDeduction - otherDescontos + familySalary;
  const totalCost = salaryBaseCalc + fgts + thirteenth + vacation + vacationBonus + taxesOnProvisions;

  return {
    baseSalary: salary,
    inss,
    irpf,
    fgts,
    familySalary,
    vtDeduction,
    otherProventos,
    otherDescontos,
    events,
    netSalary,
    totalCost,
    provisions: {
      thirteenth,
      vacation,
      vacationBonus,
      taxesOnProvisions
    }
  };
}
