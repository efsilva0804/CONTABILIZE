/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  Calculator, 
  FileText, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Download, 
  Send,
  MoreVertical,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ListPlus,
  MessageCircle,
  CheckSquare,
  LogOut,
  Cloud,
  Save,
  DownloadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { calculatePayroll, calculateSimplesNacional, numeroParaExtenso } from './lib/calculations';
import type { Employee, PayrollResult, SimplesNacionalResult } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format Currency
const fmt = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [isDriveAuthed, setIsDriveAuthed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  useEffect(() => {
    // Check initial drive auth status
    fetch('/api/oauth/google/status')
      .then(res => res.json())
      .then(data => setIsDriveAuthed(data.authenticated))
      .catch(err => console.error("Error checking drive auth", err));

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
        setIsDriveAuthed(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDriveAuth = async () => {
    try {
      const res = await fetch('/api/oauth/google/auth');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'Google OAuth', 'width=500,height=600');
      }
    } catch (err) {
      console.error("Error initiating oauth", err);
    }
  };

  const handleSaveToDrive = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/drive/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employees)
      });
      if (!res.ok) throw new Error("Save failed");
      alert("Dados salvos no Google Drive com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar no Drive.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromDrive = async () => {
    setIsLoadingDrive(true);
    try {
      const res = await fetch('/api/drive/load');
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
        alert("Dados carregados do Google Drive!");
      } else {
        alert("Nenhum dado encontrado no Google Drive.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar do Drive.");
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'dash' | 'employees' | 'fiscal' | 'reports' | 'settings'>('dash');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // State for Companies
  const [companies, setCompanies] = useState([{ id: '1', name: 'Funerária Paz Eterna Ltda', cnpj: '12.345.678/0001-90' }]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('1');
  
  const currentCompany = useMemo(() => 
    companies.find(c => c.id === selectedCompanyId) || companies[0], 
    [companies, selectedCompanyId]
  );

  // State for MVP
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('contabil_employees');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: '1', name: 'João da Silva', salaryBase: 2500, dependents: 1, useVT: true },
      { id: '2', name: 'Maria Oliveira', salaryBase: 3200, dependents: 2, useVT: false },
    ];
  });

  useEffect(() => {
    localStorage.setItem('contabil_employees', JSON.stringify(employees));
  }, [employees]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, employeeId: string, name: string } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    cpf: '',
    role: '',
    cbo: '',
    salaryBase: 1412,
    dependents: 0,
    useVT: false
  });

  const [eventsModal, setEventsModal] = useState<{isOpen: boolean, employeeId: string | null}>({isOpen: false, employeeId: null});
  const [newEvent, setNewEvent] = useState({ name: '', type: 'provento' as 'provento'|'desconto', value: 0 });

  const handleAddEvent = () => {
    if(!eventsModal.employeeId || !newEvent.name || newEvent.value <= 0) return;
    setEmployees(prev => prev.map(emp => {
      if(emp.id === eventsModal.employeeId) {
        return {
          ...emp,
          events: [...(emp.events || []), { id: Math.random().toString(), ...newEvent }]
        }
      }
      return emp;
    }));
    setNewEvent({ name: '', type: 'provento', value: 0 });
  };
  
  const handleRemoveEvent = (empId: string, eventId: string) => {
    setEmployees(prev => prev.map(emp => {
      if(emp.id === empId) {
        return { ...emp, events: emp.events?.filter(e => e.id !== eventId) || [] }
      }
      return emp;
    }));
  };

  const [fiscalData, setFiscalData] = useState({
    monthlyRevenue: 45000,
    rbt12: 500000,
  });

  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [checklistItems, setChecklistItems] = useState([
    { id: 1, text: 'Folha de Pagamento', done: false },
    { id: 2, text: 'Emissão de Holerites', done: false },
    { id: 3, text: 'Apuração e Envio do DAS', done: false },
    { id: 4, text: 'Envio do eSocial', done: false },
    { id: 5, text: 'Emissão de Pró-labore', done: false },
    { id: 6, text: 'Guias de INSS/FGTS', done: false },
  ]);

  const handleSendWhatsApp = () => {
    if (!clientPhone) {
      alert("Por favor, informe o WhatsApp do cliente.");
      return;
    }
    
    let message = `Olá${clientName ? ' ' + clientName : ''},\nSegue o checklist dos serviços contábeis realizados e entregues pela ${currentCompany.name}:\n\n`;
    
    checklistItems.forEach(item => {
      message += `${item.done ? '✅' : '❌'} ${item.text}\n`;
    });
    
    message += `\nEstamos à disposição para qualquer dúvida.`;
    
    const encodedMessage = encodeURIComponent(message);
    const numericPhone = clientPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${numericPhone}?text=${encodedMessage}`, '_blank');
    setIsChecklistModalOpen(false);
  };

  // Derived Calculations
  const payrolls = useMemo(() => 
    employees.map(emp => ({
      ...calculatePayroll(emp.salaryBase, emp.dependents, emp.useVT, emp.events || []),
      employeeId: emp.id,
      name: emp.name,
      cpf: emp.cpf,
      role: emp.role,
      cbo: emp.cbo
    })), [employees]);

  const dashStats = useMemo(() => {
    const totalSalaries = payrolls.reduce((acc, p) => acc + p.baseSalary, 0);
    const totalFGTS = payrolls.reduce((acc, p) => acc + p.fgts, 0);
    const totalProvisions = payrolls.reduce((acc, p) => 
      acc + p.provisions.thirteenth + p.provisions.vacation + p.provisions.vacationBonus + p.provisions.taxesOnProvisions, 0);
    const totalPayrollCost = payrolls.reduce((acc, p) => acc + p.totalCost, 0);
    
    const snResult = calculateSimplesNacional(fiscalData.monthlyRevenue, fiscalData.rbt12);

    return {
      totalSalaries,
      totalFGTS,
      totalProvisions,
      totalPayrollCost,
      dasValue: snResult.dasValue,
      effectiveRate: snResult.effectiveRate * 100
    };
  }, [payrolls, fiscalData]);

  // Export functions
  const exportPayrollToPDF = (p: any) => {
    const doc = new jsPDF('p', 'mm', 'a4') as any;
    
    // Colors
    const borderCol = [200, 200, 200];
    const textGray = [120, 120, 120];
    const textDark = [30, 30, 30];
    const bgHeaderBlue = [35, 56, 118];
    const bgLight = [245, 247, 250];
    
    const drawReceipt = (startY: number, isSignatureVia: boolean) => {
      // Wrapper
      doc.setDrawColor(...borderCol);
      doc.setLineWidth(0.3);
      
      if (!isSignatureVia) {
        // --- 1. Top Header Box ---
        doc.setFillColor(...bgLight);
        doc.rect(10, startY, 190, 22, 'F');
        doc.rect(10, startY, 190, 22, 'S');
        
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("EMPREGADOR", 13, startY + 4);
        
        doc.setFontSize(10);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", "bold");
        doc.text(currentCompany.name.toUpperCase(), 13, startY + 9);
        
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("CNPJ", 13, startY + 15);
        
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.text(currentCompany.cnpj || "Não Informado", 13, startY + 19);

        // Right side of Header Box
        doc.line(125, startY, 125, startY + 22);
        doc.setFontSize(14);
        doc.setTextColor(...bgHeaderBlue);
        doc.setFont("helvetica", "bold");
        doc.text("Recibo de Pagamento", 157, startY + 9, { align: "center" });
        doc.text("de Salário", 157, startY + 16, { align: "center" });
        
        // --- 2. Employee Info Row ---
        doc.rect(10, startY + 25, 190, 12);
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("CPF", 13, startY + 29);
        doc.text("NOME DO FUNCIONÁRIO", 45, startY + 29);
        doc.text("CBO", 145, startY + 29);
        
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", "bold");
        doc.text(p.cpf || "---", 13, startY + 34);
        doc.text(p.name.toUpperCase(), 45, startY + 34);
        doc.text(p.cbo || "Não Informado", 145, startY + 34);
        
        doc.line(42, startY + 25, 42, startY + 37);
        doc.line(142, startY + 25, 142, startY + 37);
        
        // --- 3. Empresa Info Row ---
        doc.rect(10, startY + 37, 190, 12);
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("EMPRESA", 13, startY + 41);
        doc.text("CARGO", 45, startY + 41);
        doc.text("COMPETÊNCIA", 145, startY + 41);
        
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", "bold");
        doc.text("Matriz", 13, startY + 46);
        doc.text(p.role || "Não Informado", 45, startY + 46);
        doc.text(format(new Date(), 'MM/yyyy'), 145, startY + 46);
        
        doc.line(42, startY + 37, 42, startY + 49);
        doc.line(142, startY + 37, 142, startY + 49);
        
        // --- 4. Items Table ---
        doc.setFillColor(...bgHeaderBlue);
        doc.rect(10, startY + 52, 190, 7, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("CÓD.", 12, startY + 57);
        doc.text("DESCRIÇÃO", 30, startY + 57);
        doc.text("REFERÊNCIA", 125, startY + 57, { align: "center" });
        doc.text("PROVENTOS", 155, startY + 57, { align: "center" });
        doc.text("DESCONTOS", 185, startY + 57, { align: "center" });
        
        const rowHeight = 7;
        let currentY = startY + 59;
        let idx = 1;
        
        const drawRow = (cod: string, desc: string, ref: string, prov: string, descV: string) => {
          doc.setTextColor(...textDark);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          
          doc.rect(10, currentY, 190, rowHeight);
          doc.text(cod, 12, currentY + 5);
          doc.text(desc, 30, currentY + 5);
          doc.text(ref, 125, currentY + 5, { align: "center" });
          if(prov) doc.text(prov, 168, currentY + 5, { align: "right" });
          if(descV) doc.text(descV, 198, currentY + 5, { align: "right" });
          
          doc.line(28, currentY, 28, currentY + rowHeight);
          doc.line(110, currentY, 110, currentY + rowHeight);
          doc.line(140, currentY, 140, currentY + rowHeight);
          doc.line(170, currentY, 170, currentY + rowHeight);
          currentY += rowHeight;
          idx++;
        };
        
        drawRow("SAL001", "Salário Base", "30,00", fmt(p.baseSalary), "");
        if (p.familySalary > 0) drawRow("FAM001", "Salário Família", "Cota", fmt(p.familySalary), "");
        
        if (p.events && p.events.length > 0) {
          p.events.forEach((ev: any, index: number) => {
            const cod = ev.type === 'provento' ? `PROV0${index+1}` : `DESC0${index+1}`;
            drawRow(cod, ev.name, "-", ev.type === 'provento' ? fmt(ev.value) : "", ev.type === 'desconto' ? fmt(ev.value) : "");
          });
        }
        
        if (p.inss > 0) drawRow("DESC01", "INSS Retido (Tabela Progressiva)", "-", "", fmt(p.inss));
        if (p.irpf > 0) drawRow("DESC02", "IRRF - Imposto de Renda Retido", "-", "", fmt(p.irpf));
        if (p.vtDeduction > 0) drawRow("DESC03", "Vale Transporte", "6,00%", "", fmt(p.vtDeduction));
        
        // Fill empty rows up to 6 total for consistency
        while(idx <= 6) {
          drawRow("", "", "", "", "");
        }
        
        // --- 5. Totals Row ---
        doc.setFillColor(...bgLight);
        doc.rect(10, currentY, 190, 8, 'F');
        doc.rect(10, currentY, 190, 8, 'S');
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Totals", 135, currentY + 5.5, { align: "right" });
        
        const totalProventos = p.baseSalary + p.familySalary + p.otherProventos;
        const totalDescontos = p.inss + p.irpf + p.vtDeduction + p.otherDescontos;
        doc.text(fmt(totalProventos), 168, currentY + 5.5, { align: "right" });
        doc.text(fmt(totalDescontos), 198, currentY + 5.5, { align: "right" });
        
        doc.line(140, currentY, 140, currentY + 8);
        doc.line(170, currentY, 170, currentY + 8);
        currentY += 8;
        
        // --- 6. Bases Info ---
        doc.rect(10, currentY + 4, 190, 10);
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("SALÁRIO BASE", 13, currentY + 7.5);
        doc.text("BASE CÁLC. INSS", 60, currentY + 7.5);
        doc.text("BASE CÁLC. FGTS", 110, currentY + 7.5);
        doc.text("FGTS DO MÊS", 155, currentY + 7.5);
        
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", "bold");
        const baseCalc = p.baseSalary + p.otherProventos; 
        doc.text(fmt(p.baseSalary), 13, currentY + 12);
        doc.text(fmt(baseCalc), 60, currentY + 12);
        doc.text(fmt(baseCalc), 110, currentY + 12);
        doc.text(fmt(p.fgts), 155, currentY + 12);
        
        doc.line(58, currentY + 4, 58, currentY + 14);
        doc.line(108, currentY + 4, 108, currentY + 14);
        doc.line(153, currentY + 4, 153, currentY + 14);
        
        currentY += 14;
        
        doc.rect(10, currentY, 190, 10);
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("BASE CÁLC. IRRF", 13, currentY + 3.5);
        doc.text("FAIXA IRRF", 60, currentY + 3.5);
        doc.text("INFORMATIVO", 110, currentY + 3.5);
        
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(baseCalc - p.inss - (p.dependents*189.59)), 13, currentY + 8); // Simplified IRRF base
        doc.text(p.irpf > 0 ? "Tributável" : "Isento", 60, currentY + 8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("---", 110, currentY + 8);
        
        doc.line(58, currentY, 58, currentY + 10);
        doc.line(108, currentY, 108, currentY + 10);
        
        currentY += 10;
        
        // --- 7. Net Value ---
        currentY += 4;
        doc.setDrawColor(...bgHeaderBlue);
        doc.setFillColor(...bgLight);
        doc.rect(10, currentY, 190, 18, 'FD');
        doc.setDrawColor(...borderCol);
        
        doc.setFontSize(10);
        doc.setTextColor(...bgHeaderBlue);
        doc.setFont("helvetica", "bold");
        doc.text("VALOR LÍQUIDO A RECEBER", 105, currentY + 6, { align: "center" });
        
        doc.setFontSize(16);
        doc.text(fmt(p.netSalary), 105, currentY + 14, { align: "center" });
        
        return currentY + 25;
      } else {
        // --- 8. Signature Block ---
        doc.setFillColor(...bgLight);
        doc.rect(10, startY, 190, 10, 'F');
        doc.rect(10, startY, 190, 10, 'S');
        
        doc.setFontSize(12);
        doc.setTextColor(...bgHeaderBlue);
        doc.setFont("helvetica", "bold");
        doc.text("Comprovante de Encomenda e Recibo de Pagamento", 105, startY + 6.5, { align: "center" });
        
        doc.rect(10, startY + 13, 190, 10);
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.setFont("helvetica", "normal");
        doc.text("FUNCIONÁRIO", 13, startY + 16.5);
        doc.text("COMPETÊNCIA", 145, startY + 16.5);
        
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.setFont("helvetica", "bold");
        doc.text(p.name.toUpperCase(), 13, startY + 21);
        doc.text(format(new Date(), 'MM/yyyy'), 145, startY + 21);
        
        doc.line(142, startY + 13, 142, startY + 23);
        
        doc.rect(10, startY + 25, 190, 35);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        const extenso = numeroParaExtenso(p.netSalary);
        const decText = `Declaro ter recebido a importância líquida de ${fmt(p.netSalary)} (${extenso}), discriminada neste recibo, referente ao pagamento do meu salário e demais verbas do período acima indicado.`;
        
        const splitText = doc.splitTextToSize(decText, 180);
        doc.text(splitText, 13, startY + 32);
        
        doc.setFontSize(7);
        doc.setTextColor(...textGray);
        doc.text("DATA DE PAGAMENTO", 13, startY + 48);
        doc.text("_____/_____/_________", 13, startY + 56);
        
        doc.line(105, startY + 54, 190, startY + 54);
        doc.text("ASSINATURA DO FUNCIONÁRIO", 147.5, startY + 58, { align: "center" });
        
        return startY + 60;
      }
    };

    // Draw first block
    let currentY = 15;
    currentY = drawReceipt(currentY, false);
    
    // Draw cut line
    currentY += 8;
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([2, 5], 0);
    doc.line(10, currentY, 200, currentY);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(200, 200, 200);
    
    // Draw second block
    currentY += 8;
    drawReceipt(currentY, true);

    doc.save(`holerite_${p.name.replace(/\s/g, '_')}.pdf`);
  };

  const sendWhatsApp = (p: any) => {
    const message = `*HOLERITE - ${currentCompany.name}*\n` +
      `Funcionário: ${p.name}\n` +
      `Mês/Ano: ${format(new Date(), 'MM/yyyy')}\n\n` +
      `Salário Base: ${fmt(p.baseSalary)}\n` +
      `Desconto INSS: ${fmt(p.inss)}\n` +
      `Líquido a Receber: ${fmt(p.netSalary)}\n\n` +
      `_Gerado via ContábilJá_`;
    
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const sendDashboardSummary = () => {
    const message = `*RESUMO CONTÁBIL - ${currentCompany.name}*\n` +
      `Data: ${format(new Date(), 'dd/MM/yyyy')}\n\n` +
      `DAS Simples: ${fmt(dashStats.dasValue)}\n` +
      `Custo Total Folha: ${fmt(dashStats.totalPayrollCost)}\n` +
      `Eficiência Tributária: ${dashStats.effectiveRate.toFixed(2)}%\n\n` +
      `_Enviado via Funerária-Cont_`;
    
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleAddEmployee = () => {
    if (!newEmployee.name || newEmployee.salaryBase <= 0) {
      alert("Por favor, preencha o nome e um salário válido.");
      return;
    }

    const employee: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      ...newEmployee
    };

    setEmployees(prev => [...prev, employee]);
    setIsAddModalOpen(false);
    setNewEmployee({ name: '', cpf: '', role: '', cbo: '', salaryBase: 1412, dependents: 0, useVT: false });
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(payrolls.map(p => ({
      Nome: p.name,
      'Salário Base': p.baseSalary,
      INSS: p.inss,
      IRPF: p.irpf,
      FGTS: p.fgts,
      'Líquido': p.netSalary,
      'Custo Total': p.totalCost
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folha Mensal");
    XLSX.writeFile(wb, "Relatorio_Contabil.xlsx");
  };

  const exportConsolidatedPayrollPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO CONSOLIDADO - FOLHA DE PAGAMENTO", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${currentCompany.name}`, 20, 30);
    doc.text(`Período: ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })}`, 20, 35);

    const body = payrolls.map(p => [
      p.name,
      fmt(p.baseSalary),
      fmt(p.inss),
      fmt(p.fgts),
      fmt(p.irpf),
      fmt(p.netSalary),
      fmt(p.totalCost)
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["Colaborador", "Sal. Base", "INSS", "FGTS", "IRPF", "Líquido", "Custo Total"]],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    doc.save(`relatorio_folha_consolidada_${format(new Date(), 'MM_yyyy')}.pdf`);
  };

  const exportProvisionsPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE PROVISÕES TRABALHISTAS", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${currentCompany.name}`, 20, 30);
    doc.text(`Data de Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 35);

    const body = payrolls.map(p => [
      p.name,
      fmt(p.provisions.thirteenth),
      fmt(p.provisions.vacation),
      fmt(p.provisions.vacationBonus),
      fmt(p.provisions.taxesOnProvisions),
      fmt(p.provisions.thirteenth + p.provisions.vacation + p.provisions.vacationBonus + p.provisions.taxesOnProvisions)
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["Colaborador", "13º Salário", "Férias", "1/3 Férias", "Encargos prov.", "Total Provisionado"]],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // emerald-500
      styles: { fontSize: 8 }
    });

    doc.save(`relatorio_provisoes_${format(new Date(), 'MM_yyyy')}.pdf`);
  };

  const exportFiscalMemoryPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFont("helvetica", "bold");
    doc.text("MEMÓRIA DE CÁLCULO - SIMPLES NACIONAL", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${currentCompany.name}`, 20, 30);
    doc.text(`Referência: ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })}`, 20, 35);

    const data = [
      ["Descrição", "Valor"],
      ["Receita Mensal Bruta", fmt(fiscalData.monthlyRevenue)],
      ["RBT12 (Acumulado 12 meses)", fmt(fiscalData.rbt12)],
      ["Alíquota Nominal (Anexo III)", "6.0%"],
      ["Parcela a Deduzir (Faixa 1)", fmt(0)],
      ["Alíquota Efetiva Apurada", `${dashStats.effectiveRate.toFixed(2)}%`],
      ["Valor Final da Guia DAS", fmt(dashStats.dasValue)]
    ];

    autoTable(doc, {
      startY: 45,
      head: [data[0]],
      body: data.slice(1),
      theme: 'plain',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 10 }
    });

    doc.save(`memoria_calculo_fiscal_${format(new Date(), 'MM_yyyy')}.pdf`);
  };

  const handleLogin = (e: any) => {
    e.preventDefault();
    if (loginUsername === 'eniofds@gmail.com' && loginPassword === 'M@nu0412') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Usuário ou senha incorretos.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center font-sans">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
              C
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">Login - ContábilJá</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Usuário</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-medium text-slate-800 transition-all"
                placeholder="Ex: eniofds@gmail.com"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Senha</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-medium text-slate-800 transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="text-red-500 text-sm font-medium text-center">
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className={cn(
          "p-6 flex items-center justify-between border-b border-slate-100",
          isSidebarCollapsed && "p-4 justify-center"
        )}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                C
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">ContábilJá</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavItem 
            active={activeTab === 'dash'} 
            onClick={() => setActiveTab('dash')} 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            active={activeTab === 'fiscal'} 
            onClick={() => setActiveTab('fiscal')} 
            icon={<Receipt size={20} />} 
            label="Módulo Fiscal" 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            active={activeTab === 'employees'} 
            onClick={() => setActiveTab('employees')} 
            icon={<Users size={20} />} 
            label="Depto Pessoal" 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
            icon={<FileText size={20} />} 
            label="Relatórios" 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={<Settings size={20} />} 
            label="Configurações" 
            collapsed={isSidebarCollapsed}
          />
        </nav>

        <div className="p-3">
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-3 w-full px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
          >
            <LogOut size={20} className="group-hover:text-red-600 transition-colors" />
            {!isSidebarCollapsed && <span className="font-medium text-sm">Sair do Sistema</span>}
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <div className={cn(
            "flex items-center gap-3 p-2 bg-slate-50/50 rounded-xl border border-slate-100",
            isSidebarCollapsed && "justify-center border-none bg-transparent"
          )}>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
              {currentCompany.name.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate text-slate-900">{currentCompany.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Simples Nacional</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">
            {activeTab === 'dash' && `Painel de Gestão Mensal - ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })}`}
            {activeTab === 'employees' && "Departamento Pessoal - Gestão de Folha"}
            {activeTab === 'fiscal' && "Fiscal - Apuração Simples Nacional"}
            {activeTab === 'reports' && "Exportação de Documentos Contábeis"}
          </h1>
          
          <div className="flex gap-3">
            <button 
              onClick={sendDashboardSummary}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm"
            >
              <Send size={16} />
              Enviar Pelo WhatsApp
            </button>
            <button 
              onClick={exportExcel}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm bg-white"
            >
              Exportar XLS
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8 max-w-7xl">
            
            <AnimatePresence mode="wait">
              {activeTab === 'dash' && (
                <motion.div 
                  key="dash"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* Stats Row */}
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                      title="DAS (Imposto Estimado)" 
                      value={fmt(dashStats.dasValue)} 
                      subtitle={`Alíquota Efetiva: ${dashStats.effectiveRate.toFixed(1)}%`}
                      icon={<Receipt className="text-blue-600" />}
                      highlight="text-blue-600"
                    />
                    <StatCard 
                      title="Custo Total Folha" 
                      value={fmt(dashStats.totalPayrollCost)} 
                      subtitle="Incluindo encargos e provisões"
                      icon={<Calculator className="text-slate-600" />}
                    />
                    <StatCard 
                      title="FGTS Mensal" 
                      value={fmt(dashStats.totalFGTS)} 
                      subtitle={`Vencimento: 07/${format(new Date(), 'MM/yyyy')}`}
                      icon={<CreditCard className="text-slate-600" />}
                    />
                    <StatCard 
                      title="Provisões Acumuladas" 
                      value={fmt(dashStats.totalProvisions)} 
                      subtitle="13º e Férias reservado"
                      icon={<TrendingUp className="text-emerald-600" />}
                      highlight="text-emerald-600"
                    />
                  </section>

                  {/* Modules Grid */}
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Module 1: Fiscal */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                          <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                          Módulo Fiscal (Anexo III)
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded uppercase tracking-wider">
                          SIMPLES NACIONAL
                        </span>
                      </div>
                      <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 block mb-1.5 uppercase tracking-wide">Faturamento Mensal</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">R$</span>
                              <input 
                                type="text" 
                                readOnly 
                                value={fiscalData.monthlyRevenue.toLocaleString('pt-BR')} 
                                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-bold focus:outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 block mb-1.5 uppercase tracking-wide">RBT12 (Acumulado)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">R$</span>
                              <input 
                                type="text" 
                                readOnly 
                                value={fiscalData.rbt12.toLocaleString('pt-BR')} 
                                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-semibold focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-slate-600">Base de Cálculo</span>
                            <span className="text-sm font-semibold">{fmt(fiscalData.monthlyRevenue)}</span>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-slate-600">Alíquota Nominal</span>
                            <span className="text-sm font-semibold">6,00%</span>
                          </div>
                          <div className="border-t border-slate-200 my-2 pt-2 flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-800">Total DAS a Pagar</span>
                            <span className="text-xl font-bold text-blue-600">{fmt(dashStats.dasValue)}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveTab('fiscal')}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                        >
                          Gerar Guia DAS
                        </button>
                      </div>
                    </div>

                    {/* Module 2: Depto Pessoal */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                          <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                          Folha de Pagamento
                        </h2>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{employees.length} Funcionários Ativos</span>
                      </div>
                      <div className="p-6 space-y-4 overflow-y-auto max-h-[350px]">
                        {payrolls.map((p) => (
                          <div key={p.employeeId} className="p-4 border border-slate-100 rounded-xl hover:border-blue-200 transition bg-slate-50/50 group">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="text-sm font-bold text-slate-800">{p.name}</h3>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Salário Base: {fmt(p.baseSalary)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => exportPayrollToPDF(p)}
                                  className="text-blue-600 hover:underline text-[11px] font-bold"
                                >
                                  Ver Holerite
                                </button>
                                <button 
                                  onClick={() => sendWhatsApp(p)}
                                  className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-lg transition-colors"
                                  title="Enviar via WhatsApp"
                                >
                                  <Send size={14} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setDeleteConfirm({ isOpen: true, employeeId: p.employeeId, name: p.name });
                                  }}
                                  className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                  title="Excluir Colaborador"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center bg-white p-2 rounded border border-slate-100">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">INSS</p>
                                <p className="text-xs font-bold text-slate-700">{fmt(p.inss)}</p>
                              </div>
                              <div className="text-center bg-white p-2 rounded border border-slate-100">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">FGTS</p>
                                <p className="text-xs font-bold text-slate-700">{fmt(p.fgts)}</p>
                              </div>
                              <div className="text-center bg-white p-2 rounded border border-slate-100">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Líquido</p>
                                <p className="text-xs font-bold text-emerald-600">{fmt(p.netSalary)}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="pt-2 border-t border-slate-100 mt-2">
                           <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                             <span>Comprometimento de Provisões</span>
                             <span className="text-slate-800">{fmt(dashStats.totalProvisions)}</span>
                           </div>
                           <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                             <div 
                               className="bg-emerald-500 h-full transition-all duration-1000" 
                               style={{ width: '75%' }}
                             ></div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'employees' && (
                <motion.div 
                  key="employees"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
                    <div className="relative w-full sm:w-80">
                      <input 
                        type="text" 
                        placeholder="Pesquisar por nome..." 
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all font-medium"
                      />
                      <Users className="absolute left-3.5 top-3 text-slate-400" size={18} />
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {!isDriveAuthed ? (
                        <button 
                          onClick={handleDriveAuth}
                          className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <Cloud size={18} />
                          Conectar Drive
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={handleLoadFromDrive}
                            disabled={isLoadingDrive}
                            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                          >
                            <DownloadCloud size={18} />
                            {isLoadingDrive ? 'Carregando...' : 'Carregar'}
                          </button>
                          <button 
                            onClick={handleSaveToDrive}
                            disabled={isSaving}
                            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                          >
                            <Save size={18} />
                            {isSaving ? 'Salvando...' : 'Salvar'}
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                      >
                        <Plus size={18} />
                        Novo Funcionário
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {employees.map((emp) => (
                      <div key={emp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:border-blue-200 transition-all">
                        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl border border-slate-200 shadow-inner">
                              {emp.name.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-lg">{emp.name}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Salário: {fmt(emp.salaryBase)}</p>
                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{emp.dependents} dependentes</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100">
                              Operacional
                            </div>
                            {emp.useVT && (
                              <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100">
                                VT Ativo
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                setEventsModal({ isOpen: true, employeeId: emp.id });
                              }}
                              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                            >
                              <ListPlus size={16} />
                              Eventos
                            </button>
                            <button 
                              onClick={() => {
                                const payroll = payrolls.find(p=>p.employeeId === emp.id);
                                if (payroll) exportPayrollToPDF(payroll);
                                else alert('Folha não encontrada');
                              }}
                              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                            >
                              <Download size={16} />
                              Holerite
                            </button>
                            <button 
                              onClick={() => {
                                const payroll = payrolls.find(p=>p.employeeId === emp.id);
                                if (payroll) sendWhatsApp(payroll);
                                else alert('Folha não encontrada');
                              }}
                              className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Enviar via WhatsApp"
                            >
                              <Send size={18} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ isOpen: true, employeeId: emp.id, name: emp.name });
                              }}
                              className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"
                              title="Excluir Colaborador"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'fiscal' && (
                <motion.div 
                  key="fiscal"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden"
                >
                  <div className="bg-slate-900 p-8 text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 border-2 border-blue-400/20 shadow-xl">
                       <Receipt size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1">Apuração de DAS</h3>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Simples Nacional • Anexo III</p>
                  </div>

                  <div className="p-10 space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Receita Bruta Mensal</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-slate-400 font-bold">R$</span>
                          <input 
                            type="number" 
                            value={fiscalData.monthlyRevenue}
                            onChange={(e) => setFiscalData(prev => ({ ...prev, monthlyRevenue: Number(e.target.value) }))}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none text-xl font-black text-slate-800 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">RBT12 (Acumulado 12 Meses)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-slate-400 font-bold">R$</span>
                          <input 
                            type="number" 
                            value={fiscalData.rbt12}
                            onChange={(e) => setFiscalData(prev => ({ ...prev, rbt12: Number(e.target.value) }))}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none text-xl font-black text-slate-800 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-600 font-bold uppercase tracking-widest">Alíquota Efetiva</span>
                        <span className="font-black text-blue-700 text-lg">{dashStats.effectiveRate.toFixed(2)}%</span>
                      </div>
                      <div className="h-[1px] bg-blue-200/50 w-full"></div>
                      <div className="flex justify-between items-end">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Valor Total do DAS</span>
                        <span className="text-4xl font-black text-slate-900 leading-none">{fmt(dashStats.dasValue)}</span>
                      </div>
                    </div>

                    <button className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3">
                      <FileText size={20} />
                      TRANSMITIR PGDAS-D
                    </button>
                    
                    <p className="text-center text-[10px] text-slate-400 italic">O cálculo utiliza a fórmula oficial do Simples Nacional (RBT12 * Alíquota - Dedução) / RBT12.</p>
                  </div>
                </motion.div>
              )}

               {activeTab === 'reports' && (
                <motion.div 
                  key="reports"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                  <ReportCard 
                    title="Folha Consolidada" 
                    desc="Detalhamento analítico de proventos, descontos e custos patronais totais."
                    icon={<Calculator size={28} className="text-blue-600" />}
                    onExportPDF={exportConsolidatedPayrollPDF}
                    onExportExcel={exportExcel}
                  />
                  <ReportCard 
                    title="Provisões Trabalhistas" 
                    desc="Acompanhamento mensal da reserva financeira para 13º salário e férias."
                    icon={<TrendingUp size={28} className="text-emerald-600" />}
                    onExportPDF={exportProvisionsPDF}
                    onExportExcel={exportExcel}
                  />
                  <ReportCard 
                    title="Memória de Cálculo DAS" 
                    desc="Log detalhado da apuração tributária para conferência contábil."
                    icon={<Receipt size={28} className="text-slate-700" />}
                    onExportPDF={exportFiscalMemoryPDF}
                    onExportExcel={exportExcel}
                  />
                  <ReportCard 
                    title="Dossiê de Funcionários" 
                    desc="Relatório cadastral com históricos salariais e dados protegidos."
                    icon={<Users size={28} className="text-purple-600" />}
                    onExportPDF={exportConsolidatedPayrollPDF}
                    onExportExcel={exportExcel}
                  />
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-6 group hover:border-green-200 transition-all">
                    <div className="flex items-start gap-5">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-green-50 transition-colors">
                        <MessageCircle size={28} className="text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg leading-tight">Checklist de Serviços</h4>
                        <p className="text-sm text-slate-500 leading-relaxed mt-2">Enviar via WhatsApp um resumo dos serviços realizados e entregues.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-auto">
                      <button 
                        onClick={() => setIsChecklistModalOpen(true)}
                        className="flex-1 bg-green-600 text-white text-xs font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-green-700 transition-all"
                      >
                        Gerar & Enviar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

               {activeTab === 'settings' && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="max-w-3xl mx-auto space-y-8"
                >
                  <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                      <Building2 className="text-blue-600" />
                      Gestão de Empresas
                    </h2>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nome da Empresa</label>
                          <input 
                            type="text" 
                            value={currentCompany.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setCompanies(prev => prev.map(c => c.id === selectedCompanyId ? { ...c, name: newName } : c));
                            }}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                            placeholder="Nome Empresarial"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">CNPJ</label>
                          <input 
                            type="text" 
                            value={currentCompany.cnpj}
                            onChange={(e) => {
                              const newCnpj = e.target.value;
                              setCompanies(prev => prev.map(c => c.id === selectedCompanyId ? { ...c, cnpj: newCnpj } : c));
                            }}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all font-mono"
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100">
                        <button 
                          onClick={() => {
                            const id = Math.random().toString(36).substr(2, 9);
                            const newCompany = { id, name: "Nova Empresa Ltda", cnpj: "00.000.000/0001-00" };
                            setCompanies(prev => [...prev, newCompany]);
                            setSelectedCompanyId(id);
                          }}
                          className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors"
                        >
                          <Plus size={18} />
                          Inserir Nova Empresa
                        </button>
                      </div>

                      {companies.length > 1 && (
                        <div className="pt-6 space-y-4">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Alternar Empresa Ativa</label>
                          <div className="grid grid-cols-1 gap-2">
                            {companies.map(c => (
                              <button 
                                key={c.id}
                                onClick={() => setSelectedCompanyId(c.id)}
                                className={cn(
                                  "w-full px-4 py-3.5 rounded-xl border flex items-center justify-between transition-all font-bold text-sm",
                                  selectedCompanyId === c.id 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                )}
                              >
                                {c.name}
                                {selectedCompanyId === c.id && <ChevronRight size={16} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-8 text-white">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-blue-500/20 rounded-2xl">
                        <Building2 size={24} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Suporte ao Arquiteto Contábil</h4>
                        <p className="text-slate-400 text-sm">Configurações de ambiente e governança fiscal.</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Esta área permite a gestão centralizada de múltiplas empresas (Holding ou Escritório). 
                      Todas as guias DAS e Holerites gerados utilizarão os dados da empresa ativa selecionada acima.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <footer className="h-12 bg-white border-t border-slate-200 flex items-center justify-center px-8 shrink-0">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            Cálculos baseados na legislação vigente (CLT 2024 / Simples Nacional Anexo III) • Dados protegidos LGPD
          </p>
        </footer>
      </main>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto border border-red-100">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Excluir Colaborador?</h3>
              <p className="text-slate-500 text-center leading-relaxed mb-8">
                Tem certeza que deseja excluir o colaborador <span className="font-bold text-slate-800">{deleteConfirm.name}</span>? Esta ação não pode ser desfeita.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-3.5 border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    setEmployees(prev => prev.filter(e => e.id !== deleteConfirm.employeeId));
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 px-6 py-3.5 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 border border-slate-100"
            >
              <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <Users className="text-blue-600" />
                Novo Colaborador
              </h3>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                    placeholder="João Silva..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">CPF</label>
                    <input 
                      type="text" 
                      value={newEmployee.cpf}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, cpf: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">CBO</label>
                    <input 
                      type="text" 
                      value={newEmployee.cbo}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, cbo: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                      placeholder="Ex: 4110-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Função (Cargo)</label>
                  <input 
                    type="text" 
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                    placeholder="Ex: Auxiliar Administrativo"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Salário Base (R$)</label>
                    <input 
                      type="number" 
                      value={newEmployee.salaryBase}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, salaryBase: Number(e.target.value) }))}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Dependentes</label>
                    <input 
                      type="number" 
                      value={newEmployee.dependents}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, dependents: Number(e.target.value) }))}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <input 
                    type="checkbox" 
                    id="useVT"
                    checked={newEmployee.useVT}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, useVT: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="useVT" className="text-sm font-bold text-slate-700 cursor-pointer uppercase tracking-tight">
                    Optante por Vale Transporte (VT)
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddEmployee}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  Salvar Cadastro
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Events Modal */}
      <AnimatePresence>
        {eventsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEventsModal({ isOpen: false, employeeId: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 border border-slate-100"
            >
              <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <ListPlus className="text-blue-600" />
                Lançar Eventos
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nome do Evento</label>
                    <input 
                      type="text" 
                      value={newEvent.name}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                      placeholder="Ex: Hora Extra"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Valor (R$)</label>
                    <input 
                      type="number" 
                      value={newEvent.value}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, value: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="evt_type" checked={newEvent.type === 'provento'} onChange={() => setNewEvent(p => ({...p, type: 'provento'}))} className="text-blue-600 focus:ring-blue-500"/>
                    <span className="text-sm font-bold text-slate-700">Provento</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="evt_type" checked={newEvent.type === 'desconto'} onChange={() => setNewEvent(p => ({...p, type: 'desconto'}))} className="text-red-600 focus:ring-red-500"/>
                    <span className="text-sm font-bold text-slate-700">Desconto</span>
                  </label>
                </div>
                
                <button 
                  onClick={handleAddEvent}
                  className="w-full px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  Adicionar Evento
                </button>

                <div className="mt-6 border-t border-slate-100 pt-4 max-h-[150px] overflow-y-auto">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Lançamentos Atuais</p>
                  {employees.find(e => e.id === eventsModal.employeeId)?.events?.map(ev => (
                    <div key={ev.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl mb-2 border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{ev.name}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${ev.type === 'provento' ? 'text-blue-600' : 'text-red-600'}`}>
                          {ev.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-700">{fmt(ev.value)}</span>
                        <button onClick={() => handleRemoveEvent(eventsModal.employeeId!, ev.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!employees.find(e => e.id === eventsModal.employeeId)?.events || employees.find(e => e.id === eventsModal.employeeId)?.events?.length === 0) && (
                    <p className="text-sm text-slate-400 text-center py-2">Nenhum evento lançado para este colaborador.</p>
                  )}
                </div>
              </div>
              
              <div className="flex mt-6">
                <button 
                  onClick={() => setEventsModal({ isOpen: false, employeeId: null })}
                  className="w-full px-6 py-4 border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isChecklistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsChecklistModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">Checklist de Serviços</h3>
                  <p className="text-sm text-slate-500 font-medium">Preencha e envie via WhatsApp</p>
                </div>
                <button onClick={() => setIsChecklistModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nome do Cliente</label>
                  <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-300 outline-none font-bold text-slate-800 transition-all"
                    placeholder="Ex: Família Silva"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">WhatsApp (com DDD)</label>
                  <input 
                    type="text" 
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-300 outline-none font-bold text-slate-800 transition-all"
                    placeholder="Ex: 11999999999"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 block mb-3">Serviços Realizados</label>
                  <div className="space-y-2">
                    {checklistItems.map(item => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => {
                          setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i));
                        }}
                      >
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center border", item.done ? "bg-green-500 border-green-500 text-white" : "bg-white border-slate-300")}>
                          {item.done && <CheckSquare size={16} />}
                        </div>
                        <span className={cn("font-medium", item.done ? "text-slate-900" : "text-slate-500")}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setIsChecklistModalOpen(false)}
                    className="px-6 py-4 border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSendWhatsApp}
                    className="flex-1 px-6 py-4 bg-[#25D366] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#1da851] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                  >
                    <MessageCircle size={18} />
                    Enviar WhatsApp
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Re-styling Components to match Sleek Theme ---

function NavItem({ active, onClick, icon, label, collapsed }: { active: boolean, onClick: () => void, icon: any, label: string, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : ""}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full",
        active 
          ? "bg-blue-50 text-blue-700 active-shadow" 
          : "text-slate-600 hover:bg-slate-50",
        collapsed && "justify-center px-0"
      )}
    >
      <span className={active ? "text-blue-700" : "text-slate-400"}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon, highlight }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3 text-slate-400">
        <p className="text-[10px] font-black uppercase tracking-widest">{title}</p>
        <div className="p-1.5 bg-slate-50 rounded-lg">{icon}</div>
      </div>
      <h3 className={cn("text-2xl font-bold tracking-tight", highlight || "text-slate-900")}>
        {value}
      </h3>
      <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-tight">{subtitle}</p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm font-semibold text-slate-700"
    >
      <span className="text-blue-500">{icon}</span>
      {label}
    </button>
  );
}

function ReportCard({ title, desc, icon, onExportPDF, onExportExcel }: any) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-6 group hover:border-blue-200 transition-all">
      <div className="flex items-start gap-5">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-blue-50 transition-colors">{icon}</div>
        <div>
          <h4 className="font-bold text-slate-900 text-lg leading-tight">{title}</h4>
          <p className="text-sm text-slate-500 leading-relaxed mt-2">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-auto">
        <button onClick={onExportPDF} className="flex-1 bg-slate-900 text-white text-xs font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-800 transition-all">
          Gerar PDF
        </button>
        <button onClick={onExportExcel} className="flex-1 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-50 transition-all">
          Excel
        </button>
      </div>
    </div>
  );
}


