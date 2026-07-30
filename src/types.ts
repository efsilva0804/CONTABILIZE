export interface PayrollEvent {
  id: string;
  name: string;
  type: 'provento' | 'desconto';
  value: number;
}

export interface Employee {
  id: string;
  name: string;
  cpf?: string;
  role?: string;
  cbo?: string;
  salaryBase: number;
  dependents: number;
  useVT: boolean;
  vtValue?: number;
  events?: PayrollEvent[];
}

export interface PayrollResult {
  employeeId: string;
  name: string;
  baseSalary: number;
  inss: number;
  irpf: number;
  fgts: number;
  vtDeduction: number;
  familySalary: number;
  otherProventos: number;
  otherDescontos: number;
  events: PayrollEvent[];
  netSalary: number;
  totalCost: number;
  provisions: {
    vacation: number;
    vacationOneThird: number;
    thirteenthSalary: number;
    taxesOnProvisions: number;
  };
}

export interface SimplesNacionalResult {
  revenue: number;
  rbt12: number;
  effectiveRate: number;
  dasValue: number;
  anexo: 'III' | 'IV';
}

export interface MonthData {
  month: string; // ISO String or YYYY-MM
  revenue: number;
  rbt12: number;
  payroll: PayrollResult[];
  das: SimplesNacionalResult;
}
