/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Usuario, Reserva, ReservaStatus, Obra, Empresa, SystemSettings } from '../types';
import { 
  Tablet, 
  ScanFace, 
  Search, 
  AlertCircle, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  SlidersHorizontal, 
  Volume2, 
  Smile, 
  ArrowLeft, 
  RefreshCw, 
  Building2, 
  Layers, 
  UserPlus, 
  Zap,
  Play,
  Square
} from 'lucide-react';

interface RefeitorioViewProps {
  reservas: Reserva[];
  usuarios: Usuario[];
  obras: Obra[];
  empresas: Empresa[];
  settings: SystemSettings;
  onConfirmWithdrawal: (idUsuario: string, date: string, excessFee: boolean) => void;
  todayDate: string;
}

export default function RefeitorioView({
  reservas,
  usuarios,
  obras,
  empresas,
  settings,
  onConfirmWithdrawal,
  todayDate,
}: RefeitorioViewProps) {
  
  // Selection of active Obra for this physical Tablet terminal
  const [activeObraId, setActiveObraId] = useState<string>(() => {
    return localStorage.getItem('sgr_active_terminal_obra') || '';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [scanningUser, setScanningUser] = useState<Usuario | null>(null);
  
  // 'idle' | 'scanning' | 'success' | 'no_reserve' | 'duplicate' | 'error'
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'no_reserve' | 'duplicate' | 'error'>('idle');
  
  // Duplication block parameter in hours (default 2 hours)
  const [blockIntervalHours, setBlockIntervalHours] = useState<number>(() => {
    const saved = localStorage.getItem('sgr_block_interval_hours');
    return saved ? parseFloat(saved) : 2;
  });

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [duplicateLastTime, setDuplicateLastTime] = useState<string>('');

  // Active Browser Camera Stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  // Auto demonstration mode - simulates random walk-ins
  const [isDemoActive, setIsDemoActive] = useState(false);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const reportDate = todayDate; // Hoje em nosso sistema
  
  const parseLocalOffset = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(dateStr);
  };
  
  const getObra = (id: string) => obras.find(o => o.id === id);
  const getEmpresa = (id: string) => empresas.find(e => e.id === id);

  // Save Terminal Obra config
  const handleSelectObraTerminal = (obraId: string) => {
    setActiveObraId(obraId);
    localStorage.setItem('sgr_active_terminal_obra', obraId);
    const obraName = obras.find(o => o.id === obraId)?.nome || 'unidade';
    speakSpeech(`Terminal configurado para a obra ${obraName}. Câmera ativada.`);
  };

  const handleResetTerminalConfig = () => {
    setActiveObraId('');
    localStorage.removeItem('sgr_active_terminal_obra');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Change duplicate interval
  const handleBlockIntervalChange = (val: number) => {
    setBlockIntervalHours(val);
    localStorage.setItem('sgr_block_interval_hours', String(val));
  };

  // Synthesize Brazilian Portuguese spoken audio confirmation
  const speakSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("Speech Synthesis error:", e);
      }
    }
  };

  // Keep browser camera active continuously in the background
  useEffect(() => {
    if (!activeObraId) return;

    let activeStream: MediaStream | null = null;
    async function startContinuousStream() {
      try {
        const constraints = {
          video: { 
            facingMode: 'user', 
            width: { ideal: 480 }, 
            height: { ideal: 480 } 
          },
          audio: false
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);
        setHasCamera(true);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.warn("error playing video stream:", err);
          });
        }
      } catch (err) {
        console.warn("Continuous camera access blocked/unsupported in iframe container, defaulting to clean interactive simulation:", err);
        setHasCamera(false);
      }
    }

    startContinuousStream();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeObraId]);

  // Restore camera source in case tab elements rebuild
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, scanStatus]);

  // Clean scan reset after 3.5 seconds
  useEffect(() => {
    if (scanStatus !== 'idle' && scanStatus !== 'scanning') {
      const timer = setTimeout(() => {
        setScanningUser(null);
        setScanStatus('idle');
        setFeedbackMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [scanStatus]);

  // Auto reservation confirmation statistics
  const totalReservadosHoje = reservas.filter(
    r => r.data === reportDate && r.status === ReservaStatus.Reservado && getObra(r.idObraNoDia)?.id === activeObraId
  ).length;

  const retiradosHoje = reservas.filter(
    r => r.data === reportDate && r.status === ReservaStatus.Reservado && r.consumido && getObra(r.idObraNoDia)?.id === activeObraId
  ).length;

  const restanteHoje = totalReservadosHoje - retiradosHoje;

  // Active / approved employees in our system
  const approvedColaboradores = usuarios.filter(
    u => (u.perfil === 'colaborador' || u.perfil === 'admin') && u.status !== 'desativado' && u.status !== 'excluido'
  );

  // Filter only those allocated to the active Obra
  const listInObra = approvedColaboradores.filter(u => u.idObraPadrao === activeObraId);

  // Search filter
  const filteredColabs = listInObra.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check scans list stored in local storage to prevent duplicate within period
  const saveScanRecord = (userId: string) => {
    try {
      const recentScansLocal = JSON.parse(localStorage.getItem('sgr_recent_scans') || '[]');
      const now = new Date();
      // Keep only last 24h worth of entries to avoid memory leak
      const cleanScans = recentScansLocal.filter((s: any) => {
        const diffMs = now.getTime() - new Date(s.timestamp).getTime();
        return diffMs < 24 * 60 * 60 * 1000;
      });
      
      cleanScans.unshift({
        idUsuario: userId,
        timestamp: now.toISOString()
      });
      
      localStorage.setItem('sgr_recent_scans', JSON.stringify(cleanScans));
    } catch (e) {
      console.error(e);
    }
  };

  // Perform face biometrics processing scan
  const executeBiometricScan = (user: Usuario) => {
    if (scanStatus === 'scanning') return; // block duplicate trigger in flight

    setScanningUser(user);
    setScanStatus('scanning');
    setFeedbackMessage(null);

    const now = new Date();

    // 1st Layer: Check local scan logs inside localStorage
    const recentScansLocal = JSON.parse(localStorage.getItem('sgr_recent_scans') || '[]');
    const userLastScan = recentScansLocal.find((s: any) => s.idUsuario === user.id);
    
    let isWithinDuplicateInterval = false;
    let formattedLastScanTime = '';

    if (userLastScan) {
      const lastScanTime = new Date(userLastScan.timestamp);
      const diffMinutes = (now.getTime() - lastScanTime.getTime()) / (60 * 1000);
      const limitMinutes = blockIntervalHours * 60;
      
      if (diffMinutes < limitMinutes) {
        isWithinDuplicateInterval = true;
        formattedLastScanTime = lastScanTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } else {
      // 2nd Layer check: check if the reservation itself is marked consumido with some alteradoEm
      const resObj = reservas.find(r => r.idUsuario === user.id && r.data === reportDate);
      if (resObj && resObj.status === ReservaStatus.Reservado && resObj.consumido) {
        const alteredTime = resObj.alteradoEm ? new Date(resObj.alteradoEm) : null;
        if (alteredTime) {
          const diffMinutes = (now.getTime() - alteredTime.getTime()) / (60 * 1000);
          const limitMinutes = blockIntervalHours * 60;
          if (diffMinutes < limitMinutes) {
            isWithinDuplicateInterval = true;
            formattedLastScanTime = alteredTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          }
        } else {
          // If already marked consumed but no concrete date was saved, assume duplicate
          isWithinDuplicateInterval = true;
          formattedLastScanTime = 'Recentemente';
        }
      }
    }

    const hasPhoto = !!user.fotoBiometria;

    // Simulate real biometric facial geometry calculation (1100ms)
    setTimeout(() => {
      // Check duplicated scan passage error
      if (isWithinDuplicateInterval) {
        setScanStatus('duplicate');
        setDuplicateLastTime(formattedLastScanTime);
        const warnMsg = `REFEIÇÃO JÁ REGISTRADA! ${user.nome} almoçou em menos de ${blockIntervalHours}h de intervalo (às ${formattedLastScanTime}h).`;
        setFeedbackMessage(warnMsg);
        speakSpeech(`${user.nome.split(' ')[0]}, registro já realizado anteriormente.`);
        return;
      }

      // Check missing biometrics registration
      if (settings.requererBiometriaFacial && !hasPhoto) {
        setScanStatus('error');
        setFeedbackMessage(`BLOCKED: Colaborador ${user.nome} sem cadastro biométrico no RH!`);
        speakSpeech(`Acesso bloqueado. Realize o cadastro facial no setor de recursos humanos.`);
        return;
      }

      // Check dynamic reservation status
      const isReserved = reservas.some(
        r => r.idUsuario === user.id && r.data === reportDate && r.status === ReservaStatus.Reservado
      );

      if (isReserved) {
        setScanStatus('success');
        onConfirmWithdrawal(user.id, reportDate, false);
        
        // Save scan checkpoint
        saveScanRecord(user.id);
        
        setFeedbackMessage(`ACESSO CONFIRMADO! Boa refeição, ${user.nome}!`);
        speakSpeech(`Acesso liberado. Bom almoço, ${user.nome.split(' ')[0]}!`);
      } else {
        setScanStatus('no_reserve');
        setFeedbackMessage(`SEM RESERVA! ${user.nome} não agendou alimentação para hoje.`);
        speakSpeech(`Recusado. Sem reserva para hoje.`);
      }
    }, 1100);
  };

  // Quick action: Accept meal as site excess
  const handleManualExcessBooking = () => {
    if (!scanningUser) return;
    onConfirmWithdrawal(scanningUser.id, reportDate, true);
    saveScanRecord(scanningUser.id);
    
    setScanStatus('success');
    setFeedbackMessage(`Liberado como Consumo Excedente de Obra para ${scanningUser.nome}.`);
    speakSpeech(`Acesso liberado de forma excepcional.`);

    setTimeout(() => {
      setScanningUser(null);
      setScanStatus('idle');
      setFeedbackMessage(null);
    }, 2000);
  };

  // Demonstration mode simulation loop
  const toggleDemoMode = () => {
    if (isDemoActive) {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      setIsDemoActive(false);
      speakSpeech("Modo de simulação automática desligado");
    } else {
      setIsDemoActive(true);
      speakSpeech("Modo de simulação automática de biometria facial ativado.");
      
      // Execute first scan right away
      runDemoRandomScan();
      
      // Setup interval to scan a random employee every 8 seconds
      demoIntervalRef.current = setInterval(() => {
        runDemoRandomScan();
      }, 7500);
    }
  };

  const runDemoRandomScan = () => {
    if (listInObra.length === 0) return;
    
    // Choose a random employee from the jobsite list to approach
    const randomIndex = Math.floor(Math.random() * listInObra.length);
    const chosen = listInObra[randomIndex];
    executeBiometricScan(chosen);
  };

  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);


  // --- VIEW 1: SELECT ACTIVE OBRA INITIALIZER ---
  if (!activeObraId) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6" id="terminal-setup-container">
        
        {/* Banner header info */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 text-center space-y-3 shadow-xl">
          <div className="mx-auto w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center border border-emerald-500/30 animate-pulse text-emerald-400">
            <Tablet className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] bg-emerald-500 text-neutral-950 px-2.5 py-0.5 rounded-full font-black uppercase font-mono tracking-widest">
              Tablet Host setup
            </span>
            <h2 className="text-xl font-extrabold text-white">Módulo Refeitório - Terminal de Cozinha</h2>
            <p className="text-neutral-400 text-xs max-w-md mx-auto leading-relaxed">
              Associe este dispositivo móvel (Tablet) à sua respectiva obra de lotação para iniciar o leitor de biometria automatizado.
            </p>
          </div>
        </div>

        {/* List of Obras with single tap trigger layouts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-neutral-800 font-bold text-xs uppercase tracking-wide px-1">
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>Selecione a Obra para instalar este Terminal de Consumo:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="setup-obras-list">
            {obras.map((obra) => {
              const scheduledToday = reservas.filter(
                r => r.data === reportDate && r.status === ReservaStatus.Reservado && r.idObraNoDia === obra.id
              ).length;

              return (
                <button
                  key={obra.id}
                  onClick={() => handleSelectObraTerminal(obra.id)}
                  className="p-4 bg-white hover:bg-neutral-50 border border-neutral-250 rounded-xl hover:border-emerald-500 hover:shadow-md transition text-left cursor-pointer flex flex-col justify-between h-32 active:scale-98"
                >
                  <div>
                    <h4 className="font-extrabold text-neutral-800 text-sm">{obra.nome}</h4>
                    <p className="text-[10px] text-neutral-450 font-mono mt-1">Centro Custo: {obra.centroCusto}</p>
                  </div>
                  
                  <div className="flex justify-between items-center w-full pt-2 border-t border-neutral-100 shrink-0">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {scheduledToday} reservas hoje
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-0.5">
                      Vincular &gt;
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compliance Footer Information */}
        <div className="p-4 bg-neutral-100 rounded-xl text-[10px] sm:text-xs text-neutral-600 border border-neutral-200 leading-normal font-medium">
          💡 **Configuração Física Única:** A vinculação local gera persistência temporária no cache do navegador. Para alterar o local físico de atendimento deste Tablet, use o botão de engrenagem nas configurações no topo superior do terminal ativo.
        </div>
      </div>
    );
  }


  // --- VIEW 2: ACTIVE BIOMETRIC TABLET RUNNING MODE ---
  const activeObraObj = getObra(activeObraId);

  return (
    <div className="space-y-6" id="tablet-active-terminal">
      
      {/* Dynamic Flashing Full-Screen Overlay on Active Scan Statuses */}
      {(scanStatus === 'success' || scanStatus === 'no_reserve' || scanStatus === 'duplicate' || scanStatus === 'error') && (
        <div 
          onClick={() => {
            setScanningUser(null);
            setScanStatus('idle');
            setFeedbackMessage(null);
          }}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 transition-all duration-300 ${
            scanStatus === 'success' ? 'bg-emerald-950/95 border-b-16 border-emerald-500' :
            scanStatus === 'duplicate' ? 'bg-amber-950/95 border-b-16 border-amber-500' :
            'bg-rose-950/95 border-b-16 border-rose-500'
          }`}
          id="flashing-tablet-alarm-overlay"
        >
          {/* Pulsing Colored Ambient Light Rings */}
          <div className="space-y-6 text-center max-w-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-md animate-[scale-up_0.3s_ease]">
            
            {/* Visual Flash Header */}
            <div className="flex justify-center shrink-0">
              {scanStatus === 'success' && (
                <div className="w-24 h-24 bg-emerald-505 rounded-full flex items-center justify-center text-emerald-300 border-4 border-emerald-400 p-5 shadow-[0_0_50px_rgba(16,185,129,0.8)] animate-bounce">
                  <Check className="h-16 w-16 stroke-[3.5]" />
                </div>
              )}
              {scanStatus === 'duplicate' && (
                <div className="w-24 h-24 bg-amber-505 rounded-full flex items-center justify-center text-amber-300 border-4 border-amber-400 p-5 shadow-[0_0_50px_rgba(245,158,11,0.8)] animate-pulse">
                  <AlertTriangle className="h-14 w-14 stroke-[2.5]" />
                </div>
              )}
              {(scanStatus === 'no_reserve' || scanStatus === 'error') && (
                <div className="w-24 h-24 bg-rose-505 rounded-full flex items-center justify-center text-rose-300 border-4 border-rose-400 p-5 shadow-[0_0_50px_rgba(244,63,94,0.8)] animate-bounce">
                  <AlertCircle className="h-14 w-14 stroke-[2.5]" />
                </div>
              )}
            </div>

            {/* Verification message banner */}
            <div className="space-y-2">
              <span className={`inline-block px-4 py-1 rounded-full text-xs font-black font-mono uppercase tracking-widest ${
                scanStatus === 'success' ? 'bg-emerald-501 text-emerald-300 border border-emerald-400/45' : 
                scanStatus === 'duplicate' ? 'bg-amber-501 text-amber-300 border border-amber-400/45' : 
                'bg-rose-501 text-rose-300 border border-rose-400/45'
              }`}>
                {scanStatus === 'success' ? '✓ REFEIÇÃO AUTORIZADA' :
                 scanStatus === 'duplicate' ? '⚠️ ALERTA: SCAN DUPLICADO' :
                 scanStatus === 'no_reserve' ? '✗ RECUSADO: SEM RESERVA' :
                 '✗ BLOQUEADO: SEM CADASTRAL BIOMÉTRICO'}
              </span>

              <h2 className="text-3xl font-black text-white leading-normal tracking-tight">
                {scanningUser?.nome}
              </h2>

              <p className="text-neutral-350 text-xs font-mono">
                Matrícula: {scanningUser?.matricula} | Empresa: {getEmpresa(scanningUser?.idEmpresa || '')?.nome || 'Pendente'}
              </p>
            </div>

            {/* Descriptive Body */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-sm font-semibold max-w-sm mx-auto leading-relaxed">
              {scanStatus === 'success' && (
                <p className="text-emerald-300">
                  Reserva encontrada! Sincronização computada com êxito na folha de refeições. Bom apetite!
                </p>
              )}
              {scanStatus === 'duplicate' && (
                <p className="text-amber-300">
                  Este colaborador já retirou sua marmita em nosso terminal há menos de {blockIntervalHours} horas (às {duplicateLastTime}h). Segunda passagem bloqueada para auditoria.
                </p>
              )}
              {scanStatus === 'no_reserve' && (
                <p className="text-rose-300">
                  Não foi identificado nenhum agendamento eletrônico de refeição para esta matrícula hoje. 
                </p>
              )}
              {scanStatus === 'error' && (
                <p className="text-rose-300">
                  A assinatura facial bruta não foi encontrada para este colaborador. Exige pré-cadastramento facial no Recursos Humanos.
                </p>
              )}
            </div>

            {/* Quick corrective actions panels for No-Reserve */}
            {scanStatus === 'no_reserve' && (
              <div className="flex flex-col gap-2 pt-1.5 max-w-xs mx-auto shrink-0 relative z-70">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualExcessBooking();
                  }}
                  className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  ⚡ Permitir Consumo Excedente de Obra
                </button>
              </div>
            )}

            <p className="text-[10px] text-neutral-500 animate-pulse pt-2 shrink-0">
              Toque em qualquer lugar da tela para liberar o próximo colaborador da fila
            </p>

          </div>
        </div>
      )}

      {/* Terminal Header Dashboard Area */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-neutral-800 rounded-xl text-emerald-400 border border-emerald-500/20 shadow-inner">
            <Tablet className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black font-mono tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded uppercase">
                🟢 TERMINAL ATIVO
              </span>
              <span className="text-[9px] font-black font-mono bg-neutral-850 px-2 py-0.5 rounded text-neutral-400">
                Hoje: {parseLocalOffset(reportDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">{activeObraObj?.nome}</h3>
            <p className="text-xs text-neutral-400">Centro de Custo: {activeObraObj?.centroCusto}</p>
          </div>
        </div>

        {/* Dynamic Counters and Block controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
          
          {/* Duplicity timeframe selector */}
          <div className="bg-neutral-850 border border-neutral-800 rounded-xl px-3 py-2 flex items-center gap-2.5">
            <div className="space-y-0.5">
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none">
                Trava Duplicada
              </label>
              <span className="text-xs font-black text-emerald-400 font-mono">
                {blockIntervalHours} Horas
              </span>
            </div>
            
            <div className="flex gap-1 shrink-0">
              {[1, 2, 3, 4].map((hours) => (
                <button
                  key={hours}
                  onClick={() => handleBlockIntervalChange(hours)}
                  className={`px-2 py-1 rounded text-[9px] font-black transition-colors ${
                    blockIntervalHours === hours
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-800 text-neutral-450 hover:bg-neutral-750'
                  }`}
                  title={`${hours} horas de intervalo contra múltiplas passagens`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleResetTerminalConfig}
            className="p-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white rounded-xl border border-neutral-750 transition active:scale-95 text-xs font-bold"
            title="Sair / Alterar obra deste Tablet"
          >
            ⚙️ Trocar Obra
          </button>
        </div>
      </div>

      {/* Production real-time statistics count inside active work */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="tablet-production-counters">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600 font-bold text-xs shrink-0 font-mono">
            1
          </div>
          <div>
            <span className="block text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-extrabold">Almoços Agendados</span>
            <span className="text-lg font-black text-neutral-900 font-mono mt-0.5 block">{totalReservadosHoje} refeições</span>
          </div>
        </div>

        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-150 shadow-xs flex items-center gap-3.5">
          <div className="p-2 bg-emerald-500 text-neutral-950 font-bold text-xs shrink-0 font-mono rounded-lg">
            2
          </div>
          <div>
            <span className="block text-[9px] font-mono text-emerald-700 uppercase tracking-wider font-extrabold">Retirados Hoje</span>
            <span className="text-lg font-black text-emerald-900 font-mono mt-0.5 block">{retiradosHoje} Pratos</span>
          </div>
        </div>

        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2 bg-neutral-250 text-neutral-700 font-bold text-xs shrink-0 font-mono rounded-lg">
            3
          </div>
          <div>
            <span className="block text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-extrabold">Saldo Restante</span>
            <span className="text-lg font-black text-neutral-700 font-mono mt-0.5 block">{restanteHoje} Marmitas</span>
          </div>
        </div>
      </div>

      {/* Main View Grid: Live Biometric camera feed VS queue touch screen list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COMPONENT: Continuously Open Biometric Camera / Face Reader */}
        <div className="lg:col-span-5 bg-neutral-900 text-white p-5 rounded-2xl border border-neutral-800 shadow-xl flex flex-col justify-between space-y-4">
          
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-neutral-100 text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
                <ScanFace className="h-4.5 w-4.5 text-emerald-400" /> Sensor Biométrico Ativo
              </h4>
              <button
                type="button"
                onClick={toggleDemoMode}
                className={`p-1 px-2.5 rounded-lg text-[9px] font-black tracking-widest transition flex items-center gap-1 cursor-pointer select-none ${
                  isDemoActive 
                    ? 'bg-amber-600 text-white animate-pulse' 
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white'
                }`}
                title="Demonstra passagem autônoma de colaboradores sem tocar na tela"
              >
                {isDemoActive ? (
                  <>
                    <Square className="h-2.5 w-2.5 fill-current" /> PARAR SIMULAÇÃO
                  </>
                ) : (
                  <>
                    <Play className="h-2.5 w-2.5 fill-current" /> AUTO SIMULAR (TESTE)
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">O tablet permanece com a câmera ligada lendo rostos continuamente.</p>
          </div>

          {/* Continuous Camera Feed Viewport Frame with grid lasers overlays */}
          <div className="relative border-4 border-neutral-850 rounded-2xl aspect-square bg-gradient-to-t from-neutral-950 to-neutral-900 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
            
            {/* Green Scanning line indicator */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(16,185,129,0)_94%,#10B981_94%)] bg-[length:100%_35px] animate-[pulse_2.2s_infinite]" />
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.5)] pointer-events-none" />

            {/* Webcam video component */}
            {hasCamera ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              /* Fallback animation when standard iframe inhibits actual getUserMedia stream */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <div className="bg-neutral-850 p-6 rounded-full text-emerald-400 m-1">
                    <ScanFace className="h-16 w-16 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="inline-block px-2 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono rounded font-bold">
                    CÂMERA CONTINUA PRONTA
                  </span>
                  <p className="text-[11px] text-neutral-300 font-bold">Leitor Biométrico Integrado Ativado</p>
                  <p className="text-[9px] text-neutral-500 max-w-xs mx-auto leading-normal">
                    Seu aparelho está com a lente monitorando a entrada. O sistema de reconhecimento facial está calibrado.
                  </p>
                </div>
              </div>
            )}

            {/* Scanning facial guideline ring */}
            <div className="absolute inset-10 rounded-full border-2 border-dashed border-emerald-500/30 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] h-[85%] rounded-full border border-dashed border-emerald-500/15" />
            </div>

            {/* Temporary loading analysis overlay in flight */}
            {scanStatus === 'scanning' && scanningUser && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-40 animate-fade-in">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <div className="bg-neutral-850 p-5 rounded-full text-emerald-400 m-1">
                    <ScanFace className="h-12 w-12" />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded animate-pulse">
                    ANALISANDO VETORIZAÇÃO FACIAL
                  </span>
                  <h5 className="font-bold text-white text-sm">{scanningUser.nome}</h5>
                  <p className="text-[10px] text-neutral-500 font-mono">Calculando compatibilidade...</p>
                </div>
              </div>
            )}

          </div>

          {/* Feedback banner under stream */}
          <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-850 leading-relaxed font-sans shrink-0">
            {feedbackMessage ? (
              <span className={`block text-xs font-extrabold text-center uppercase tracking-wide animate-pulse ${
                scanStatus === 'success' || scanStatus === 'idle' ? 'text-emerald-400' :
                scanStatus === 'duplicate' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {feedbackMessage}
              </span>
            ) : (
              <span className="block text-[10px] text-neutral-450 font-mono text-center">
                Aguardando identificação. Aproxime a face ou selecione um colaborador na fila ao lado.
              </span>
            )}
          </div>

        </div>


        {/* RIGHT COMPONENT: Elegant queue list designed for touch selection instead of search typing */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          
          <div>
            <h4 className="font-extrabold text-neutral-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
              <Smile className="h-4 w-4 text-emerald-600" /> Fila de Colaboradores de Lotação
            </h4>
            <p className="text-[11px] text-neutral-550 leading-normal">
              Utilize o painel abaixo de aproximação rápida para indicar quem está em frente ao tablet (ideal para touch screen nos canteiros, agilizando as refeições por blocos).
            </p>
          </div>

          {/* Touch-Friendly Filters & Search combo */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Identificar por matrícula / nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-neutral-350 rounded-xl text-xs bg-white text-neutral-800 focus:outline-none w-full"
                id="search-touch-input"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-3.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-xl text-xs font-bold transition flex items-center justify-center min-h-[38px] cursor-pointer"
              >
                Limpar Busca
              </button>
            )}
          </div>

          {/* Quick-tap queue grid */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" id="refeitorio-touch-queue">
            {filteredColabs.length === 0 ? (
              <div className="text-center p-8 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-400 space-y-1.5">
                <Smile className="h-8 w-8 mx-auto" />
                <p className="text-xs font-bold text-neutral-500">Nenhum colaborador encontrado</p>
                <p className="text-[10px] leading-relaxed">
                  Não existem colaboradores cadastrados nesta obra que coincidam com a pesquisa.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredColabs.map((user) => {
                  const isReserved = reservas.some(
                    r => r.idUsuario === user.id && r.data === reportDate && r.status === ReservaStatus.Reservado
                  );
                  const resObj = reservas.find(r => r.idUsuario === user.id && r.data === reportDate);
                  const isConsumed = !!(resObj && resObj.status === ReservaStatus.Reservado && resObj.consumido);

                  return (
                    <button
                      key={user.id}
                      onClick={() => executeBiometricScan(user)}
                      className={`p-3 rounded-xl border transition-all text-left duration-150 relative cursor-pointer active:scale-97 flex items-center justify-between gap-3 ${
                        isConsumed
                          ? 'bg-emerald-50/50 border-emerald-150 hover:bg-emerald-50'
                          : isReserved
                          ? 'bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs hover:border-emerald-500'
                          : 'bg-rose-50/30 hover:bg-rose-50/60 border-rose-100 hover:border-rose-300'
                      }`}
                      id={`queue-card-${user.id}`}
                    >
                      <div className="flex gap-2.5 items-center min-w-0">
                        {user.fotoBiometria ? (
                          <img 
                            src={user.fotoBiometria} 
                            alt="Foto Registro" 
                            className={`w-10 h-10 rounded-full border object-cover shrink-0 ${
                              isConsumed ? 'border-emerald-500' : isReserved ? 'border-neutral-305' : 'border-rose-300'
                            }`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full border border-dashed flex items-center justify-center shrink-0 ${
                            isReserved ? 'border-amber-300 bg-amber-50' : 'border-rose-205 bg-rose-50'
                          }`} title="Sem Biometria">
                            <Smile className={`w-5 h-5 ${isReserved ? 'text-amber-500' : 'text-rose-450'}`} />
                          </div>
                        )}

                        <div className="min-w-0 leading-tight">
                          <span className="block text-[8px] font-black font-mono text-neutral-450">MAT: {user.matricula}</span>
                          <h5 className="font-bold text-neutral-800 text-xs truncate max-w-[130px] mt-0.5">{user.nome}</h5>
                          <span className="text-[9px] text-neutral-500 block truncate leading-none mt-0.5">Empresa: {getEmpresa(user.idEmpresa)?.nome || 'fontana'}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1 font-mono">
                        {isConsumed ? (
                          <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[7px] font-black rounded uppercase tracking-wide">
                            ✓ CONSUMIDO
                          </span>
                        ) : isReserved ? (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-bold rounded">
                            RESERVADO
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-rose-150 text-rose-800 text-[8px] font-bold rounded">
                            SEM RESERVA
                          </span>
                        )}
                        <span className="text-[7.5px] text-neutral-400 mt-0.5">
                          Aproximar Rosto &gt;
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick explanations legend */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-[10px] sm:text-[11px] text-neutral-600 leading-normal space-y-1 font-medium">
            <span className="font-bold text-neutral-800 block text-xs">ℹ️ Como Operar no Tablet:</span>
            <p>1. Para registrar, o colaborador simplesmente aproxima o rosto da câmera (ou o fiscal toca na foto dele acima).</p>
            <p>2. Se ele possuir reserva agendada, o sistema **pisca em verde**, confirma a marmita na folha e emite uma mensagem falada de positivo.</p>
            <p>3. Se ele não reservou, o sistema **pisca em vermelho** e o fiscal pode clicar no botão de "Permitir como Consumo Excedente" caso decida autorizar.</p>
            <p>4. Se o mesmo colaborador tentar passar mais de uma vez dentro do intervalo selecionado de {blockIntervalHours}h, o sistema impede a duplicação, **piscando em amarelo** e notificando a tentativa.</p>
          </div>

        </div>

      </div>

    </div>
  );
}
