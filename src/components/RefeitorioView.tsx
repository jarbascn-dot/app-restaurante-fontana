/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Usuario, Reserva, ReservaStatus, Obra, Empresa, SystemSettings } from '../types';
import { Tablet, ScanFace, Search, AlertCircle, AlertTriangle, CheckSquare, Sparkles, SlidersHorizontal, BookOpen, Volume2, Smile } from 'lucide-react';

interface RefeitorioViewProps {
  reservas: Reserva[];
  usuarios: Usuario[];
  obras: Obra[];
  empresas: Empresa[];
  settings: SystemSettings;
  onConfirmWithdrawal: (idUsuario: string, date: string, excessFee: boolean) => void;
}

export default function RefeitorioView({
  reservas,
  usuarios,
  obras,
  empresas,
  settings,
  onConfirmWithdrawal,
}: RefeitorioViewProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [scanningUser, setScanningUser] = useState<Usuario | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'warning' | 'error'>('idle');
  
  // Custom tablet sound triggers
  const [beepMessage, setBeepMessage] = useState<string | null>(null);

  const reportDate = '2026-06-13'; // Hoje em nosso sistema
  
  const getObra = (id: string) => obras.find(o => o.id === id);
  const getEmpresa = (id: string) => empresas.find(e => e.id === id);

  // Filter only employees with reservations for today
  const reservedUserIdsToday = reservas
    .filter(r => r.data === reportDate && r.status === ReservaStatus.Reservado)
    .map(r => r.idUsuario);

  // All active/approved employees
  const approvedColaboradores = usuarios.filter(u => (u.perfil === 'colaborador' || u.perfil === 'admin') && u.status !== 'desativado');

  // Compute production statistics
  const totalReservadosHoje = reservedUserIdsToday.length;
  const retiradosHoje = reservas.filter(
    r => r.data === reportDate && r.status === ReservaStatus.Reservado && (r.consumido || !settings.usarTabletRetirada)
  ).length;
  const restanteHoje = totalReservadosHoje - retiradosHoje;

  // Search filter
  const filteredColabs = approvedColaboradores.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const triggerFacialScan = (user: Usuario) => {
    setScanningUser(user);
    setScanStatus('scanning');
    
    const isReserved = reservedUserIdsToday.includes(user.id);
    const hasPhoto = !!user.fotoBiometria;
    
    if (!settings.requererBiometriaFacial) {
      // Fast simulation of keypad pin or badge tap approval (400ms)
      setTimeout(() => {
        if (isReserved) {
          setScanStatus('success');
          onConfirmWithdrawal(user.id, reportDate, false);
          triggerBuzzer('success', `Confirmado via Crachá / Matrícula para ${user.nome}! Marmita liberada.`);
        } else {
          setScanStatus('warning');
          triggerBuzzer('warning', `ALERTA: ${user.nome} NÃO possui reserva hoje!`);
        }
      }, 450);
    } else {
      // Fully simulated biometric camera scan mapping (1500ms)
      setTimeout(() => {
        if (!hasPhoto) {
          setScanStatus('error');
          triggerBuzzer('warning', `ACESSO RECUSADO: Colaborador ${user.nome} não possui Biometria Facial cadastrada no RH!`);
        } else if (isReserved) {
          setScanStatus('success');
          onConfirmWithdrawal(user.id, reportDate, false);
          triggerBuzzer('success', `Reconhecimento Facial VÁLIDO para ${user.nome}! Marmita liberada.`);
        } else {
          setScanStatus('warning');
          triggerBuzzer('warning', `ALERTA: ${user.nome} NÃO possui reserva hoje!`);
        }
      }, 1550);
    }
  };

  const triggerBuzzer = (type: 'success' | 'warning', message: string) => {
    setBeepMessage(message);
    // Visual alert flash
    setTimeout(() => setBeepMessage(null), 4000);
  };

  const handleManualExcessBooking = () => {
    if (!scanningUser) return;
    onConfirmWithdrawal(scanningUser.id, reportDate, true);
    setScanStatus('success');
    triggerBuzzer('success', `Marmita Liberada como excedente de obra para ${scanningUser.nome}. Taxado!`);
    setTimeout(() => {
      setScanningUser(null);
      setScanStatus('idle');
    }, 2000);
  };

  const handleAutoFaceScan = () => {
    if (!settings.usarTabletRetirada) {
      alert("A validação eletrônica (Tablet) de retiradas de refeição está desabilitada nos Parâmetros do RH.");
      return;
    }
    
    // Filtra colaboradores ativos
    const activeColabs = approvedColaboradores;
    if (activeColabs.length === 0) {
      alert("Nenhum colaborador elegível cadastrado para simular biometria.");
      return;
    }

    // Filtra os que ainda não receberam marmita hoje
    const unconsumedColabs = activeColabs.filter(u => {
      const resObj = reservas.find(r => r.idUsuario === u.id && r.data === reportDate);
      const isConsumed = resObj && resObj.status === ReservaStatus.Reservado && (resObj.consumido || !settings.usarTabletRetirada);
      return !isConsumed;
    });

    if (unconsumedColabs.length === 0) {
      alert("Todos os colaboradores ativos já efetuaram o consumo de refeição hoje!");
      return;
    }

    // Dar preferência (85% chance) a quem TEM reserva hoje para demonstrar fluxo de sucesso perfeito
    const pendingWithReservation = unconsumedColabs.filter(u => reservedUserIdsToday.includes(u.id));
    
    let chosenUser: Usuario;
    if (pendingWithReservation.length > 0 && Math.random() < 0.85) {
      const randomIndex = Math.floor(Math.random() * pendingWithReservation.length);
      chosenUser = pendingWithReservation[randomIndex];
    } else {
      const randomIndex = Math.floor(Math.random() * unconsumedColabs.length);
      chosenUser = unconsumedColabs[randomIndex];
    }

    triggerFacialScan(chosenUser);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="refeitorio-tablet-view">
      
      {/* Right Column: Dynamic Camera / Scanner Simulated Interface */}
      <div className="bg-neutral-900 text-white p-6 rounded-xl border border-neutral-800 shadow-xl flex flex-col justify-between" id="facial-scanner-module">
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-neutral-800">
            <span className="flex items-center gap-1 text-[11px] font-mono tracking-wider text-emerald-400">
              <Tablet className="h-4 w-4" /> MONITOR DO REFEITÓRIO (COZINHA)
            </span>
            <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest font-mono">
              Terminal Ativo
            </span>
          </div>

          {/* Simulated scanning feed window */}
          <div className="relative border-2 border-neutral-800 rounded-lg aspect-square bg-gradient-to-t from-neutral-950 to-neutral-900 flex flex-col items-center justify-center overflow-hidden">
            
            {/* Overlay Grid scanning lines */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,18,18,0)_95%,#10B981_95%)] bg-[length:100%_40px] animate-[pulse_2.5s_infinite]" />

            {scanStatus === 'idle' && (
              <div className="text-center p-6 space-y-4" id="scan-idle-feed">
                <div className="bg-neutral-850 p-4 rounded-full inline-block text-neutral-400">
                  <ScanFace className="h-12 w-12 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-200">
                    Leitor Facial Ativo
                  </h4>
                  <p className="text-xs text-neutral-550 max-w-xs mx-auto leading-relaxed">
                    Aproxime o rosto para identificar o colaborador de forma autônoma pelo sensor da câmera.
                  </p>
                </div>
                
                <button
                  onClick={handleAutoFaceScan}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white rounded-xl transition shadow-md flex items-center gap-1.5 mx-auto cursor-pointer"
                  id="trigger-auto-scan-btn"
                >
                  <ScanFace className="h-4 w-4" />
                  <span>Aproximar Rosto</span>
                </button>
              </div>
            )}

            {scanStatus === 'scanning' && scanningUser && (
              <div className="text-center space-y-3 relative z-10 p-6" id="scan-loading-feed">
                <div className="inline-block relative">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <div className="bg-neutral-850 p-6 rounded-full text-emerald-400 m-1">
                    <ScanFace className="h-14 w-14" />
                  </div>
                </div>
                <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                  {settings.requererBiometriaFacial ? 'Mapeando Triângulos Faciais...' : 'Registrando Acesso via Crachá / Senha...'}
                </p>
                <div className="text-xs text-neutral-300">
                  <span className="text-neutral-500">Alvo:</span> <strong>{scanningUser.nome}</strong> (CC: {getObra(scanningUser.idObraPadrao)?.centroCusto})
                </div>
              </div>
            )}

            {scanStatus === 'success' && scanningUser && (
              <div className="text-center p-6 space-y-4" id="scan-success-feed">
                <div className="bg-emerald-500 text-neutral-950 p-5 rounded-full inline-block animate-[bounce_0.6s_ease_1]">
                  <ScanFace className="h-14 w-14" />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono rounded font-bold uppercase tracking-wider mb-2">
                    {settings.requererBiometriaFacial ? 'BIOMETRIA VÁLIDA' : 'MARMITA LIBERADA'}
                  </span>
                  <h4 className="text-emerald-400 text-lg font-bold">{scanningUser.nome}</h4>
                  <p className="text-xs text-neutral-400 mt-1 font-mono">Matrícula: {scanningUser.matricula}</p>
                </div>
                <button
                  onClick={() => {
                    setScanningUser(null);
                    setScanStatus('idle');
                  }}
                  className="px-4 py-1.5 bg-neutral-800 text-neutral-300 rounded text-xs hover:bg-neutral-700 transition"
                >
                  Voltar ao Sensor
                </button>
              </div>
            )}

            {scanStatus === 'error' && scanningUser && (
              <div className="text-center p-5 space-y-3 bg-red-955/25 absolute inset-0 flex flex-col justify-center items-center" id="scan-error-feed">
                <div className="bg-rose-100 text-rose-900 p-4 rounded-full animate-bounce">
                  <AlertCircle className="h-10 w-10 text-rose-700" />
                </div>
                
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold font-mono tracking-wider">
                    BIOMETRIA INEXISTENTE (REJEITADO)
                  </span>
                  <h4 className="text-rose-450 text-sm font-extrabold mt-2">{scanningUser.nome}</h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed max-w-xs mx-auto">
                    A identificação falhou porque este colaborador <strong>não possui pré-cadastro facial</strong> homologado no RH.
                  </p>
                  <p className="text-[10px] text-amber-400 font-bold font-sans mt-2">
                    ⚠️ Procure o setor de RH para realizar o cadastro facial.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-xs pt-3">
                  <button
                    onClick={() => {
                      setScanningUser(null);
                      setScanStatus('idle');
                    }}
                    className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-305 text-xs rounded font-bold transition-colors"
                  >
                    Voltar ao Sensor
                  </button>
                </div>
              </div>
            )}

            {scanStatus === 'warning' && scanningUser && (
              <div className="text-center p-5 space-y-3 bg-red-950/20 absolute inset-0 flex flex-col justify-center items-center" id="scan-warning-feed">
                <div className="bg-amber-100 text-amber-900 p-4 rounded-full animate-bounce">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                
                <div className="space-y-1">
                  <span className="inline-block px-2 text-[10px] bg-amber-500 text-neutral-950 rounded font-bold font-mono">
                    USÚARIO SEM RESERVA PARA HOJE
                  </span>
                  <h4 className="text-neutral-200 text-sm font-bold mt-1">{scanningUser.nome}</h4>
                  <p className="text-[11px] text-neutral-400">Ele pertence originalmente à empresa <strong>{getEmpresa(scanningUser.idEmpresa)?.nome}</strong>.</p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
                  <button
                    onClick={handleManualExcessBooking}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs rounded shadow transition-colors"
                  >
                    Permitir como Consumo Excedente
                  </button>
                  <button
                    onClick={() => {
                      setScanningUser(null);
                      setScanStatus('idle');
                    }}
                    className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-400 text-xs rounded transition-colors"
                  >
                    Recusar Prato
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Virtual checkout voice/buzzer flash alert */}
          {beepMessage && (
            <div className="p-3 bg-neutral-800 border-l-4 border-yellow-500 text-white text-xs font-mono rounded flex items-center gap-2 animate-pulse">
              <Volume2 className="h-4 w-4 text-yellow-400 shrink-0" />
              <span>🔊 **Tablet Beep:** {beepMessage}</span>
            </div>
          )}
        </div>

        {/* Integration indicators */}
        <div className="pt-4 border-t border-neutral-800 text-[10px] text-neutral-500 flex justify-between">
          <span>Camera: Integrado (Simulado)</span>
          <span>Buzzer: Ligado</span>
        </div>
      </div>

      {/* Left Columns: Today's booked list / Search for employees */}
      <div className="lg:col-span-2 space-y-6" id="tablet-list-container">
        
        {!settings.usarTabletRetirada && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-800 space-y-1.5 shadow-sm" id="tablet-suspended-alert">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Atenção: Validação Eletrônica Desativada</span>
            </div>
            <p className="leading-relaxed">
              O administrador desativou a obrigatoriedade do Tablet de retirada nos Parâmetros do RH. Todas as reservas ativas geraram <strong>presenças automáticas e faturamento integral</strong>. Use a <strong className="underline">Folha de Assinatura física</strong> no menu de relatórios para coletar as assinaturas manuais.
            </p>
          </div>
        )}

        {/* Production Metrics Counters */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm grid grid-cols-3 gap-3">
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
            <span className="block text-[10px] font-mono text-neutral-500 uppercase">1. Previstas Hoje</span>
            <span className="text-xl font-extrabold text-neutral-900 mt-1 block font-mono">{totalReservadosHoje} Marmitas</span>
          </div>
          
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <span className="block text-[10px] font-mono text-emerald-600 uppercase">2. Já Retiradas</span>
            <span className="text-xl font-extrabold text-emerald-800 mt-1 block font-mono">{retiradosHoje} Pratos</span>
          </div>

          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
            <span className="block text-[10px] font-mono text-neutral-500 uppercase">3. Saldo Restante</span>
            <span className="text-xl font-extrabold text-neutral-700 mt-1 block font-mono">{restanteHoje} Esperados</span>
          </div>
        </div>

        {/* Workers grid checkin list */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4" id="operators-checkout-list">
          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div>
              <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-wide">Monitor de Entrada e Consumo</h4>
              <p className="text-xs text-neutral-500">O leitor facial identifica o colaborador de forma 100% autônoma pela câmera. Use a lista abaixo como consulta rápida ou validação manual facultativa.</p>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Digitar nome, matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-neutral-300 rounded text-xs bg-white text-neutral-800 focus:outline-none w-full sm:w-60"
                id="search-checkout-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1" id="refeitorio-grid-checkout">
            {filteredColabs.map((user) => {
              const isReserved = reservedUserIdsToday.includes(user.id);
              const resObj = reservas.find(r => r.idUsuario === user.id && r.data === reportDate);
              const isConsumed = resObj && resObj.status === ReservaStatus.Reservado && (resObj.consumido || !settings.usarTabletRetirada);
              const emp = getEmpresa(user.idEmpresa);
              const obr = getObra(user.idObraPadrao);

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    if (!settings.usarTabletRetirada) {
                      alert(`A validação eletrônica (Tablet) de retiradas está desabilitada nos Parâmetros do RH. Colaboradores têm a refeição confirmada automaticamente através da folha impressa de assinaturas.`);
                      return;
                    }
                    if (isConsumed) {
                      alert(`Este colaborador (${user.nome}) já efetuou a retirada com biometria facial hoje.`);
                      return;
                    }
                    triggerFacialScan(user);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all relative ${
                    isConsumed
                      ? 'bg-emerald-50 border-emerald-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-neutral-200 hover:border-neutral-400 hover:shadow-xs cursor-pointer'
                  }`}
                  id={`checkout-card-${user.id}`}
                >
                  <div className="flex gap-3 items-center">
                    {user.fotoBiometria ? (
                      <img 
                        src={user.fotoBiometria} 
                        alt="Foto Bio" 
                        className="w-10 h-10 rounded-full border-2 border-emerald-500 bg-neutral-100 object-cover shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-dashed border-rose-300 bg-rose-50 flex items-center justify-center shrink-0" title="Sem Biometria">
                        <Smile className="w-5 h-5 text-rose-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 leading-none">
                        <span className="text-[9px] font-mono text-neutral-450">Mat: {user.matricula}</span>
                        {user.fotoBiometria ? (
                          <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded font-black font-mono border border-emerald-150">BIO ✓</span>
                        ) : (
                          <span className="text-[8px] bg-rose-50 text-rose-700 px-1 py-0.2 rounded font-black font-mono border border-rose-150">SEM BIO</span>
                        )}
                      </div>
                      <h5 className="font-bold text-neutral-800 text-xs mt-0.5 truncate">{user.nome}</h5>
                      <span className="text-[9px] text-neutral-500 block truncate leading-none">{emp?.nome}</span>
                      <span className="text-[9px] text-neutral-450 block truncate mt-0.5">🏠 Obra: {obr?.nome}</span>
                    </div>

                    <div className="shrink-0 flex items-start self-start">
                      {isConsumed ? (
                        <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] font-bold uppercase rounded font-mono">
                          CONFIRMADO
                        </span>
                      ) : isReserved ? (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-mono font-bold rounded">
                          RESERVADO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[8px] font-mono font-bold rounded">
                          SEM RESERVA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-neutral-50 rounded-lg text-[10px] text-neutral-600 border border-neutral-150 leading-relaxed font-sans">
            📌 **Sobre o Validador Biométrico:** Esta seção gerencia o consumo na cozinha da obra com leitores faciais. Quando o trabalhador se aproxima, a câmera valida se ele tem reserva ativa. Se sim, libera o prato de almoço. Caso de divergência de reserva, o sistema registra como Refeição Excedente, gerando rateio de custo extra automático para a obra do trabalhador.
          </div>
        </div>
      </div>

    </div>
  );
}
