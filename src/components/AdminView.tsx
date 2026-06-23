/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Usuario, Perfil, UserStatus, SystemSettings, AuditoriaLog, Obra, Empresa, Feriado, Reserva, ReservaStatus } from '../types';
import { Users, UserCheck, ShieldAlert, Sliders, FileText, Search, Settings, Save, Trash2, CheckCircle, Ban, Building2, Plus, Edit, Briefcase, X, Check, ExternalLink, Calendar, FileSpreadsheet, Smile, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';

interface AdminViewProps {
  usuarios: Usuario[];
  onApproveUser: (
    id: string, 
    status: UserStatus,
    extraData?: { matricula: string; idEmpresa: string; idObraPadrao: string; perfil: Perfil; idObrasFornecedor?: string[]; fotoBiometria?: string }
  ) => void;
  onToggleUserActive: (id: string) => void;
  onDeleteUser?: (id: string) => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  logs: AuditoriaLog[];
  obras: Obra[];
  empresas: Empresa[];
  onSaveObra: (updatedObra: Obra) => void;
  onSaveUser: (updatedUser: Usuario) => void;
  onSaveEmpresa: (updatedEmpresa: Empresa, originalId?: string) => void;
  feriados: Feriado[];
  onSaveFeriado: (updatedFeriado: Feriado) => void;
  onDeleteFeriado: (id: string) => void;
  onClearAllReservas: (mode: 'all' | 'future') => void;
  reservas?: Reserva[];
  onAddReserva?: (res: Reserva) => void;
  onDeleteReserva?: (id: string) => void;
}

export default function AdminView({
  usuarios,
  onApproveUser,
  onToggleUserActive,
  onDeleteUser,
  settings,
  onSaveSettings,
  logs,
  obras,
  empresas,
  onSaveObra,
  onSaveUser,
  onSaveEmpresa,
  feriados,
  onSaveFeriado,
  onDeleteFeriado,
  onClearAllReservas,
  reservas = [],
  onAddReserva,
  onDeleteReserva,
}: AdminViewProps) {
  
  // Tab navigation within Admin view
  const [activeTab, setActiveTab] = useState<'approvals' | 'users' | 'launches' | 'settings' | 'logs' | 'obras' | 'empresas' | 'feriados'>('approvals');
  
  // Mouse drag horizontal scroll helper for tables (especially helpful on desktop without native touch)
  const dragRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('a') || target.closest('label')) {
      return;
    }
    isDown.current = true;
    dragRef.current.classList.add('cursor-grabbing');
    dragRef.current.classList.remove('cursor-grab');
    startX.current = e.pageX - dragRef.current.offsetLeft;
    scrollLeft.current = dragRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    if (dragRef.current) {
      dragRef.current.classList.remove('cursor-grabbing');
      dragRef.current.classList.add('cursor-grab');
    }
  };

  const handleMouseUp = () => {
    isDown.current = false;
    if (dragRef.current) {
      dragRef.current.classList.remove('cursor-grabbing');
      dragRef.current.classList.add('cursor-grab');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !dragRef.current) return;
    e.preventDefault();
    const x = e.pageX - dragRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    dragRef.current.scrollLeft = scrollLeft.current - walk;
  };
  
  // Search state
  const [userSearch, setUserSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');

  // Obra creation/editing local states
  const [editingObraId, setEditingObraId] = useState<string | null>(null);
  const [obraForm, setObraForm] = useState<Partial<Obra>>({
    id: '',
    nome: '',
    centroCusto: '',
    ativa: true,
    valorRefeicao: settings.valorRefeicaoPropria,
    valorDescontoColaborador: 0,
    idFornecedorPrincipal: ''
  });
  const [isAddingObra, setIsAddingObra] = useState(false);

  // User (Colaborador) editing local state
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  // Cardápio Monthly PDF upload states
  const [cardapioObraId, setCardapioObraId] = useState('');
  const [dragOverCardapio, setDragOverCardapio] = useState(false);
  const [tempPdfContent, setTempPdfContent] = useState('');
  const [tempPdfName, setTempPdfName] = useState('');
  const [tempPdfSize, setTempPdfSize] = useState<number | null>(null);

  // Empresa local state
  const [editingEmpresaId, setEditingEmpresaId] = useState<string | null>(null);
  const [isAddingEmpresa, setIsAddingEmpresa] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<Partial<Empresa>>({
    id: '',
    nome: '',
    tipo: 'Propria'
  });

  // Holiday creation/editing local states
  const [editingFeriadoId, setEditingFeriadoId] = useState<string | null>(null);
  const [isAddingFeriado, setIsAddingFeriado] = useState(false);
  const [feriadoForm, setFeriadoForm] = useState<Partial<Feriado>>({
    id: '',
    data: '2026-06-13',
    descricao: '',
    tipo: 'municipal',
    abrangencia: 'nacional',
    idObras: []
  });

  const [deletingFeriadoId, setDeletingFeriadoId] = useState<string | null>(null);
  const [deletingMenuObraId, setDeletingMenuObraId] = useState<string | null>(null);
  const [showResetReservasModal, setShowResetReservasModal] = useState(false);

  // States for Launching Admin/HR Extra & Colab Bookings
  const [launchUserSelectId, setLaunchUserSelectId] = useState('');
  const [launchUserDate, setLaunchUserDate] = useState('2026-06-20');
  const [launchUserObraId, setLaunchUserObraId] = useState('');
  
  const [launchVisitorName, setLaunchVisitorName] = useState('');
  const [launchVisitorDate, setLaunchVisitorDate] = useState('2026-06-20');
  const [launchVisitorObraId, setLaunchVisitorObraId] = useState('');
  
  const [launchTableFilterDate, setLaunchTableFilterDate] = useState('2026-06-20');

  // Local state to hold HR registration forms for each pending approval
  const [approvalForms, setApprovalForms] = useState<Record<string, { matricula: string; idEmpresa: string; idObraPadrao: string; perfil: Perfil; idObrasFornecedor?: string[]; fotoBiometria?: string }>>({});

  const [userToConfirmDelete, setUserToConfirmDelete] = useState<Usuario | null>(null);

  const [activeCaptureTarget, setActiveCaptureTarget] = useState<{
    id: string;
    type: 'pending' | 'editing';
  } | null>(null);

  const getFormValue = (userId: string) => {
    return approvalForms[userId] || {
      matricula: '',
      idEmpresa: empresas[0]?.id || '',
      idObraPadrao: obras[0]?.id || '',
      perfil: Perfil.Colaborador,
      idObrasFornecedor: [],
      fotoBiometria: '',
      senha: '1234@',
      requerTrocaSenha: true
    };
  };

  const updateFormValue = (userId: string, key: string, value: any) => {
    setApprovalForms(prev => ({
      ...prev,
      [userId]: {
        ...getFormValue(userId),
        [key]: value
      }
    }));
  };

  // Settings local state
  const [horioLimiteLocal, setHorarioLimiteLocal] = useState(settings.horarioLimite);
  const [permitirFdsLocal, setPermitirFdsLocal] = useState(settings.permitirFinsDeSemana);
  const [precoPropriaLocal, setPrecoPropriaLocal] = useState(settings.valorRefeicaoPropria);
  const [precoTerceirosLocal, setPrecoTerceirosLocal] = useState(settings.valorRefeicaoTerceiro);
  const [usarTabletLocal, setUsarTabletLocal] = useState(settings.usarTabletRetirada);
  const [requererBiometriaLocal, setRequererBiometriaLocal] = useState(settings.requererBiometriaFacial);
  const [permitirSimuladorLocal, setPermitirSimuladorLocal] = useState(settings.permitirSimulador ?? true);
  const [isSavedMsg, setIsSavedMsg] = useState(false);

  const getObra = (id: string) => obras.find(o => o.id === id);
  const getEmpresa = (id: string) => empresas.find(e => e.id === id);

  const pendingUsers = usuarios.filter(u => u.status === UserStatus.Pendente);
  const regularUsers = usuarios.filter(u => u.status !== UserStatus.Pendente);

  const filteredUsers = regularUsers.filter(u => 
    u.nome.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.cpf || '').toLowerCase().includes(userSearch.toLowerCase()) || 
    u.matricula.toLowerCase().includes(userSearch.toLowerCase())
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const exportUsersToCSV = () => {
    // BOM for Excel compatibility with Portuguese Special characters
    const BOM = '\uFEFF';
    let csvContent = "Matrícula;Nome;CPF;E-mail;Perfil;Empresa;Obra Padrão;Status\n";
    
    // Sort all regular (active + inactive, non-pending) users alphabetically by name
    const sortedUsers = [...regularUsers].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    
    sortedUsers.forEach(u => {
      const emp = getEmpresa(u.idEmpresa);
      const obr = getObra(u.idObraPadrao);
      const perfilNome = u.perfil === Perfil.Colaborador ? 'Colaborador' :
                         u.perfil === Perfil.Gestor ? 'Gestor' :
                         u.perfil === Perfil.Admin ? 'RH Administrativo' :
                         u.perfil === Perfil.Fornecedor ? 'Fornecedor' : u.perfil;
      const empresaNome = emp ? emp.nome : 'FONTANA';
      const obraNome = u.perfil === Perfil.Fornecedor 
        ? (u.idObrasFornecedor && u.idObrasFornecedor.length > 0 
            ? u.idObrasFornecedor.map(id => getObra(id)?.nome || id).join(', ')
            : 'Nenhuma')
        : (obr ? obr.nome : 'Nenhum');
      const statusText = u.status === UserStatus.Desativado ? 'DESATIVADO' : 'ATIVO';
      
      csvContent += `"${u.matricula || ''}";"${u.nome}";"${u.cpf || ''}";"${u.email || ''}";"${perfilNome}";"${empresaNome}";"${obraNome}";"${statusText}"\n`;
    });
    
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SGR-Relatorio-Colaboradores.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(l => 
    l.usuarioNome.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.operacao.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.dispositivo.toLowerCase().includes(logSearch.toLowerCase())
  ).slice(0, 100); // Top 100 logs

  const handleSaveSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      horarioLimite: horioLimiteLocal,
      permitirFinsDeSemana: permitirFdsLocal,
      valorRefeicaoPropria: Number(precoPropriaLocal),
      valorRefeicaoTerceiro: Number(precoTerceirosLocal),
      usarTabletRetirada: usarTabletLocal,
      requererBiometriaFacial: requererBiometriaLocal,
      permitirSimulador: permitirSimuladorLocal,
    });
    setIsSavedMsg(true);
    setTimeout(() => setIsSavedMsg(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden" id="admin-view-panel">
      {/* Tab Navigation header bar */}
      <div className="bg-neutral-50 border-b border-neutral-200 flex flex-wrap gap-1 p-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'approvals'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-approvals"
        >
          <UserCheck className="h-4 w-4" /> 
          Cadastros Pendentes
          {pendingUsers.length > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white font-mono font-bold text-[9px] rounded-full scale-105">
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-users"
        >
          <Users className="h-4 w-4" /> 
          Gerenciar Colaboradores
        </button>

        <button
          onClick={() => setActiveTab('launches')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'launches'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-launches"
        >
          <Plus className="h-4 w-4 text-emerald-400" /> 
          Pedidos Extras e Lançamentos
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-settings"
        >
          <Settings className="h-4 w-4" /> 
          Parâmetros do Sistema
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-logs"
        >
          <Sliders className="h-4 w-4" /> 
          Logs de Auditoria
        </button>

        <button
          onClick={() => setActiveTab('obras')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'obras'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-obras"
        >
          <Building2 className="h-4 w-4" /> 
          Configurar Áreas / Obras
        </button>

        <button
          onClick={() => setActiveTab('empresas')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'empresas'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-empresas"
        >
          <Briefcase className="h-4 w-4" /> 
          Gerenciar Empresas
        </button>

        <button
          onClick={() => setActiveTab('feriados')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'feriados'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
          }`}
          id="admin-tab-feriados"
        >
          <Calendar className="h-4 w-4" /> 
          Gerenciar Feriados / Obras
        </button>
      </div>

      <div className="p-6">
        {/* Approvals tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-4" id="approvals-tab-content">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Aprovação de Novos Integrantes</h3>
                <p className="text-xs text-neutral-500">
                  Cadastros solicitados por colaboradores passam pela triagem do RH para preenchimento obrigatório e homologação dos parâmetros de faturamento e acesso.
                </p>
              </div>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-neutral-200 rounded-xl space-y-2">
                <p className="text-sm text-neutral-600 font-semibold">Tudo em dia! ✨</p>
                <p className="text-xs text-neutral-400">Nenhum cadastro pendente aguardando a análise do RH.</p>
                <p className="text-[10px] text-emerald-600 font-medium pt-2">Dica: Novos cadastros realizados por colaboradores externos aparecem aqui instantaneamente após o envio do formulário de adesão.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingUsers.map((u) => {
                  const formVal = getFormValue(u.id);
                  return (
                    <div 
                      key={u.id} 
                      className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden"
                      id={`pending-card-${u.id}`}
                    >
                      {/* Card Header for Collaborator Details */}
                      <div className="bg-neutral-50 p-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase tracking-wider">
                            Pendente Homologação RH
                          </span>
                          <h4 className="text-sm font-bold text-neutral-800 mt-1">{u.nome}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {u.cpf && (
                              <span className="text-neutral-600 font-mono text-xs font-bold bg-neutral-200/80 px-1.5 py-0.5 rounded">
                                CPF: {u.cpf.slice(0,3)}.{u.cpf.slice(3,6)}.{u.cpf.slice(6,9)}-{u.cpf.slice(9)}
                              </span>
                            )}
                            {u.email && <span className="text-neutral-500 text-xs">{u.email}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 font-mono block">
                            Solicitado em: {new Date(u.criadoEm).toLocaleDateString('pt-BR')} às {new Date(u.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Card Body - Registration, Company, Sector/Area & Profile dropdowns */}
                      <div className="p-5 bg-white space-y-4">
                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/80 mb-2">
                          <p className="text-[11px] text-emerald-800 leading-relaxed font-semibold">
                            📋 Preencha abaixo o número de cadastro/matrícula, a empresa, e o setor (obra) correspondente para autorizar o acesso do usuário.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {/* 1. Matricula / Cadastro */}
                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-tight mb-1">
                              Cadastro / Matrícula (RH) *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ex. F-903 ou T-22"
                              value={formVal.matricula}
                              onChange={(e) => updateFormValue(u.id, 'matricula', e.target.value)}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                              id={`approve-matricula-${u.id}`}
                            />
                            <span className="text-[9px] text-neutral-400 block mt-0.5">Identificador corporativo.</span>
                          </div>

                          {/* 2. Empresa */}
                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-tight mb-1">
                              Empresa Vinculada *
                            </label>
                            <select
                              required
                              value={formVal.idEmpresa}
                              onChange={(e) => updateFormValue(u.id, 'idEmpresa', e.target.value)}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                              id={`approve-empresa-${u.id}`}
                            >
                              <option value="">Selecione a Empresa...</option>
                              {empresas.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.nome} ({emp.tipo})
                                </option>
                              ))}
                            </select>
                            <span className="text-[9px] text-neutral-400 block mt-0.5">Faturamento / Custos.</span>
                          </div>

                          {/* 3. Setor / Area (Obra) */}
                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-tight mb-1">
                              Setor / Área (Obra) *
                            </label>
                            <select
                              required
                              value={formVal.idObraPadrao}
                              onChange={(e) => updateFormValue(u.id, 'idObraPadrao', e.target.value)}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                              id={`approve-obra-${u.id}`}
                            >
                              <option value="">Selecione a Área/Obra...</option>
                              {obras.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.nome} ({o.centroCusto})
                                </option>
                              ))}
                            </select>
                            <span className="text-[9px] text-neutral-400 block mt-0.5">Local físico de atuação.</span>
                          </div>

                          {/* 4. Perfil */}
                          <div>
                            <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-tight mb-1">
                              Perfil de Acesso *
                            </label>
                            <select
                              required
                              value={formVal.perfil}
                              onChange={(e) => updateFormValue(u.id, 'perfil', e.target.value as Perfil)}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                              id={`approve-perfil-${u.id}`}
                            >
                              <option value={Perfil.Colaborador}>Colaborador (Reserva refeições)</option>
                              <option value={Perfil.Gestor}>Gestor / Engenheiro de Obra</option>
                              <option value={Perfil.Admin}>RH / Administrador de Custos</option>
                              <option value={Perfil.Fornecedor}>Fornecedor (Cozinha Externa)</option>
                            </select>
                            <span className="text-[9px] text-neutral-400 block mt-0.5">Permissões de telas (RBAC).</span>
                          </div>
                        </div>

                        {/* Credenciais de Acesso Provisórias (Proved by RH) */}
                        <div className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-lg mt-2 text-left" id={`approve-credentials-box-${u.id}`}>
                          <span className="block text-xs font-black uppercase tracking-wide text-neutral-800 flex items-center gap-1.5 font-mono">
                            🔑 Credenciais e Senha de Primeiro Acesso
                          </span>
                          <span className="text-[11px] text-neutral-500 block leading-tight mt-0.5">
                            Configure a senha provisória de acesso do colaborador. Ao fazer o primeiro login, ele será obrigado a cadastrar uma nova senha pessoal definitiva.
                          </span>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-2 border-t border-neutral-150">
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-tight mb-1">
                                Senha Provisória de Entrada *
                              </label>
                              <input
                                type="text"
                                required
                                value={formVal.senha || ''}
                                onChange={(e) => updateFormValue(u.id, 'senha', e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                                placeholder="Defina a senha temporária"
                              />
                              <span className="text-[9px] text-neutral-405 block mt-0.5">RH precisará passar esta senha verbalmente ou por Whatsapp.</span>
                            </div>

                            <div className="flex items-center font-sans">
                              <label className="inline-flex items-center gap-2 cursor-pointer mt-2 md:mt-4">
                                <input
                                  type="checkbox"
                                  checked={!!formVal.requerTrocaSenha}
                                  onChange={(e) => updateFormValue(u.id, 'requerTrocaSenha', e.target.checked)}
                                  className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                                />
                                <div className="select-none text-left">
                                  <span className="font-bold text-xs text-neutral-800 block">Exigir alteração de senha no primeiro acesso</span>
                                  <span className="text-[9px] text-neutral-400 block">Bloqueia o terminal até que o integrante defina um código pessoal seguro.</span>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Obras autorizadas para o Fornecedor (Cozinha Externa) */}
                        {formVal.perfil === Perfil.Fornecedor && (
                          <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-lg space-y-2 mt-3 animate-[fadeIn_0.2s_ease]" id={`approve-fornecedor-obras-${u.id}`}>
                            <span className="block text-xs font-bold text-amber-850 uppercase tracking-wider font-mono">
                              🔒 Áreas/Obras do Fornecedor:
                            </span>
                            <p className="text-[11px] text-neutral-600 leading-normal">
                              Marque abaixo as obras que este fornecedor atende. Ele só terá acesso seguro aos totais diários/mensais destas respectivas obras.
                            </p>
                            <div className="flex flex-wrap gap-4 pt-1">
                              {obras.map(o => {
                                const listStr = formVal.idObrasFornecedor || [];
                                const isChecked = listStr.includes(o.id);
                                return (
                                  <label key={o.id} className="inline-flex items-center gap-2 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const prev = formVal.idObrasFornecedor || [];
                                        const next = e.target.checked 
                                          ? [...prev, o.id]
                                          : prev.filter(id => id !== o.id);
                                        updateFormValue(u.id, 'idObrasFornecedor', next);
                                      }}
                                      className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                                    />
                                    <div>
                                      <span className="font-bold text-neutral-800 block">{o.nome}</span>
                                      <span className="text-[9px] text-neutral-400 block font-mono">{o.centroCusto}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            {(formVal.idObrasFornecedor || []).length === 0 && (
                              <p className="text-[10px] text-red-500 font-bold">⚠️ Atenção: Nenhuma obra selecionada. O fornecedor não conseguirá visualizar dados.</p>
                            )}
                          </div>
                        )}

                        {/* 5. Biometria Facial - PRÉ-CADASTRO OBRIGATÓRIO NO RH */}
                        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 mt-2">
                          <span className="block text-xs font-black uppercase tracking-wide text-neutral-800 flex items-center gap-1.5 font-mono">
                            📸 Pré-Cadastro de Biometria Facial (Obrigatoriedade Proativa)
                          </span>
                          <span className="text-[11px] text-neutral-500 block leading-tight mt-0.5">
                            O leitor facial do refeitório exige o mapeamento fotográfico prévio realizado pelo RH. Sem este cadastro, o colaborador não conseguirá registrar refeições na câmera terminal.
                          </span>

                          <div className="flex flex-col sm:flex-row items-center gap-4 mt-3 bg-white p-3 rounded-md border border-neutral-200">
                            {formVal.fotoBiometria ? (
                              <div className="relative w-16 h-16 rounded-full border-2 border-emerald-500 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                                <img 
                                  src={formVal.fotoBiometria} 
                                  alt="Face registered" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-[10px] text-white font-bold" title="Biometria Confirmada">
                                  ✓
                                </span>
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-full border-2 border-dashed border-rose-300 bg-rose-50 flex flex-col items-center justify-center shrink-0">
                                <Smile className="w-6 h-6 text-rose-500 animate-pulse" />
                                <span className="text-[8px] text-rose-600 font-black mt-1">SEM FOTO</span>
                              </div>
                            )}

                            <div className="flex-1 text-center sm:text-left">
                              <span className="font-bold text-xs block text-neutral-800">
                                {formVal.fotoBiometria 
                                  ? "Mapeamento Biométrico Pronto" 
                                  : "Aguardando Captura de Rosto no RH"
                                }
                              </span>
                              <span className="text-[10px] text-neutral-400 block mt-0.5">
                                {formVal.fotoBiometria 
                                  ? "A foto e assinatura facial foram vinculadas com sucesso à matrícula." 
                                  : "O colaborador deve se registrar proativamente. Clique ao lado para simular a câmera e registrar a biometria dele."
                                }
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveCaptureTarget({ id: u.id, type: 'pending' });
                              }}
                              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-400" /> 
                              {formVal.fotoBiometria ? "Refazer Captura Câmera" : "Capturar Foto Real Câmera"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="bg-neutral-50 px-5 py-3 border-t border-neutral-200 flex justify-end gap-3">
                        <button
                          onClick={() => onApproveUser(u.id, UserStatus.Desativado)}
                          className="px-4 py-2 border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg font-bold text-xs transition flex items-center gap-1.5"
                          id={`reject-btn-${u.id}`}
                        >
                          <Ban className="h-4 w-4" /> Negar Solicitação
                        </button>
                        <button
                          onClick={() => {
                            if (!formVal.matricula.trim()) {
                              alert('Por favor, digite o número de Cadastro / Matrícula antes de aprovar.');
                              return;
                            }
                            if (!formVal.idEmpresa) {
                              alert('Por favor, selecione a Empresa Vinculada antes de aprovar.');
                              return;
                            }
                            if (!formVal.idObraPadrao) {
                              alert('Por favor, selecione o Setor / Área (Obra) antes de aprovar.');
                              return;
                            }
                            onApproveUser(u.id, UserStatus.Aprovado, formVal);
                          }}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition shadow-md flex items-center gap-1.5"
                          id={`approve-btn-${u.id}`}
                        >
                          <CheckCircle className="h-4 w-4" /> Salvar Cadastro e Aprovar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Users list tab */}
        {activeTab === 'users' && (
          <div className="space-y-4" id="users-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Cadastro de Colaboradores e Prestadores</h3>
                <p className="text-xs text-neutral-500">Controles de desativação (colaboradores desligados ou em férias) e reativação.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingUser({
                    id: 'new-user-' + Math.random().toString(36).substr(2, 9),
                    nome: '',
                    cpf: '',
                    email: '',
                    senha: '123',
                    matricula: '',
                    perfil: Perfil.Colaborador,
                    status: UserStatus.Aprovado,
                    idEmpresa: empresas[0]?.id || '',
                    idObraPadrao: obras[0]?.id || '',
                    criadoEm: new Date().toISOString()
                  })}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-mono font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 border border-neutral-800"
                  id="add-user-direct-btn"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>Novo Colaborador</span>
                </button>

                <button
                  onClick={exportUsersToCSV}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  id="export-users-excel-btn"
                  title="Exportar colaboradores para Excel/CSV"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Exportar Excel</span>
                </button>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome, matríc..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 w-full sm:w-64 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    id="search-user-input"
                  />
                </div>
              </div>
            </div>

            <div className="text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 font-medium flex items-start gap-2">
              <span className="mt-0.5">💡</span>
              <p><strong>Dica de Navegação</strong>: Você pode <strong>clicar e arrastar a tabela com o mouse</strong> (ou deslizar o dedo na tela do celular) lateralmente de forma contínua para navegar e chegar aos botões de <strong>Desativar</strong> e <strong>Editar</strong> sem precisar descer até o fim da página.</p>
            </div>

            <div 
              ref={dragRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className="border border-neutral-200 rounded-xl overflow-x-auto shadow-xs cursor-grab select-none active:cursor-grabbing"
              title="Clique e arraste para os lados para rolar horizontalmente"
              id="users-draggable-table-wrapper"
            >
              <table className="w-full min-w-[750px] text-left text-xs bg-white">
                <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Nome / Registro</th>
                    <th className="p-3">Função / Perfil</th>
                    <th className="p-3">Empresa Vinculada</th>
                    <th className="p-3">Área / Obra</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {filteredUsers.map((u) => {
                    const emp = getEmpresa(u.idEmpresa);
                    const obr = getObra(u.idObraPadrao);
                    const isDesligado = u.status === UserStatus.Desativado;
                    return (
                      <tr key={u.id} className={`hover:bg-neutral-50 ${isDesligado ? 'bg-neutral-50/50 opacity-75' : ''}`}>
                        <td className="p-3">
                          <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                            {u.nome}
                            {u.fotoBiometria ? (
                              <span className="inline-flex items-center text-[9px] bg-emerald-50/80 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 font-black font-mono">
                                📸 BIO ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 font-black font-mono animate-pulse">
                                ⚠️ BIOMETRIA PENDENTE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {u.cpf ? `CPF: ${u.cpf.slice(0,3)}.${u.cpf.slice(3,6)}.${u.cpf.slice(6,9)}-${u.cpf.slice(9)}` : 'Sem CPF'} {u.email ? `| ${u.email}` : ''} | Mat: {u.matricula}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-[10px] capitalize font-semibold">
                            {u.perfil === Perfil.Colaborador && 'Colaborador'}
                            {u.perfil === Perfil.Gestor && 'Gestor'}
                            {u.perfil === Perfil.Admin && 'RH Administrativo'}
                            {u.perfil === Perfil.Fornecedor && (
                              <span className="text-amber-700 font-extrabold uppercase bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Fornecedor</span>
                            )}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            {emp ? emp.nome : 'FONTANA'}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.perfil === Perfil.Fornecedor ? (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-amber-800 uppercase bg-amber-50 px-1.5 py-0.5 rounded font-mono border border-amber-100">Cozinhas Atendidas:</span>
                              <div className="text-[10px] text-neutral-600 font-semibold max-w-[200px] leading-tight">
                                {u.idObrasFornecedor && u.idObrasFornecedor.length > 0 
                                  ? u.idObrasFornecedor.map(id => getObra(id)?.nome).join(', ')
                                  : '⚠️ Nenhuma obra associada'}
                              </div>
                            </div>
                          ) : (
                            <span className="font-medium text-neutral-700">{obr?.nome}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                            isDesligado 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {isDesligado ? 'DESATIVADO' : 'ATIVO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="px-2.5 py-1 text-[10px] font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 flex items-center gap-1 cursor-pointer"
                              id={`edit-user-btn-${u.id}`}
                            >
                              <Edit className="h-3 w-3" />
                              Editar
                            </button>
                            <button
                              onClick={() => onToggleUserActive(u.id)}
                              className={`px-3 py-1 rounded text-[10px] font-semibold transition ${
                                isDesligado
                                  ? 'bg-emerald-100 hover:bg-emerald-205 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 hover:bg-rose-205 text-rose-800 border border-rose-300'
                              }`}
                              id={`toggle-status-btn-${u.id}`}
                            >
                               {isDesligado ? 'Reativar' : 'Desativar'}
                            </button>
                            {onDeleteUser && (
                              <button
                                onClick={() => {
                                  setUserToConfirmDelete(u);
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded flex items-center gap-1 cursor-pointer transition-colors"
                                title="Excluir Usuário e Limpar Reservas"
                                id={`delete-user-btn-${u.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lançamentos e Pedidos Extras Tab */}
        {activeTab === 'launches' && (
          <div className="space-y-6 animate-fade-in" id="launches-tab-content">
            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-xl">
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-500" />
                Lançamentos e Pedidos Extras (RH)
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Utilize esta seção para agendar refeições diretamente para novos colaboradores ou lançar refeições corporativas / visitantes (isentas de desconto em folha e pagas integralmente pela empresa).
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Agendar para Colaborador */}
              <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs space-y-4">
                <div className="border-b border-neutral-100 pb-2">
                  <span className="font-bold text-xs text-neutral-800 block uppercase tracking-wide">👤 Agendar para Colaborador Cadastrado</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Utilize quando o funcionário possuir cadastro mas possui pendências (Ex: Primeiro dia, sem login). Possui desconto padrão habitual se houver.</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1 font-mono">Selecionar Colaborador</label>
                    <select
                      value={launchUserSelectId}
                      onChange={(e) => {
                        const uid = e.target.value;
                        setLaunchUserSelectId(uid);
                        const selU = usuarios.find(usr => usr.id === uid);
                        if (selU) {
                          setLaunchUserObraId(selU.idObraPadrao);
                        }
                      }}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- Selecione o Colaborador --</option>
                      {usuarios
                        .filter(u => u.status === UserStatus.Aprovado && u.perfil !== Perfil.Fornecedor)
                        .sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nome} (Mat: {u.matricula || 'Sem Matrícula'})
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1 font-mono">Data do Almoço</label>
                      <input
                        type="date"
                        value={launchUserDate}
                        onChange={(e) => setLaunchUserDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1 font-mono">Setor / Obra</label>
                      <select
                        value={launchUserObraId}
                        onChange={(e) => setLaunchUserObraId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- Selecione a Unidade --</option>
                        {obras.map(o => (
                          <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!launchUserSelectId) {
                        alert('Por favor, selecione um colaborador.');
                        return;
                      }
                      if (!launchUserDate) {
                        alert('Por favor, defina a data do agendamento.');
                        return;
                      }
                      if (!launchUserObraId) {
                        alert('Por favor, selecione a obra de trabalho.');
                        return;
                      }

                      // Check if already reserved
                      const alreadyExists = (reservas || []).some(
                        r => r.idUsuario === launchUserSelectId && r.data === launchUserDate && r.status === ReservaStatus.Reservado
                      );
                      if (alreadyExists) {
                        alert('Este colaborador já possui uma refeição reservada ativa para este dia.');
                        return;
                      }

                      const selectedUser = usuarios.find(usr => usr.id === launchUserSelectId);
                      
                      const newRes: Reserva = {
                        id: 'r-' + Math.random().toString(36).substr(2, 9),
                        idUsuario: launchUserSelectId,
                        data: launchUserDate,
                        status: ReservaStatus.Reservado,
                        consumido: false,
                        idObraNoDia: launchUserObraId,
                        alteradoEm: new Date().toISOString(),
                        ipOrigem: '127.0.0.1 (RH Lançador)',
                        dispositivo: 'Portal Admin RH'
                      };

                      if (onAddReserva) {
                        onAddReserva(newRes);
                        alert(`Refeição agendada com sucesso para ${selectedUser?.nome} em ${launchUserDate}!`);
                        setLaunchUserSelectId('');
                      }
                    }}
                    className="w-full py-2 px-4 bg-neutral-900 text-white rounded text-xs font-black uppercase tracking-wider hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Agendar Refeição p/ Colaborador
                  </button>
                </div>
              </div>

              {/* Card 2: Lançar Refeição Extra / Visitante */}
              <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs space-y-4">
                <div className="border-b border-neutral-100 pb-2">
                  <span className="font-bold text-xs text-amber-800 block uppercase tracking-wide">✨ Lançar Refeição Extra / Visitante (SEM DESCONTO)</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Lançamento de convites, novos colaboradores sem cadastro, diretores ou auditores. Custo 100% da Fontana (sem desconto).</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1 font-mono">Nome Completo / Identificação</label>
                    <input
                      type="text"
                      placeholder="Ex. Visitante Diretoria, Técnico SGR, Novo Funcionário"
                      value={launchVisitorName}
                      onChange={(e) => setLaunchVisitorName(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-bold text-neutral-805 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1 font-mono">Data da Refeição</label>
                      <input
                        type="date"
                        value={launchVisitorDate}
                        onChange={(e) => setLaunchVisitorDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1 font-mono">Atribuir Centro de Custo / Obra</label>
                      <select
                        value={launchVisitorObraId || (obras[0]?.id || '')}
                        onChange={(e) => setLaunchVisitorObraId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {obras.map(o => (
                          <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!launchVisitorName.trim()) {
                        alert('Por favor, informe a identificação ou nome do visitante.');
                        return;
                      }
                      if (!launchVisitorDate) {
                        alert('Por favor, especifique a data para lançamento do pedido de cortesia.');
                        return;
                      }
                      const resolvedObraId = launchVisitorObraId || (obras[0]?.id || '');

                      const newRes: Reserva = {
                        id: 'r-' + Math.random().toString(36).substr(2, 9),
                        idUsuario: 'visitante-' + Math.random().toString(36).substr(2, 9),
                        nomeVisitante: launchVisitorName.trim(),
                        data: launchVisitorDate,
                        status: ReservaStatus.Reservado,
                        consumido: true, // Visita é considerada consumida por padrão
                        idObraNoDia: resolvedObraId,
                        alteradoEm: new Date().toISOString(),
                        ipOrigem: '127.0.0.1 (RH Lançador Extra)',
                        dispositivo: 'Portal Admin RH'
                      };

                      if (onAddReserva) {
                        onAddReserva(newRes);
                        alert(`Cortesia para "${launchVisitorName}" lançada com sucesso em ${launchVisitorDate}!`);
                        setLaunchVisitorName('');
                      }
                    }}
                    className="w-full py-2 px-4 bg-amber-600 text-white rounded text-xs font-black uppercase tracking-wider hover:bg-amber-700 transition cursor-pointer shadow-sm"
                  >
                    Lançar Reserva Cortesia / Visitante
                  </button>
                </div>
              </div>
            </div>

            {/* List and cancelation table */}
            <div className="bg-neutral-50 p-5 rounded-xl border border-neutral-200 mt-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-neutral-200 pb-3 mb-4">
                <div>
                  <span className="font-bold text-xs text-neutral-800 uppercase tracking-wide block">📋 Monitoramento e Exclusão de Lançamentos Extras</span>
                  <span className="text-[10px] text-neutral-400 block">Exibe todos os agendamentos manuais (colaboradores e visitantes) efetuados pelo RH na data selecionada.</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-550 font-bold uppercase font-mono">Filtrar por data:</span>
                  <input
                    type="date"
                    value={launchTableFilterDate}
                    onChange={(e) => setLaunchTableFilterDate(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white text-neutral-800 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Table rendering wrapping closures */}
              {(() => {
                const launchedReservations = (reservas || []).filter(r => 
                  r.data === launchTableFilterDate && 
                  r.status === ReservaStatus.Reservado &&
                  (r.idUsuario.startsWith('visitante-') || r.dispositivo?.includes('RH') || r.ipOrigem?.includes('RH'))
                );

                if (launchedReservations.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-neutral-400 font-bold font-mono uppercase tracking-wide">
                      Nenhum agendamento ou cortesia do RH para {launchTableFilterDate}.
                    </div>
                  );
                }

                return (
                  <div className="border border-neutral-200 rounded-lg overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-400 font-mono uppercase text-[9px]">
                        <tr>
                          <th className="p-3">Beneficiário</th>
                          <th className="p-3">Matrícula / Tipo</th>
                          <th className="p-3">Obra Alloc</th>
                          <th className="p-3">Status Refeição</th>
                          <th className="p-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-neutral-700">
                        {launchedReservations.map(r => {
                          const isVisitor = r.idUsuario.startsWith('visitante-');
                          const userObj = usuarios.find(u => u.id === r.idUsuario);
                          const oObj = getObra(r.idObraNoDia);

                          return (
                            <tr key={r.id} className="hover:bg-neutral-50/50">
                              <td className="p-3 font-extrabold text-neutral-800">
                                {isVisitor ? (r.nomeVisitante || 'Visitante/Extra') : (userObj ? userObj.nome : 'N/A')}
                              </td>
                              <td className="p-3">
                                {isVisitor ? (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 font-black rounded border border-amber-200 text-[10px] uppercase font-mono">
                                    Visitante / Cortesia (Sem Desconto)
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200 text-[10px] font-mono">
                                    Mat: {userObj ? userObj.matricula : 'S/R'} (Desconto Padrão)
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-semibold text-neutral-600">
                                {oObj ? oObj.nome : 'Sede Forner'}
                              </td>
                              <td className="p-3 font-bold text-emerald-700 text-[10px] uppercase font-mono">
                                🟢 RESERVADA
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => {
                                    let isConfirmed = false;
                                    try {
                                      isConfirmed = window.confirm('Deseja realmente cancelar este lançamento feito pelo RH?');
                                    } catch (e) {
                                      isConfirmed = true; // Fallback for sandboxed iframes
                                    }
                                    if (isConfirmed) {
                                      if (onDeleteReserva) {
                                        onDeleteReserva(r.id);
                                      }
                                    }
                                  }}
                                  className="p-1 text-neutral-450 hover:text-rose-600 transition cursor-pointer"
                                  title="Remover lançamento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Global settings parameters tab */}
        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-6" id="settings-tab-content">
            <div>
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Parâmetros das Regras de Negócio</h3>
              <p className="text-xs text-neutral-500">Mude as tolerâncias horárias, preços de refeições para faturar custo por obra e tolerâncias de fins de semana.</p>
            </div>

            {isSavedMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded border border-emerald-200 font-medium">
                ✔ Parâmetros atualizados no banco de dados e aplicados em tempo real!
              </div>
            )}

            <form onSubmit={handleSaveSettingsSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Horário Limite Diário</label>
                  <input
                    type="text"
                    required
                    value={horioLimiteLocal}
                    onChange={(e) => setHorarioLimiteLocal(e.target.value)}
                    placeholder="Ex. 08:30"
                    className="w-full px-3 py-2 border border-neutral-300 bg-white text-neutral-800 text-sm font-semibold rounded-lg focus:ring-1 focus:ring-emerald-500 text-center"
                    id="set-cutoff-time"
                  />
                  <span className="text-[10px] text-neutral-400 mt-1 block">Tolerância para o dia de hoje.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Finais de Semana</label>
                  <div className="mt-2.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permitirFdsLocal}
                        onChange={(e) => setPermitirFdsLocal(e.target.checked)}
                        className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        id="set-weekend-permitted"
                      />
                      <span className="text-xs text-neutral-700 font-medium">Permitir reservas sábados e domingos</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3">
                <span className="block text-xs font-bold uppercase tracking-wide font-mono text-emerald-800 flex items-center gap-1.5">
                  📱 Validação Física de Retirada (Tablet)
                </span>
                <p className="text-[11px] text-neutral-600 leading-normal">
                  Selecione se o refeitório possui um tablet físico instalado para verificação facial ou baixa de retirada no momento da alimentação.
                </p>

                <div className="mt-2 text-xs">
                  <label className="inline-flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usarTabletLocal}
                      onChange={(e) => setUsarTabletLocal(e.target.checked)}
                      className="rounded border-neutral-300 text-emerald-650 focus:ring-emerald-500 h-4 w-4 mt-0.5"
                      id="set-usar-tablet-retirada"
                    />
                    <div>
                      <span className="font-bold text-neutral-800 block leading-tight">Requerer confirmação via Tablet no refeitório</span>
                      <span className="text-[11px] text-neutral-500 block leading-tight mt-1">
                        {usarTabletLocal 
                          ? "🟠 Ativo: Colaboradores devem usar o tablet do refeitório para confirmar que receberam sua marmita/refeição."
                          : "🟢 Inativo (Sua operação atual): Refeições agendadas e não canceladas em tempo hábil serão faturadas automaticamente como entregues, dispensando o tablet físico."
                        }
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3">
                <span className="block text-xs font-bold uppercase tracking-wide font-mono text-emerald-800 flex items-center gap-1.5">
                  📸 Identificação Biométrica por Reconhecimento Facial
                </span>
                <p className="text-[11px] text-neutral-600 leading-normal">
                  Configure se a validação no tablet do refeitório deve exigir leitura de Reconhecimento Facial (mapeamento biométrico via câmera) ou se o acesso pode ser verificado por métodos alternativos (toque simples ou digitação rápida da matrícula).
                </p>

                <div className="mt-2 text-xs">
                  <label className="inline-flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requererBiometriaLocal}
                      onChange={(e) => setRequererBiometriaLocal(e.target.checked)}
                      className="rounded border-neutral-300 text-emerald-650 focus:ring-emerald-500 h-4 w-4 mt-0.5"
                      id="set-requerer-biometria-facial"
                    />
                    <div>
                      <span className="font-bold text-neutral-800 block leading-tight">Requerer Leitura de Biometria Facial</span>
                      <span className="text-[11px] text-neutral-500 block leading-tight mt-1">
                        {requererBiometriaLocal 
                          ? "🔵 Ativo (Câmera Ligada): Exige autenticação fotográfica biométrica com validação do mapeamento facial na tela."
                          : "⚪ Inativo (Toque / Matrícula): Permite liberação por toque rápido no nome / digitação simples no refeitório, economizando recursos de renderização da câmera."
                        }
                      </span>
                    </div>
                  </label>
                </div>
              </div>

               <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3">
                <span className="block text-xs font-bold uppercase tracking-wide font-mono text-neutral-600">
                  Gestão de Custo Padrão - Valor Global da Refeição (R$)
                </span>

                <div className="max-w-xs">
                  <label className="block text-[10px] text-neutral-500 uppercase font-mono mb-1">Preço Unitário Padrão da Refeição (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={precoPropriaLocal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPrecoPropriaLocal(val);
                      setPrecoTerceirosLocal(val); // Sincroniza para manter compatibilidade retroativa
                    }}
                    placeholder="Ex: 18.90"
                    className="w-full px-3 py-1.5 border border-neutral-300 bg-white text-neutral-800 text-xs font-bold rounded focus:ring-1 focus:ring-emerald-500"
                    id="set-cost-own"
                  />
                  <span className="text-[9px] text-neutral-400 block mt-1">Custo padrão cobrado do fornecedor quando não houver customização por obra (Ex: 18,90).</span>
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                id="save-settings-btn"
              >
                <Save className="h-3.5 w-3.5" /> Salvar Parâmetros
              </button>
            </form>

            {/* Manutenção do Banco - Limpeza de Reservas */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3 mt-6">
              <span className="block text-xs font-black uppercase tracking-wide font-mono text-red-800 flex items-center gap-1.5">
                ⚠️ Limpeza Estruturada de Reservas (Manutenção)
              </span>
              <p className="text-[11px] text-red-700 leading-normal font-medium">
                Selecione se deseja excluir todo o histórico de reservas do sistema ou limpar apenas as reservas da data atual em diante.
              </p>
              <button
                type="button"
                onClick={() => setShowResetReservasModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1.5"
                id="btn-delete-all-reservations"
              >
                <Trash2 className="w-3.5 h-3.5" /> Opções de Limpeza de Reservas
              </button>
            </div>
          </div>
        )}

        {/* Audit Logs tab */}
        {activeTab === 'logs' && (
          <div className="space-y-4" id="logs-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Trilha de Auditoria (IP / Dispositivo)</h3>
                <p className="text-xs text-neutral-500">Histórico completo de alterações por usuário. Atende aos requisitos fiscais e de controle de custos.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Filtrar por alteração, usuá..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 w-full sm:w-64 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  id="search-log-input"
                />
              </div>
            </div>

            <div className="border border-neutral-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full min-w-[800px] text-left text-xs bg-white">
                <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Data e Hora</th>
                    <th className="p-3">Usuário / Perfil</th>
                    <th className="p-3 col-span-2">Operação do Sistema</th>
                    <th className="p-3">Endereço IP</th>
                    <th className="p-3">Dispositivo Mapeado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-600 font-sans">
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-neutral-50">
                      <td className="p-3 text-neutral-400 font-mono text-[10px]">
                        {new Date(l.dataHora).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-neutral-800">{l.usuarioNome}</div>
                        <div className="text-[9px] text-sky-600 font-mono uppercase tracking-wide">{l.perfil}</div>
                      </td>
                      <td className="p-3 font-semibold text-neutral-700 text-xs">
                        {l.operacao}
                      </td>
                      <td className="p-3 text-[11px] font-mono font-medium text-neutral-500">
                        {l.ip}
                      </td>
                      <td className="p-3 text-[11px] text-neutral-400">
                        {l.dispositivo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-neutral-400 font-mono">
              * Mostrando os últimos 100 registros de auditoria. Para fins de auditoria civil, todos os logs são consolidados em servidores seguros e assinados digitalmente.
            </p>
          </div>
        )}

        {/* Gestão de Obras / Setores tab */}
        {activeTab === 'obras' && (
          <div className="space-y-6 animate-[fadeIn_0.15s_ease]" id="obras-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Gestão de Áreas e Canteiros de Obra (Unidades de Custo)</h3>
                <p className="text-xs text-neutral-500">Configure orçamentos, valores unitários de refeições por unidade e atribua fornecedores dedicados para cada ponto de retirada.</p>
              </div>
              <div>
                {!isAddingObra && !editingObraId && (
                  <button
                    onClick={() => {
                      setObraForm({
                        id: 'o-' + Math.random().toString(36).substring(2, 7),
                        nome: '',
                        centroCusto: '',
                        ativa: true,
                        valorRefeicao: settings.valorRefeicaoPropria,
                        idFornecedorPrincipal: ''
                      });
                      setIsAddingObra(true);
                    }}
                    className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                    id="add-new-work-btn"
                  >
                    <Plus className="h-3.5 w-3.5" /> Nova Obra / Unidade
                  </button>
                )}
              </div>
            </div>

            {/* Form for Creating / Editing Obra */}
            {(isAddingObra || editingObraId) && (
              <div className="bg-neutral-50 border border-neutral-200 p-5 rounded-xl space-y-4 animate-[fadeIn_0.2s_ease]" id="obra-form-box">
                <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    {isAddingObra ? '➕ Cadastrar Nova Obra' : '📝 Editar Configurações da Obra'}
                  </h4>
                  <button 
                    onClick={() => {
                      setIsAddingObra(false);
                      setEditingObraId(null);
                    }}
                    className="text-neutral-400 hover:text-neutral-600 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">ID / Código da Obra (slug)</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingObraId}
                      value={obraForm.id}
                      onChange={(e) => setObraForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      placeholder="Ex: o-sede"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono font-bold bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Nome da Área / Obra *</label>
                    <input
                      type="text"
                      required
                      value={obraForm.nome}
                      onChange={(e) => setObraForm(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Canteiro Sede Fontana"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold bg-white text-neutral-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Centro de Custo (Rateio) *</label>
                    <input
                      type="text"
                      required
                      value={obraForm.centroCusto}
                      onChange={(e) => setObraForm(prev => ({ ...prev, centroCusto: e.target.value }))}
                      placeholder="Ex: 01.12.04"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono font-bold bg-white text-neutral-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Valor da Refeição (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={obraForm.valorRefeicao === undefined ? settings.valorRefeicaoPropria : obraForm.valorRefeicao}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setObraForm(prev => ({ ...prev, valorRefeicao: val as number }));
                      }}
                      placeholder="Ex: 25.00"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold bg-white text-neutral-800 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[9px] text-neutral-400 mt-0.5 block">Preço unitário faturado do fornecedor (R$ {settings.valorRefeicaoPropria.toFixed(2)} global).</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Desconto Colaborador (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={obraForm.valorDescontoColaborador === undefined ? 0 : obraForm.valorDescontoColaborador}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setObraForm(prev => ({ ...prev, valorDescontoColaborador: val }));
                      }}
                      placeholder="Ex: 5.00"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold bg-white text-neutral-800 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[9px] text-neutral-400 mt-0.5 block">Desconto em folha (Ex: limitar por conv. ou 20% do custo).</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Fornecedor Principal (Restaurante)</label>
                    <select
                      value={obraForm.idFornecedorPrincipal || ''}
                      onChange={(e) => setObraForm(prev => ({ ...prev, idFornecedorPrincipal: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold bg-white text-neutral-800"
                    >
                      <option value="">Selecione o Fornecedor Principal...</option>
                      {usuarios
                        .filter(u => u.perfil === Perfil.Fornecedor)
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nome} ({u.email})
                          </option>
                        ))
                      }
                    </select>
                    <span className="text-[9px] text-neutral-400 mt-0.5 block">Cozinha encarregada pela preparação de marmitas</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white p-3 rounded border border-neutral-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={obraForm.ativa}
                      onChange={(e) => setObraForm(prev => ({ ...prev, ativa: e.target.checked }))}
                      className="rounded border-neutral-300 text-neutral-900 h-4 w-4 focus:ring-neutral-500"
                      id="obra-form-active"
                    />
                    <label htmlFor="obra-form-active" className="text-xs font-bold text-neutral-700 cursor-pointer">Unidade / Obra Ativa para faturamento e reservas</label>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!obraForm.id || !obraForm.nome || !obraForm.centroCusto) {
                        alert('Preencha os campos obrigatórios (ID, Nome e Centro de Custo)!');
                        return;
                      }
                      onSaveObra({
                        id: obraForm.id,
                        nome: obraForm.nome,
                        centroCusto: obraForm.centroCusto,
                        ativa: !!obraForm.ativa,
                        valorRefeicao: Number(obraForm.valorRefeicao || 0),
                        valorDescontoColaborador: Number(obraForm.valorDescontoColaborador || 0),
                        idFornecedorPrincipal: obraForm.idFornecedorPrincipal || '',
                        cardapioUrl: obraForm.cardapioUrl || '',
                        cardapioNome: obraForm.cardapioNome || '',
                        cardapioAtualizadoEm: obraForm.cardapioAtualizadoEm || ''
                      });
                      setIsAddingObra(false);
                      setEditingObraId(null);
                    }}
                    className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white rounded text-xs font-bold transition hover:bg-neutral-850 cursor-pointer"
                  >
                    Salvar Unidade / Obra
                  </button>
                </div>
              </div>
            )}

            {/* List of Obras */}
            <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Código (ID)</th>
                    <th className="p-3">Nome da Unidade / Área</th>
                    <th className="p-3">Centro de Custo</th>
                    <th className="p-3 text-right">Valor da Refeição</th>
                    <th className="p-3 text-right">Desconto Colab.</th>
                    <th className="p-3">Fornecedor Principal</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700 font-medium">
                  {obras && obras.length > 0 ? (
                    obras.map(o => {
                      const vendor = usuarios.find(u => u.id === o.idFornecedorPrincipal);
                      const finalPrice = o.valorRefeicao && o.valorRefeicao > 0 ? o.valorRefeicao : settings.valorRefeicaoPropria;

                      return (
                        <tr key={o.id} className="hover:bg-neutral-50/60">
                          <td className="p-3 font-mono font-bold text-neutral-500">{o.id}</td>
                          <td className="p-3 font-bold text-neutral-900">{o.nome}</td>
                          <td className="p-3 font-mono">{o.centroCusto}</td>
                          <td className="p-3 text-right font-bold text-neutral-800">
                            {o.valorRefeicao && o.valorRefeicao > 0 ? (
                              <span className="text-emerald-700">R$ {o.valorRefeicao.toFixed(2)}</span>
                            ) : (
                              <span className="text-neutral-400">R$ {settings.valorRefeicaoPropria.toFixed(2)} (Global)</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-800 font-mono">
                            R$ {(o.valorDescontoColaborador ?? 0).toFixed(2)}
                          </td>
                          <td className="p-3">
                            {vendor ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-[11px] text-neutral-800">{vendor.nome}</span>
                                <span className="text-[9px] text-neutral-400 leading-none">{vendor.email}</span>
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic text-[11px]">Nenhum fornecedor vinculado</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                              o.ativa 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {o.ativa ? 'ATIVO' : 'DESATIVADO'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setObraForm({
                                  id: o.id,
                                  nome: o.nome,
                                  centroCusto: o.centroCusto,
                                  ativa: o.ativa,
                                  valorRefeicao: o.valorRefeicao || 0,
                                  valorDescontoColaborador: o.valorDescontoColaborador || 0,
                                  idFornecedorPrincipal: o.idFornecedorPrincipal || '',
                                  cardapioUrl: o.cardapioUrl || '',
                                  cardapioNome: o.cardapioNome || '',
                                  cardapioAtualizadoEm: o.cardapioAtualizadoEm || ''
                                });
                                setEditingObraId(o.id);
                                setIsAddingObra(false);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold text-neutral-700 bg-neutral-105 hover:bg-neutral-200 rounded border border-neutral-300 cursor-pointer"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-400 italic">Nenhuma obra cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* NOVO: Gestão de Cardápios por Obra */}
            <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-6" id="gestao-cardapios-secao">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5 animate-pulse">
                  <FileText className="h-4 w-4 text-emerald-600" /> Upload de Cardápio Mensal por Área / Obra
                </h3>
                <p className="text-xs text-neutral-500">
                  Faça o upload do cronograma dietético mensal em PDF. O colaborador poderá visualizá-lo diretamente de seu respectivo dispositivo conforme a obra integrada.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form to upload */}
                <div className="lg:col-span-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">📤 Vincular Novo PDF</h4>
                  
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Selecione a Área / Obra de Destino *</label>
                    <select
                      value={cardapioObraId}
                      onChange={(e) => {
                        setCardapioObraId(e.target.value);
                        // Reset form status when obra changes
                        setTempPdfContent('');
                        setTempPdfName('');
                        setTempPdfSize(null);
                      }}
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold bg-white text-neutral-800 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Selecione uma Área / Obra...</option>
                      {obras.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.nome} ({o.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {cardapioObraId && (
                    <div className="space-y-4 animate-[fadeIn_0.15s_ease]">
                      {/* Drag and drop zone */}
                      <div>
                        <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1.5">Arquivo PDF do Cardápio *</label>
                        
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverCardapio(true);
                          }}
                          onDragLeave={() => setDragOverCardapio(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverCardapio(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              if (file.type !== 'application/pdf') {
                                alert('Erro: Envie apenas arquivos no formato PDF!');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setTempPdfContent(ev.target?.result as string);
                                setTempPdfName(file.name);
                                setTempPdfSize(Math.round(file.size / 1024));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                            dragOverCardapio
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : tempPdfContent
                              ? 'border-emerald-550/35 bg-emerald-50/10 text-neutral-700'
                              : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50 text-neutral-600'
                          }`}
                          onClick={() => {
                            document.getElementById('file-pdf-input')?.click();
                          }}
                        >
                          <input
                            type="file"
                            id="file-pdf-input"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.type !== 'application/pdf') {
                                  alert('Erro: Envie apenas arquivos no formato PDF!');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setTempPdfContent(ev.target?.result as string);
                                  setTempPdfName(file.name);
                                  setTempPdfSize(Math.round(file.size / 1024));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Plus className="h-6 w-6 text-neutral-400" />
                            {tempPdfName ? (
                              <div className="space-y-1">
                                <p className="text-xs font-black text-emerald-850 truncate max-w-[200px]">{tempPdfName}</p>
                                <p className="text-[10px] text-neutral-400 font-mono">{tempPdfSize} KB</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs font-bold text-neutral-700">Arraste o PDF para cá ou clique para explorar</p>
                                <p className="text-[10px] text-neutral-400 mt-1">Apenas arquivos .PDF (Máx. 1MB recomendado)</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Manual/Alternative PDF Url input */}
                      <div className="pt-1">
                        <span className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">Ou digite uma URL pública externa do PDF:</span>
                        <input
                          type="text"
                          value={tempPdfContent && !tempPdfContent.startsWith('data:application/pdf') ? tempPdfContent : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempPdfContent(val);
                            if (val) {
                              setTempPdfName(val.substring(val.lastIndexOf('/') + 1) || 'cardapio_online.pdf');
                              setTempPdfSize(null);
                            } else {
                              setTempPdfName('');
                            }
                          }}
                          placeholder="https://exemplo.com/cardapio_junho.pdf"
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono font-bold bg-white text-neutral-800"
                        />
                      </div>

                      {tempPdfContent && (
                        <div className="flex items-center gap-2 pt-2 animate-[fadeIn_0.1s_ease]">
                          <button
                            type="button"
                            onClick={() => {
                              const targetObra = obras.find(o => o.id === cardapioObraId);
                              if (!targetObra) return;
                              
                              onSaveObra({
                                ...targetObra,
                                cardapioUrl: tempPdfContent,
                                cardapioNome: tempPdfName || 'cardapio.pdf',
                                cardapioAtualizadoEm: new Date().toISOString()
                              });
                              
                              // Reset state
                              setCardapioObraId('');
                              setTempPdfContent('');
                              setTempPdfName('');
                              setTempPdfSize(null);
                            }}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-black transition text-center flex items-center justify-center gap-1.5 animate-pulse"
                          >
                            <Check className="h-4 w-4" /> Salvar Cardápio PDF
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!cardapioObraId && (
                    <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-center text-xs text-neutral-400 italic">
                      Selecione uma Área / Obra acima para habilitar o upload do cardápio em PDF.
                    </div>
                  )}
                </div>

                {/* Table containing current setups */}
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">📋 Cardápios Cadastrados por Obra</h4>
                  
                  <div className="border border-neutral-200 rounded-xl overflow-x-auto bg-neutral-50/50">
                    <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Obra / Unidade</th>
                          <th className="p-3">Nome do Arquivo PDF</th>
                          <th className="p-3">Data de Upload</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-neutral-700 font-medium">
                        {obras.some(o => o.cardapioUrl) ? (
                          obras
                            .filter(o => o.cardapioUrl)
                            .map(o => (
                              <tr key={o.id} className="bg-white hover:bg-neutral-50/50">
                                <td className="p-3">
                                  <span className="font-bold text-neutral-900 block">{o.nome}</span>
                                  <span className="text-[9px] text-neutral-400 font-mono">{o.id}</span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <span className="font-bold text-neutral-850 truncate max-w-[150px]" title={o.cardapioNome}>
                                      {o.cardapioNome}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-[11px] text-neutral-500 font-mono">
                                  {o.cardapioAtualizadoEm ? new Date(o.cardapioAtualizadoEm).toLocaleString('pt-BR') : 'Sem registro'}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex justify-end items-center gap-1.5">
                                    {o.cardapioUrl && (
                                      <a
                                        href={o.cardapioUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 transition"
                                        title="Baixar ou abrir em outra aba"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                    {deletingMenuObraId === o.id ? (
                                      <div className="flex items-center gap-1 animate-pulse">
                                        <button
                                          onClick={() => {
                                            onSaveObra({
                                              ...o,
                                              cardapioUrl: '',
                                              cardapioNome: '',
                                              cardapioAtualizadoEm: ''
                                            });
                                            setDeletingMenuObraId(null);
                                          }}
                                          className="p-1 text-white bg-red-600 rounded border border-red-700 hover:bg-red-700 text-[10px] font-black px-1.5 cursor-pointer"
                                          title="Confirmar exclusão"
                                        >
                                          Sim
                                        </button>
                                        <button
                                          onClick={() => setDeletingMenuObraId(null)}
                                          className="p-1 text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-100 text-[10px] font-bold px-1.5 cursor-pointer"
                                          title="Cancelar"
                                        >
                                          Não
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setDeletingMenuObraId(o.id)}
                                        className="p-1 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded border border-rose-200 hover:border-transparent transition cursor-pointer"
                                        title="Remover cardápio em PDF"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-neutral-400 italic">Nenhum cardápio em PDF foi cadastrado nas obras.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empresas list and configuration tab */}
        {activeTab === 'empresas' && (
          <div className="space-y-4" id="empresas-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Cadastro Simples de Empresas</h3>
                <p className="text-xs text-neutral-500">
                  Gerencie as empresas terceirizadas, prestadoras de serviço e própria.
                </p>
              </div>
              
              {!isAddingEmpresa && editingEmpresaId === null && (
                <button
                  onClick={() => {
                    setEmpresaForm({
                      id: 'emp-' + Math.random().toString(36).substring(2, 7),
                      nome: '',
                      tipo: 'Terceirizada'
                    });
                    setIsAddingEmpresa(true);
                  }}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  id="btn-add-empresa"
                >
                  <Plus className="h-4 w-4" /> Nova Empresa
                </button>
              )}
            </div>

            {/* Creation or Edit Panel */}
            {(isAddingEmpresa || editingEmpresaId !== null) && (
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-4 transition-all">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                  <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider">
                    {isAddingEmpresa ? 'Cadastrar Nova Empresa' : 'Editar Informações da Empresa'}
                  </h4>
                  <button
                    onClick={() => {
                      setIsAddingEmpresa(false);
                      setEditingEmpresaId(null);
                    }}
                    className="p-1 hover:bg-neutral-250 rounded text-neutral-500 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-neutral-500 uppercase font-black mb-1">Código ID da Empresa</label>
                    <input
                      type="text"
                      disabled={false}
                      value={empresaForm.id || ''}
                      onChange={(e) => setEmpresaForm(prev => ({ ...prev, id: e.target.value.toLowerCase().trim() }))}
                      placeholder="Ex: emp-parceiro"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono font-bold bg-white text-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <p className="text-[9px] text-neutral-400 mt-0.5">Dica: Alterar o ID atualizará o registro no banco de dados.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Nome da Empresa</label>
                    <input
                      type="text"
                      required
                      value={empresaForm.nome || ''}
                      onChange={(e) => setEmpresaForm(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Construtora Exemplo Ltda"
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-bold bg-white text-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Enquadramento / Tipo</label>
                    <select
                      value={empresaForm.tipo || 'Terceirizada'}
                      onChange={(e) => setEmpresaForm(prev => ({ ...prev, tipo: e.target.value as Empresa['tipo'] }))}
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-semibold bg-white text-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-sans"
                    >
                      <option value="Propria">Empresa Própria (Grupo Fontana)</option>
                      <option value="Terceirizada">Terceirizada (Fornecedores Fixos)</option>
                      <option value="Prestadora">Prestadora de Serviços / Empreiteiras</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingEmpresa(false);
                      setEditingEmpresaId(null);
                    }}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100 rounded text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!empresaForm.id || !empresaForm.nome || !empresaForm.tipo}
                    onClick={() => {
                      if (empresaForm.id && empresaForm.nome && empresaForm.tipo) {
                        const idExists = empresas.some(e => e.id === empresaForm.id && e.id !== editingEmpresaId);
                        if (idExists) {
                          alert(`O Código ID "${empresaForm.id}" já está sendo usado por outra empresa.`);
                          return;
                        }
                        onSaveEmpresa({
                          id: empresaForm.id,
                          nome: empresaForm.nome,
                          tipo: empresaForm.tipo
                        }, editingEmpresaId || undefined);
                        setIsAddingEmpresa(false);
                        setEditingEmpresaId(null);
                      }
                    }}
                    className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer"
                  >
                    Salvar Empresa
                  </button>
                </div>
              </div>
            )}

            {/* List and Columns */}
            <div className="border border-neutral-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full min-w-[650px] text-left text-xs bg-white">
                <thead className="bg-neutral-50 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Código ID</th>
                    <th className="p-3">Nome da Empresa</th>
                    <th className="p-3">Tipo / Enquadramento</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700 font-medium">
                  {empresas && empresas.length > 0 ? (
                    empresas.map(emp => (
                      <tr key={emp.id} className="hover:bg-neutral-50/60 transition-all">
                        <td className="p-3 font-mono font-bold text-neutral-500">{emp.id}</td>
                        <td className="p-3 font-bold text-neutral-900">{emp.nome}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                            emp.tipo === 'Propria'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : emp.tipo === 'Terceirizada'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {emp.tipo === 'Propria' ? 'PRÓPRIA' : emp.tipo === 'Terceirizada' ? 'TERCEIRIZADA' : 'PRESTADORA'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEmpresaForm({
                                id: emp.id,
                                nome: emp.nome,
                                tipo: emp.tipo
                              });
                              setEditingEmpresaId(emp.id);
                              setIsAddingEmpresa(false);
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold text-neutral-700 bg-neutral-105 hover:bg-neutral-200 rounded border border-neutral-300 cursor-pointer"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-neutral-400 italic">Nenhuma empresa cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feriados tab */}
        {activeTab === 'feriados' && (
          <div className="space-y-6 animate-[fadeIn_0.15s_ease]" id="feriados-tab-content">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Cadastro de Feriados, Pontes e Obras Reguladas</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Defina os feriados nacionais ou municipais. Feriados impedem que colaboradores reservem ou façam retirada de insumos para obras associadas.
                </p>
              </div>

              {!isAddingFeriado && editingFeriadoId === null && (
                <button
                  type="button"
                  onClick={() => {
                    setFeriadoForm({
                      id: 'f-' + Math.random().toString(36).substr(2, 9),
                      data: '2026-06-13',
                      descricao: '',
                      tipo: 'municipal',
                      abrangencia: 'nacional',
                      idObras: []
                    });
                    setIsAddingFeriado(true);
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-805 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  id="btn-add-feriado"
                >
                  <Plus className="h-4 w-4" /> Cadastrar Feriado / Ponte
                </button>
              )}
            </div>

            {/* Feriado Form (Add / Edit) */}
            {(isAddingFeriado || editingFeriadoId !== null) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!feriadoForm.data || !feriadoForm.descricao) {
                    alert('Por favor, preencha a data e a descrição.');
                    return;
                  }
                  onSaveFeriado({
                    id: feriadoForm.id || 'f-' + Math.random().toString(36).substr(2, 9),
                    data: feriadoForm.data,
                    descricao: feriadoForm.descricao,
                    tipo: feriadoForm.tipo || 'municipal',
                    abrangencia: feriadoForm.abrangencia || 'nacional',
                    idObras: feriadoForm.abrangencia === 'especifico' ? (feriadoForm.idObras || []) : []
                  } as Feriado);
                  setIsAddingFeriado(false);
                  setEditingFeriadoId(null);
                }}
                className="bg-neutral-50 p-5 rounded-xl border border-neutral-200 space-y-4 text-left max-w-2xl"
                id="feriado-form-box"
              >
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                  <span className="text-xs font-black text-neutral-800 uppercase tracking-wider font-mono">
                    {isAddingFeriado ? 'Novo Feriado' : 'Editar Feriado'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingFeriado(false);
                      setEditingFeriadoId(null);
                    }}
                    className="p-1 text-neutral-500 hover:text-neutral-800 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      min="2026-01-01"
                      max="2030-12-31"
                      value={feriadoForm.data}
                      onChange={(e) => setFeriadoForm(prev => ({ ...prev, data: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-xs bg-white text-neutral-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Descrição / Nome do Evento</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Corpus Christi, Feriado Municipal, etc."
                      value={feriadoForm.descricao}
                      onChange={(e) => setFeriadoForm(prev => ({ ...prev, descricao: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-xs bg-white text-neutral-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Tipo de Feriado</label>
                    <select
                      value={feriadoForm.tipo}
                      onChange={(e) => setFeriadoForm(prev => ({ ...prev, tipo: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-xs bg-white text-neutral-800 cursor-pointer"
                    >
                      <option value="nacional">Nacional (Geral)</option>
                      <option value="estadual">Estadual</option>
                      <option value="municipal">Municipal</option>
                      <option value="interno">Interno / Ponte Corporativo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Abrangência (Impacto)</label>
                    <select
                      value={feriadoForm.abrangencia}
                      onChange={(e) => {
                        const abr = e.target.value as 'nacional' | 'especifico';
                        setFeriadoForm(prev => ({ ...prev, abrangencia: abr, idObras: abr === 'especifico' ? (prev.idObras || []) : [] }));
                      }}
                      className="w-full px-3 py-2 border border-neutral-350 rounded text-xs bg-white text-neutral-800 cursor-pointer"
                    >
                      <option value="nacional">Nacional (Impacta TODAS as Obras/Cozinhas)</option>
                      <option value="especifico">Específico (Apenas Obras de Municípios afetados)</option>
                    </select>
                  </div>
                </div>

                {feriadoForm.abrangencia === 'especifico' && (
                  <div className="space-y-2 animate-[fadeIn_0.15s_ease] pt-1">
                    <label className="block text-[10px] uppercase font-black text-neutral-700 tracking-wider">
                      Selecione as Áreas / Obras Afetadas por este Feriado:
                    </label>
                    <div className="bg-white border border-neutral-300 rounded-lg p-3 max-h-[160px] overflow-y-auto space-y-2">
                      {obras.length > 0 ? (
                        obras.map(obra => {
                          const isChecked = feriadoForm.idObras?.includes(obra.id) ?? false;
                          return (
                            <label key={obra.id} className="flex items-center gap-2 text-xs font-bold text-neutral-750 cursor-pointer hover:bg-neutral-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFeriadoForm(prev => {
                                    const currentList = prev.idObras || [];
                                    const nextList = checked
                                      ? [...currentList, obra.id]
                                      : currentList.filter(id => id !== obra.id);
                                    return { ...prev, idObras: nextList };
                                  });
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              <span>{obra.nome} <span className="text-[10px] text-neutral-450 font-mono font-normal">({obra.centroCusto})</span></span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-xs text-neutral-400 italic">Nenhuma obra cadastrada para associação.</div>
                      )}
                    </div>
                    <span className="text-[9px] text-neutral-400 block leading-tight">
                      Colaboradores alocados nestas obras específicas não conseguirão agendar marmitas na data do feriado.
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingFeriado(false);
                      setEditingFeriadoId(null);
                    }}
                    className="px-4 py-2 border border-neutral-300 text-neutral-750 hover:bg-neutral-100 bg-white rounded text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer transition-all shadow-xs"
                  >
                    Salvar Feriado
                  </button>
                </div>
              </form>
            )}

            {/* List of existing holidays */}
            <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs bg-white">
                <thead className="bg-neutral-900 text-white text-[10px] uppercase tracking-wider font-mono">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição / Nome</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Abrangência (Obras Afetadas)</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700 font-medium">
                  {feriados.length > 0 ? (
                    feriados.map((f) => {
                      const obraNames = f.abrangencia === 'especifico'
                        ? (f.idObras || []).map(oid => obras.find(o => o.id === oid)?.nome || oid).join(', ')
                        : 'Todas as Obras (Geral)';

                      return (
                        <tr key={f.id} className="hover:bg-neutral-50 transition-all font-medium">
                          <td className="p-3 whitespace-nowrap font-mono font-bold text-neutral-850">
                            {(() => {
                              const parts = f.data.split('-');
                              return `${parts[2]}/${parts[1]}/${parts[0]}`;
                            })()}
                          </td>
                          <td className="p-3 font-bold text-neutral-900">{f.descricao}</td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase bg-neutral-100 text-neutral-700">
                              {f.tipo}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`text-[11px] leading-relaxed block max-w-sm ${f.abrangencia === 'especifico' ? 'text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-semibold' : 'text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-250 font-extrabold'}`}>
                              {f.abrangencia === 'especifico' ? `📍 Obras: ${obraNames || 'Nenhuma (Feriado desativado)'}` : '🌍 Todo Território Nacional'}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setFeriadoForm({ ...f });
                                  setEditingFeriadoId(f.id);
                                  setIsAddingFeriado(false);
                                }}
                                className="px-2 py-1 text-[10px] font-bold text-neutral-750 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 cursor-pointer"
                              >
                                Editar
                              </button>
                              {deletingFeriadoId === f.id ? (
                                <div className="inline-flex gap-1 animate-pulse">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteFeriado(f.id);
                                      setDeletingFeriadoId(null);
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold text-white bg-red-650 hover:bg-red-700 rounded border border-red-700 cursor-pointer"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingFeriadoId(null)}
                                    className="px-2 py-1 text-[10px] font-bold text-neutral-750 bg-white hover:bg-neutral-100 rounded border border-neutral-350 cursor-pointer"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeletingFeriadoId(f.id)}
                                  className="px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 cursor-pointer"
                                >
                                  Excluir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-neutral-400 italic">Nenhum feriado cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit User/Collaborator Modal Overlay */}
      {editingUser && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="edit-user-modal">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="bg-neutral-900 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Alterar Cadastro do Integrante</h3>
                  <p className="text-[10px] text-neutral-400 leading-none mt-0.5">Matrícula: {editingUser.matricula || 'Sem Registro'}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 hover:bg-neutral-800 rounded transition text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-left">
              <div>
                <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editingUser.nome}
                  onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, nome: e.target.value }) : null)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-bold text-neutral-850 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans bg-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">CPF (apenas números) *</label>
                  <input
                    type="text"
                    required
                    value={editingUser.cpf || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditingUser(prev => prev ? ({ ...prev, cpf: val }) : null);
                    }}
                    placeholder="Ex. 11122233344"
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">E-mail (opcional)</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-555 uppercase font-black mb-1">Matrícula (Registro RH)</label>
                  <input
                    type="text"
                    required
                    value={editingUser.matricula}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, matricula: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Empresa Vinculada</label>
                  <select
                    value={editingUser.idEmpresa}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, idEmpresa: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans cursor-pointer"
                  >
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nome} ({emp.tipo})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Perfil de Acesso / Função</label>
                  <select
                    value={editingUser.perfil}
                    onChange={(e) => {
                      const perf = e.target.value as Perfil;
                      setEditingUser(prev => {
                        if (!prev) return null;
                        const copy = { ...prev, perfil: perf };
                        if (perf === Perfil.Fornecedor && !copy.idObrasFornecedor) {
                          copy.idObrasFornecedor = [];
                        }
                        return copy;
                      });
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-bold text-neutral-805 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans cursor-pointer"
                  >
                    <option value={Perfil.Colaborador}>Colaborador Comum</option>
                    <option value={Perfil.Gestor}>Gestor de Área/Obra</option>
                    <option value={Perfil.Admin}>RH Administrativo (Admin)</option>
                    <option value={Perfil.Fornecedor}>Fornecedor / Restaurante Cozinha</option>
                  </select>
                </div>
              </div>

              {/* Área / Obra Selecionável ou cozinhas atendidas */}
              {editingUser.perfil === Perfil.Fornecedor ? (
                <div className="pt-2">
                  <span className="block text-[10px] text-amber-800 uppercase font-black mb-1.5 font-mono">Associação de Cozinhas (Fornecedor)</span>
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 max-h-[140px] overflow-y-auto space-y-1.5">
                    {obras.map(obra => {
                      const isChecked = editingUser.idObrasFornecedor?.includes(obra.id) ?? false;
                      return (
                        <label key={obra.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-750 font-sans">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEditingUser(prev => {
                                if (!prev) return null;
                                const currentList = prev.idObrasFornecedor || [];
                                const nextList = checked 
                                  ? [...currentList, obra.id]
                                  : currentList.filter(id => id !== obra.id);
                                return { ...prev, idObrasFornecedor: nextList };
                              });
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                          />
                          <span>{obra.nome} <span className="text-[10px] text-neutral-400 font-mono">({obra.centroCusto})</span></span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="text-[9px] text-neutral-400 mt-1 block">O fornecedor visualizará exclusivamente as reservas e retiradas destas cozinhas vinculadas.</span>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Área / Obra</label>
                  <select
                    value={editingUser.idObraPadrao}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, idObraPadrao: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-bold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans cursor-pointer"
                  >
                    {obras.map(ob => (
                      <option key={ob.id} value={ob.id}>{ob.nome} ({ob.centroCusto})</option>
                    ))}
                  </select>
                  <span className="text-[9px] text-neutral-400 mt-1 block">As reservas feitas por este usuário serão debitadas por padrão nesta Área / Obra de lotação.</span>
                </div>
              )}

              {/* Reset Senha e Forçar Troca no Primeiro Acesso */}
              <div className="p-4 bg-emerald-50/20 rounded-lg border border-emerald-100 mt-2">
                <span className="block text-xs font-black uppercase tracking-wide text-neutral-800 flex items-center gap-1.5 font-mono">
                  🔑 Configurar Credenciais e Senha de Acesso
                </span>
                <span className="text-[11px] text-neutral-500 block leading-tight mt-0.5">
                  Atualize a senha do colaborador ou marque-o para forçar uma nova senha no seu próximo login.
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-2 border-t border-neutral-150">
                  <div>
                    <label className="block text-[10px] text-neutral-550 uppercase font-black mb-1">Definir Nova Senha de Acesso</label>
                    <input
                      type="text"
                      value={editingUser.senha || ''}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, senha: e.target.value }) : null)}
                      placeholder="Ex. 1234@ ou FTN2026"
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                    <span className="text-[9px] text-neutral-400 mt-0.5 block">Se alterada, este será o código necessário para o próximo login.</span>
                  </div>

                  <div className="flex items-center">
                    <label className="inline-flex items-center gap-2 cursor-pointer mt-2 md:mt-4">
                      <input
                        type="checkbox"
                        checked={!!editingUser.requerTrocaSenha}
                        onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, requerTrocaSenha: e.target.checked }) : null)}
                        className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <div className="select-none text-left font-sans">
                        <span className="font-bold text-xs text-neutral-800 block">Forçar alteração de senha no primeiro acesso</span>
                        <span className="text-[9px] text-neutral-400 block">Exige que o colaborador cadastre uma nova senha pessoal definitiva.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Mapeamento de Biometria Facial no Cadastro */}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 mt-2">
                <span className="block text-xs font-black uppercase tracking-wide text-neutral-800 flex items-center gap-1.5 font-mono">
                  📸 Biometria Facial Registrada no RH
                </span>
                <span className="text-[11px] text-neutral-500 block leading-tight mt-0.5">
                  Assinatura fotográfica indispensável para a identificação autônoma do colaborador na entrada da cozinha pelo terminal tablet.
                </span>

                <div className="flex flex-col sm:flex-row items-center gap-4 mt-3 bg-white p-3 rounded-md border border-neutral-200">
                  {editingUser.fotoBiometria ? (
                    <div className="relative w-16 h-16 rounded-full border-2 border-emerald-500 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                      <img 
                        src={editingUser.fotoBiometria} 
                        alt="Face biometrics" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-[10px] text-white font-bold" title="Biometria Ativa">
                        ✓
                      </span>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-rose-300 bg-rose-50 flex flex-col items-center justify-center shrink-0">
                      <Smile className="w-6 h-6 text-rose-500 animate-pulse" />
                      <span className="text-[8px] text-rose-600 font-black mt-1">SEM FOTO</span>
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-left">
                    <span className="font-bold text-xs block text-neutral-800">
                      {editingUser.fotoBiometria 
                        ? "Mapeamento Biométrico Ativo" 
                        : "Aguardando Captura Facial"
                      }
                    </span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      {editingUser.fotoBiometria 
                        ? "A imagem foi gravada em conformidade com as diretivas de segurança." 
                        : "Este colaborador ainda não realizou o pré-cadastro biométrico obrigatório."
                      }
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCaptureTarget({ id: editingUser.id, type: 'editing' });
                    }}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" /> 
                    {editingUser.fotoBiometria ? "Recadastrar com Câmera" : "Capturar Foto Real"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="bg-neutral-50 px-6 py-4 flex justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100 rounded text-xs font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingUser) {
                    if (!editingUser.nome.trim()) {
                      alert('Por favor, preencha o Nome Completo.');
                      return;
                    }
                    if (!editingUser.matricula.trim()) {
                      alert('Por favor, defina a Matrícula do funcionário.');
                      return;
                    }
                    const rawCpf = editingUser.cpf.replace(/\D/g, '');
                    if (!editingUser.cpf.trim() || rawCpf.length !== 11) {
                      alert('O CPF deve conter exatamente 11 dígitos numéricos.');
                      return;
                    }
                    if (editingUser.email && !editingUser.email.includes('@')) {
                      alert('Por favor, insira um endereço de E-mail válido.');
                      return;
                    }
                    onSaveUser(editingUser);
                    setEditingUser(null);
                  }
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Gravar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetReservasModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="clear-reservas-modal">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-6 space-y-4 text-left">
              <div className="flex items-start gap-3 text-red-600">
                <div className="bg-red-100 p-2 rounded-full shrink-0">
                  <ShieldAlert className="w-6 h-6 text-red-700" />
                </div>
                <div>
                  <h4 className="font-extrabold text-neutral-900 text-sm uppercase tracking-wider font-mono">⚠️ Opções de Limpeza de Reservas</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Selecione o escopo da exclusão permanente das reservas de refeições. Nossos cadastros de colaboradores e terceirizadas serão mantidos intactos.
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetReservasModal(false);
                    onClearAllReservas('future');
                  }}
                  className="w-full p-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-left transition-all flex flex-col gap-1 cursor-pointer"
                >
                  <span className="font-black text-xs uppercase tracking-wider">🗓️ 1. Somente de Hoje em Diante</span>
                  <span className="text-[10.5px] text-amber-800 font-medium normal-case leading-relaxed">
                    Preserva o histórico de refeições consumidas e apaga apenas as reservas agendadas para hoje e datas futuras. Ideal para ajustes no cardápio.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowResetReservasModal(false);
                    onClearAllReservas('all');
                  }}
                  className="w-full p-4 bg-red-50 hover:bg-red-105 text-red-900 border border-red-200 rounded-lg text-left transition-all flex flex-col gap-1 cursor-pointer"
                >
                  <span className="font-black text-xs uppercase tracking-wider text-red-800">🗑️ 2. Limpeza COMPLETA de Histórico (TUDO)</span>
                  <span className="text-[10.5px] text-red-700 font-medium normal-case leading-relaxed">
                    Exclui 100% das reservas (histórico de consumo realizado no passado e agendamentos futuros). Ação de manutenção total.
                  </span>
                </button>
              </div>
            </div>

            <div className="bg-neutral-50 px-6 py-3.5 flex justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowResetReservasModal(false)}
                className="px-4 py-1.5 border border-neutral-300 text-neutral-750 bg-white hover:bg-neutral-100 rounded text-xs font-bold cursor-pointer transition-colors"
              >
                Voltar / Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Lightbox Overlay */}
      {activeCaptureTarget && (
        <CameraCapture
          onCapture={(base64) => {
            if (activeCaptureTarget.type === 'pending') {
              updateFormValue(activeCaptureTarget.id, 'fotoBiometria', base64);
            } else {
              setEditingUser(prev => prev ? { ...prev, fotoBiometria: base64 } : null);
            }
            setActiveCaptureTarget(null);
          }}
          onCancel={() => setActiveCaptureTarget(null)}
          title={`Biometria Facial - ${
            activeCaptureTarget.type === 'pending'
              ? (usuarios.find(u => u.id === activeCaptureTarget.id)?.nome || 'Pendente')
              : (editingUser?.nome || 'Colaborador')
          }`}
          subTitle="Registre a imagem facial do colaborador com nitidez e foco centralizado"
        />
      )}

      {/* Custom Resilient User Deletion Confirmation Modal */}
      {userToConfirmDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in" id="confirm-user-delete-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-6 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="bg-rose-100 p-2.5 rounded-full shrink-0">
                  <ShieldAlert className="w-6 h-6 text-rose-700 font-bold" />
                </div>
                <div>
                  <h4 className="font-extrabold text-rose-900 text-sm uppercase tracking-wider font-mono">⚠️ Confirmação Crítica de Exclusão</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Esta ação é definitiva e removerá permanentemente o colaborador e seu histórico do SGR.
                  </p>
                </div>
              </div>

              <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-100 space-y-2 text-xs">
                <div>
                  <span className="font-bold text-neutral-500 uppercase text-[9px] block">Nome completo:</span>
                  <span className="font-black text-neutral-850 text-xs">{userToConfirmDelete.nome}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-bold text-neutral-500 uppercase text-[9px] block">Matrícula:</span>
                    <span className="font-bold text-neutral-800 font-mono">{userToConfirmDelete.matricula || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-neutral-500 uppercase text-[9px] block">CPF:</span>
                    <span className="font-bold text-neutral-800 font-mono">
                      {userToConfirmDelete.cpf ? userToConfirmDelete.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-neutral-600 font-medium leading-relaxed bg-neutral-50 p-3 rounded border border-neutral-200 font-sans">
                Ao excluir o cadastro, <strong>todas as reservas futuras e o histórico</strong> de consumo desse colaborador serão expurgados da base de dados Firestore de forma segura. Essa operação <strong>NÃO</strong> pode ser desfeita.
              </p>
            </div>

            <div className="bg-neutral-50 px-6 py-3.5 flex justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setUserToConfirmDelete(null)}
                className="px-4 py-1.5 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100 rounded text-xs font-bold cursor-pointer transition-colors font-sans"
                id="cancel-del-modal-btn"
              >
                Voltar / Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteUser) {
                    onDeleteUser(userToConfirmDelete.id);
                  }
                  setUserToConfirmDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold cursor-pointer transition-colors shadow-sm font-sans flex items-center gap-1"
                id="confirm-del-modal-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sim, Excluir Cadastro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
