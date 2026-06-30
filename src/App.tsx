/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Perfil, 
  UserStatus, 
  ReservaStatus, 
  Obra, h
  Empresa, 
  Usuario, 
  Reserva, 
  Feriado, 
  AuditoriaLog, 
  SystemSettings 
} from './types';
import { 
  INITIAL_OBRAS, 
  INITIAL_EMPRESAS, 
  INITIAL_USUARIOS, 
  INITIAL_FERIADOS, 
  INITIAL_RESERVAS, 
  INITIAL_SETTINGS, 
  INITIAL_LOGS 
} from './data/mockData';

import { db } from './firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { 
  saveToFirestore, 
  saveBatchToFirestore, 
  saveSystemSettings, 
  seedRequiredCollections 
} from './lib/firebaseSync';
import { scheduleNotification, registerFCMToken } from './lib/notificationScheduler';

// Components
import SimulationHeader from './components/SimulationHeader';
import RegisterModal from './components/RegisterModal';
import DashboardView from './components/DashboardView';
import ColaboradorView from './components/ColaboradorView';
import AdminView from './components/AdminView';
import ReportsView from './components/ReportsView';
import RefeitorioView from './components/RefeitorioView';
import GestorView from './components/GestorView';
import LoginScreen from './components/LoginScreen';
import FornecedorView from './components/FornecedorView';
import BiometriaModal from './components/BiometriaModal';
import AccountSettingsModal from './components/AccountSettingsModal';
import LgpdConsentModal from './components/LgpdConsentModal';
import FirstAccessPasswordResetModal from './components/FirstAccessPasswordResetModal';

// Icons
import { 
  LayoutDashboard, 
  CalendarRange, 
  UsersRound, 
  FilePieChart, 
  ChefHat, 
  HardHat, 
  BellRing,
  HelpCircle,
  Smartphone,
  Monitor,
  UtensilsCrossed,
  Fingerprint,
  Settings,
  X
} from 'lucide-react';

export default function App() {
  
  // --- DATABASE STATE PERSISTED VIA LOCALSTORAGE ---
  const [obras, setObras] = useState<Obra[]>(() => {
    const saved = localStorage.getItem('sgr_obras');
    return saved ? JSON.parse(saved) : INITIAL_OBRAS;
  });

  const [empresas, setEmpresas] = useState<Empresa[]>(() => {
    const saved = localStorage.getItem('sgr_empresas');
    return saved ? JSON.parse(saved) : INITIAL_EMPRESAS;
  });

  const [usuarios, setUsuarios] = useState<Usuario[]>(() => {
    const saved = localStorage.getItem('sgr_usuarios');
    let parsed: Usuario[] = saved ? JSON.parse(saved) : [...INITIAL_USUARIOS];
    
    // Auto-repair check: ensure user jarbas.nunes@estilofontana.com.br is always present as Admin
    const hasJarbasEstilo = parsed.some(u => u.email === 'jarbas.nunes@estilofontana.com.br');
    if (!hasJarbasEstilo) {
      // Remove any outdated jarbas objects to avoid duplication
      parsed = parsed.filter(u => u.id !== 'u-jarbas' && u.email !== 'jarbas.nunes@fontana.com.br');
      parsed.unshift(INITIAL_USUARIOS[0]); // Prepend fresh admin creds
    }
    return parsed;
  });

  const [feriados, setFeriados] = useState<Feriado[]>(() => {
    const saved = localStorage.getItem('sgr_feriados');
    return saved ? JSON.parse(saved) : INITIAL_FERIADOS;
  });

  const [reservas, setReservas] = useState<Reserva[]>(() => {
    const saved = localStorage.getItem('sgr_reservas');
    return saved ? JSON.parse(saved) : INITIAL_RESERVAS;
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('sgr_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure facial biometrics and tablet features are deactivated by default
      return {
        ...parsed,
        usarTabletRetirada: parsed.usarTabletRetirada === undefined ? false : parsed.usarTabletRetirada,
        requererBiometriaFacial: parsed.requererBiometriaFacial === undefined ? false : parsed.requererBiometriaFacial
      };
    }
    return INITIAL_SETTINGS;
  });

  const [logs, setLogs] = useState<AuditoriaLog[]>(() => {
    const saved = localStorage.getItem('sgr_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  // --- OPERATION & SIMULATION CONTROL STATES ---
  const [modoProducao, setModoProducaoState] = useState<boolean>(() => {
    const saved = localStorage.getItem('sgr_modo_producao');
    return saved !== null ? saved === 'true' : true; // Default to true (Production Mode is the secure corporate standard)
  });

  const [isLogged, setIsLogged] = useState<boolean>(() => {
    const saved = localStorage.getItem('sgr_is_logged');
    return saved === 'true';
  });

  const [currentUser, setCurrentUser] = useState<Usuario>(() => {
    const savedUserId = localStorage.getItem('sgr_logged_user_id');
    if (savedUserId && usuarios) {
      const found = usuarios.find(u => u.id === savedUserId);
      if (found) return found;
    }
    return usuarios[0] || INITIAL_USUARIOS[0];
  });
  const [virtualTime, setVirtualTime] = useState<string>('07:30'); // Toggle before and after cutoff threshold "08:30"
  
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Real-time flash notification banner state
  const [flashNotification, setFlashNotification] = useState<string | null>(null);
  const [backgroundPushAlert, setBackgroundPushAlert] = useState<string | null>(null);

  // Firestore DB status indicator
  const [dbState, setDbState] = useState<{ status: 'loading' | 'connected' | 'error'; errorMsg: string | null }>({
    status: 'loading',
    errorMsg: null
  });

  // Biometric device authentication states
  const [deviceBiometricActive, setDeviceBiometricActive] = useState<boolean>(false);
  const [isBiometriaSetupOpen, setIsBiometriaSetupOpen] = useState<boolean>(false);

  // Sync state functions
  const setModoProducao = (val: boolean) => {
    setModoProducaoState(val);
    localStorage.setItem('sgr_modo_producao', String(val));
    if (val) {
      // Upon entering Production Mode, force user to log in if their email/password is required,
      // or start logged-out so they see the clean login screen.
      // If the current user is Jarbas and we already cleared the base, that's fine.
    }
  };

  // Firestore Real-Time Shared State Sync
  useEffect(() => {
    let active = true;
    let unsubs: (() => void)[] = [];

    const initDbAndSync = async () => {
      try {
        setDbState({ status: 'loading', errorMsg: null });
        // 1. Seed collections if empty
        await seedRequiredCollections(
          INITIAL_OBRAS,
          INITIAL_EMPRESAS,
          INITIAL_USUARIOS,
          INITIAL_FERIADOS,
          INITIAL_RESERVAS,
          INITIAL_SETTINGS,
          INITIAL_LOGS
        );
      } catch (seedError) {
        console.warn("[Firestore] Pre-seeding warning (non-blocking outside setup):", seedError);
      }

      if (!active) return;

      // 2. Setup snapshot listeners
      const unsubObras = onSnapshot(collection(db, 'obras'), (snap) => {
        console.log(`[Firestore] 'obras' collection update: received ${snap.size} documents.`);
        const list: Obra[] = [];
        snap.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Obra));
        if (active) {
          setObras(list);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore] Obras sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Obras): ${err.message}` });
      });
      unsubs.push(unsubObras);

      const unsubEmpresas = onSnapshot(collection(db, 'empresas'), (snap) => {
        console.log(`[Firestore] 'empresas' collection update: received ${snap.size} documents.`);
        const list: Empresa[] = [];
        snap.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Empresa));
        if (active) {
          setEmpresas(list);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore] Empresas sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Empresas): ${err.message}` });
      });
      unsubs.push(unsubEmpresas);

      const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snap) => {
        const list: Usuario[] = [];
        snap.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Usuario));
        
        const pendings = list.filter(u => u.status === 'pendente');
        console.log(`[Firestore REAL-TIME] 'usuarios' snap callback executed! Total: ${list.length} docs. Pendentes do RH: ${pendings.length}.`);
        if (list.length > 0) {
          console.log("[Firestore REAL-TIME] Document List Details:", list.map(u => ({ nome: u.nome, email: u.email, status: u.status })));
        }
        
        if (active) {
          setUsuarios(list);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore REAL-TIME ERROR] 'usuarios' sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Usuários): ${err.message}` });
      });
      unsubs.push(unsubUsuarios);

      const unsubFeriados = onSnapshot(collection(db, 'feriados'), (snap) => {
        console.log(`[Firestore] 'feriados' collection update: received ${snap.size} documents.`);
        const list: Feriado[] = [];
        snap.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Feriado));
        if (active) {
          setFeriados(list);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore] Feriados sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Feriados): ${err.message}` });
      });
      unsubs.push(unsubFeriados);

      const unsubReservas = onSnapshot(collection(db, 'reservas'), (snap) => {
        console.log(`[Firestore] 'reservas' collection update: received ${snap.size} documents.`);
        const list: Reserva[] = [];
        snap.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Reserva));
        if (active) {
          setReservas(list);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore] Reservas sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Reservas): ${err.message}` });
      });
      unsubs.push(unsubReservas);

      const unsubLogs = onSnapshot(collection(db, 'logs'), (snap) => {
        console.log(`[Firestore] 'logs' collection update: received ${snap.size} documents.`);
        const list: AuditoriaLog[] = [];
        snap.forEach(doc => list.push({ ...doc.data(), id: doc.id } as AuditoriaLog));
        list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
        if (active) {
          setLogs(list);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore] Logs sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Logs): ${err.message}` });
      });
      unsubs.push(unsubLogs);

      const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
        console.log(`[Firestore] 'settings/system' document update received. Exists: ${snap.exists()}`);
        if (snap.exists() && active) {
          setSettings(snap.data() as SystemSettings);
          setDbState(prev => prev.status === 'error' ? prev : { status: 'connected', errorMsg: null });
        }
      }, (err) => {
        console.error("[Firestore] Settings sync failed:", err);
        if (active) setDbState({ status: 'error', errorMsg: `Erro de sincronização (Settings/Parâmetros): ${err.message}` });
      });
      unsubs.push(unsubSettings);
    };

    initDbAndSync();
    
    return () => {
      active = false;
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('sgr_is_logged', String(isLogged));
  }, [isLogged]);

  // Safety trigger: if simulator is disabled by Admin, force Production Mode immediately
  useEffect(() => {
    if (settings && settings.permitirSimulador === false && !modoProducao) {
      setModoProducao(true);
      triggerFlashNotification('Segurança Ativada: Modo Demonstração/Simulador suspenso permanentemente pelo administrador.');
    }
  }, [settings?.permitirSimulador, modoProducao]);

  // Compute dynamic active values based on operation mode
  const getTodayDate = () => {
    if (modoProducao) {
      // Return real current date in local YYYY-MM-DD
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      return '2026-06-13'; // June 13, 2026 for simulation
    }
  };

  const getIsAfterCutoff = () => {
    if (modoProducao) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      return hours > 8 || (hours === 8 && minutes >= 30);
    } else {
      const [valHour, valMinute] = virtualTime.split(':').map(Number);
      return valHour > 8 || (valHour === 8 && valMinute >= 30);
    }
  };

  const todayDate = getTodayDate();
  const isAfterCutoff = getIsAfterCutoff();

  // --- DETECT AND PURGE LEGACY LOCALSTORAGE DATA ---
  useEffect(() => {
    const savedObras = localStorage.getItem('sgr_obras');
    const savedUsers = localStorage.getItem('sgr_usuarios');
    const savedReservas = localStorage.getItem('sgr_reservas');
    
    // Check if user contains old domain/structure or if obras has legacy sites (Bella Vista, Escritório Central) or is missing our clean single site 'o-sede'
    const needsPurge = 
      (savedObras && (savedObras.includes('o-bella-vista') || savedObras.includes('Bella Vista') || savedObras.includes('Escritório Central') || !savedObras.includes('o-sede'))) ||
      (savedUsers && !savedUsers.includes('jarbas.nunes@estilofontana.com.br')) ||
      (savedObras && savedReservas && JSON.parse(savedReservas).length > 0 && JSON.parse(savedObras).some((o: any) => o.id === 'o-bella-vista'));

    if (needsPurge) {
      console.log('Legacy SGR browser cache detected. Purging local storage for a clean FONTANA instance.');
      localStorage.removeItem('sgr_obras');
      localStorage.removeItem('sgr_empresas');
      localStorage.removeItem('sgr_usuarios');
      localStorage.removeItem('sgr_feriados');
      localStorage.removeItem('sgr_reservas');
      localStorage.removeItem('sgr_settings');
      localStorage.removeItem('sgr_logs');
      
      setObras(INITIAL_OBRAS);
      setEmpresas(INITIAL_EMPRESAS);
      setUsuarios(INITIAL_USUARIOS);
      setFeriados(INITIAL_FERIADOS);
      setReservas(INITIAL_RESERVAS);
      setSettings(INITIAL_SETTINGS);
      setLogs(INITIAL_LOGS);
      setCurrentUser(INITIAL_USUARIOS[0]);
    }
  }, []);

  // Sync state to local storage when changed
  useEffect(() => {
    localStorage.setItem('sgr_obras', JSON.stringify(obras));
  }, [obras]);

  useEffect(() => {
    localStorage.setItem('sgr_empresas', JSON.stringify(empresas));
  }, [empresas]);

  useEffect(() => {
    localStorage.setItem('sgr_usuarios', JSON.stringify(usuarios));
    // Synced logged-in state user check to avoid stale reference
    const checkCurrentUser = usuarios.find(u => u.id === currentUser.id);
    if (checkCurrentUser && JSON.stringify(checkCurrentUser) !== JSON.stringify(currentUser)) {
      setCurrentUser(checkCurrentUser);
    }
  }, [usuarios]);

  useEffect(() => {
    localStorage.setItem('sgr_feriados', JSON.stringify(feriados));
  }, [feriados]);

  useEffect(() => {
    localStorage.setItem('sgr_reservas', JSON.stringify(reservas));
  }, [reservas]);

  useEffect(() => {
    localStorage.setItem('sgr_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('sgr_logs', JSON.stringify(logs));
  }, [logs]);

  // Enforce tab security context if current user role changes
  useEffect(() => {
    if (currentUser.perfil === Perfil.Colaborador) {
      setActiveTab('colaborador');
    } else if (currentUser.perfil === Perfil.Gestor) {
      setActiveTab('gestor');
    } else if (currentUser.perfil === Perfil.Fornecedor) {
      setActiveTab('fornecedor');
    } else {
      setActiveTab('dashboard'); // Admin has access and defaults to dashboard
    }

    if (currentUser) {
      setDeviceBiometricActive(localStorage.getItem('sgr_biometria_cadastrada_' + currentUser.email) === 'true');
      localStorage.setItem('sgr_logged_user_id', currentUser.id);
    }
  }, [currentUser]);

  // Synchronise and reschedule system alarms whenever session updates
  useEffect(() => {
    if (isLogged && currentUser && currentUser.email) {
      const enabled = currentUser.alertaEnabled ?? (localStorage.getItem(`sgr_notify_enabled_${currentUser.email}`) === 'true');
      if (enabled) {
        const timeStr = currentUser.alertaTime ?? localStorage.getItem(`sgr_notify_time_${currentUser.email}`) ?? '19:00';
        scheduleNotification(
          timeStr,
          'SGR Fontana',
          `Lembrete: consulte e agende sua refeição antes das ${settings?.horarioLimite || '10:00'}!`,
          currentUser.email
        ).catch(err => console.warn('[App Setup] Reschedule failed:', err));
      }
    }
  }, [isLogged, currentUser?.email, currentUser?.alertaEnabled, currentUser?.alertaTime, settings?.horarioLimite]);

  // Automated background alarm checking engine
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | number;

    const runCheck = () => {
      if (!isLogged || !currentUser || !currentUser.email) return;

      const enabled = currentUser.alertaEnabled ?? (localStorage.getItem(`sgr_notify_enabled_${currentUser.email}`) === 'true');
      if (!enabled) return;

      const timing = currentUser.alertaTiming ?? (localStorage.getItem(`sgr_notify_timing_${currentUser.email}`) as 'vespera' | 'mesmo_dia' | null) ?? 'vespera';
      const timeStr = currentUser.alertaTime ?? localStorage.getItem(`sgr_notify_time_${currentUser.email}`) ?? '19:00';

      const [cfgHour, cfgMin] = timeStr.split(':').map(Number);
      if (isNaN(cfgHour) || isNaN(cfgMin)) return;

      let curHour: number;
      let curMin: number;
      if (modoProducao) {
        const now = new Date();
        curHour = now.getHours();
        curMin = now.getMinutes();
      } else {
        const [vHour, vMin] = virtualTime.split(':').map(Number);
        curHour = isNaN(vHour) ? 7 : vHour;
        curMin = isNaN(vMin) ? 30 : vMin;
      }

      const currentTotalMinutes = curHour * 60 + curMin;
      const configTotalMinutes = cfgHour * 60 + cfgMin;

      // When the current time is greater than or equal to the scheduled time
      if (currentTotalMinutes >= configTotalMinutes) {
        const lastNotifiedDate = localStorage.getItem(`sgr_last_alert_date_${currentUser.email}`);
        if (lastNotifiedDate === todayDate) return;

        let shouldAlert = false;
        let alertMsgText = '';

        if (timing === 'vespera') {
          const today = new Date(todayDate + 'T12:00:00');
          today.setDate(today.getDate() + 1);
          const tomorrowStr = today.toISOString().split('T')[0];

          const tomorrowReserva = reservas.find(r => r.idUsuario === currentUser.id && r.data === tomorrowStr);
          const hasBookingTomorrow = tomorrowReserva && tomorrowReserva.status === ReservaStatus.Reservado;

          shouldAlert = true;
          if (hasBookingTomorrow) {
            alertMsgText = `🔔 SGR FONTANA: Olá, ${currentUser.nome}! Lembrete: Você possui reserva de refeição ativada para amanhã (${tomorrowStr.split('-')[2]}/${tomorrowStr.split('-')[1]}). Caso precise desmarcar sem multa, faça até as ${settings.horarioLimite}.`;
          } else {
            alertMsgText = `⚠️ SGR FONTANA: Olá, ${currentUser.nome}! Você NÃO possui refeição agendada para AMANHÃ (${tomorrowStr.split('-')[2]}/${tomorrowStr.split('-')[1]}). Confirme no canteiro de obras pelo app antes que encerre às ${settings.horarioLimite}!`;
          }
        } else {
          const todayReserva = reservas.find(r => r.idUsuario === currentUser.id && r.data === todayDate);
          const hasBookingToday = todayReserva && todayReserva.status === ReservaStatus.Reservado;

          shouldAlert = true;
          if (hasBookingToday) {
            alertMsgText = `🔔 SGR FONTANA: Olá, ${currentUser.nome}! Lembrete: Sua refeição está reservada para HOJE. Lembre-se de comparecer ao refeitório!`;
          } else {
            alertMsgText = `🔔 SGR FONTANA: Olá, ${currentUser.nome}! O horário limite de agendamento está se aproximando. Confirme sua refeição de hoje no painel antes das ${settings.horarioLimite}.`;
          }
        }

        if (shouldAlert) {
          localStorage.setItem(`sgr_last_alert_date_${currentUser.email}`, todayDate);

          // Audio chime
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
          } catch {}

          setBackgroundPushAlert(alertMsgText);
          setTimeout(() => setBackgroundPushAlert(null), 8500);

          if ('Notification' in window) {
            const triggerMobileFriendlyNotification = () => {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification('SGR FONTANA', {
                    body: alertMsgText.replace('🔔 SGR FONTANA: ', ''),
                    icon: '/icon.png',
                    badge: '/icon-badge.svg',
                    vibrate: [0, 200, 100, 200], // Snappy WhatsApp-style double rumble
                    actions: [
                      { action: 'reserve', title: '✅ Confirmar Almoço' },
                      { action: 'view_menu', title: '📋 Ver Cardápio' }
                    ]
                  } as any);
                }).catch(() => {
                  new Notification('SGR FONTANA', {
                    body: alertMsgText.replace('🔔 SGR FONTANA: ', ''),
                    icon: '/icon.png',
                    badge: '/icon-badge.svg'
                  } as any);
                });
              } else {
                new Notification('SGR FONTANA', {
                  body: alertMsgText.replace('🔔 SGR FONTANA: ', ''),
                  icon: '/icon.png',
                  badge: '/icon-badge.svg'
                } as any);
              }
            };

            if (Notification.permission === 'granted') {
              triggerMobileFriendlyNotification();
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                  triggerMobileFriendlyNotification();
                }
              });
            }
          }
        }
      }
    };

    runCheck();
    checkInterval = setInterval(runCheck, 15000); // Check every 15s

    return () => clearInterval(checkInterval);
  }, [isLogged, currentUser, virtualTime, modoProducao, todayDate, settings, reservas]);

  // Helper helper to generate system logs
  const appendAuditLog = (operation: string, overrideUserName?: string, overrideEmail?: string) => {
    const timestamp = modoProducao 
      ? new Date().toISOString()
      : `${new Date().toISOString().split('T')[0]}T${virtualTime}:00Z`;

    const newLog: AuditoriaLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      usuarioNome: overrideUserName || currentUser.nome,
      usuarioEmail: overrideEmail || currentUser.email,
      dataHora: timestamp,
      operacao: operation,
      ip: '177.53.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255),
      dispositivo: currentUser.perfil === Perfil.Colaborador ? 'Android SGR Mobile' : 'Chrome Web / Desktop OS',
      perfil: currentUser.perfil,
    };
    setLogs(prev => [newLog, ...prev]);
    saveToFirestore('logs', newLog);
  };

  const triggerFlashNotification = (msg: string) => {
    setFlashNotification(msg);
    setTimeout(() => setFlashNotification(null), 5000);
  };

  // --- ACTIONS WORKFLOW ---

  // Click on date (Reservado -> Cancelado)
  const handleToggleReserva = (dateStr: string) => {
    const existingIndex = reservas.findIndex(r => r.idUsuario === currentUser.id && r.data === dateStr);

    if (existingIndex > -1) {
      const updated = [...reservas];
      const res = { ...updated[existingIndex] };
      const wasReserved = res.status === ReservaStatus.Reservado;
      
      res.status = wasReserved ? ReservaStatus.Cancelado : ReservaStatus.Reservado;
      res.alteradoEm = new Date().toISOString();
      res.ipOrigem = '192.168.1.15';
      res.dispositivo = 'Smartphone SGR App';
      
      updated[existingIndex] = res;
      setReservas(updated);
      saveToFirestore('reservas', res);
      
      const opLabel = wasReserved ? 'Cancelamento de Marmita' : 'Reserva Efetuada';
      appendAuditLog(`${opLabel} para o dia ${dateStr}`);
      triggerFlashNotification(`Marmita para o dia ${dateStr} alterada para: ${wasReserved ? 'CANCELADO ⚪' : 'RESERVADO 🟢'}`);
    } else {
      // Create new
      const newRes: Reserva = {
        id: 'r-' + Math.random().toString(36).substr(2, 9),
        idUsuario: currentUser.id,
        data: dateStr,
        status: ReservaStatus.Reservado,
        consumido: false,
        idObraNoDia: currentUser.idObraPadrao,
        alteradoEm: new Date().toISOString(),
        ipOrigem: '192.168.1.15',
        dispositivo: 'Smartphone SGR App'
      };
      setReservas(prev => [...prev, newRes]);
      saveToFirestore('reservas', newRes);
      appendAuditLog(`Reserva de Marmita criada para o dia ${dateStr}`);
      triggerFlashNotification(`Reserva da sua refeição efetuada com sucesso para: ${dateStr} 🟢`);
    }
  };

  // Period / Batch Booking action
  const handlePeriodReserva = (startDate: string, endDate: string, action: 'reservar' | 'cancelar') => {
    const loopStart = new Date(startDate + 'T12:00:00');
    const loopEnd = new Date(endDate + 'T12:00:00');
    
    const newBatchReservations: Reserva[] = [];
    const updatedExistingReservations = [...reservas];

    // Build unique day arrays inside standard June month
    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      
      const mStr = m < 10 ? `0${m}` : `${m}`;
      const dStr = day < 10 ? `0${day}` : `${day}`;
      const dateStr = `${year}-${mStr}-${dStr}`;

      // Enforce weekend validation if necessary
      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend && !settings.permitirFinsDeSemana) {
        continue; // skip the weekend day in batch actions
      }

      // Prevent batch actions on past dates
      if (dateStr < todayDate) {
        continue;
      }

      // Prevent batch actions on current day if past cutoff threshold
      if (dateStr === todayDate && isAfterCutoff) {
        continue;
      }

      // Prevent batch actions on holidays applicable to this user
      const isHoliday = feriados.some(f => {
        if (f.data !== dateStr) return false;
        if (!f.abrangencia || f.abrangencia === 'nacional') return true;
        return f.idObras?.includes(currentUser.idObraPadrao) ?? false;
      });
      if (isHoliday) {
        continue;
      }

      // Check if existing
      const existingIdx = updatedExistingReservations.findIndex(
        r => r.idUsuario === currentUser.id && r.data === dateStr
      );

      const statusValue = action === 'reservar' ? ReservaStatus.Reservado : ReservaStatus.Cancelado;

      if (existingIdx > -1) {
        updatedExistingReservations[existingIdx].status = statusValue;
        updatedExistingReservations[existingIdx].alteradoEm = new Date().toISOString();
      } else {
        // Create new
        const newRes: Reserva = {
          id: 'r-' + Math.random().toString(36).substr(2, 9),
          idUsuario: currentUser.id,
          data: dateStr,
          status: statusValue,
          consumido: false,
          idObraNoDia: currentUser.idObraPadrao,
          alteradoEm: new Date().toISOString(),
          ipOrigem: '192.168.1.15',
          dispositivo: 'SGR Mobile Batch'
        };
        newBatchReservations.push(newRes);
      }
    }

    const finalSet = [...updatedExistingReservations, ...newBatchReservations];
    setReservas(finalSet);
    
    // Save only user specific active set to Firestore to synchronize shared state
    const userReservas = finalSet.filter(r => r.idUsuario === currentUser.id);
    if (userReservas.length > 0) {
      saveBatchToFirestore('reservas', userReservas);
    }

    appendAuditLog(`Ação em lote (${action}) executada no período de ${startDate} a ${endDate}`);
    triggerFlashNotification(`Lote processado! Todos os dias úteis entre ${startDate} e ${endDate} foram alterados para: ${action.toUpperCase()}`);
  };

  const handleUpdatePassword = (newSenha: string) => {
    const updatedUser = { ...currentUser, senha: newSenha };
    setUsuarios(prev => prev.map(u => u.email === currentUser.email ? updatedUser : u));
    setCurrentUser(updatedUser);
    saveToFirestore('usuarios', updatedUser);
  };

  const handleUpdateNotifications = (enabled: boolean, timing: 'vespera' | 'mesmo_dia', time: string, tipo: 'reservada' | 'sem_reserva' | 'sempre') => {
    const updatedUser = { 
      ...currentUser, 
      alertaEnabled: enabled, 
      alertaTiming: timing, 
      alertaTime: time,
      alertaTipo: tipo
    };
    setUsuarios(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    saveToFirestore('usuarios', updatedUser);
    appendAuditLog(`Alterou configurações de alertas para: ${enabled ? 'Habilitado' : 'Desabilitado'} (${timing === 'vespera' ? 'Véspera' : 'No dia'} às ${time}, tipo: ${tipo})`);
  };

  // RH approves or blocks pending users with details provided at approval time
  const handleApproveUser = (
    id: string, 
    status: UserStatus, 
    extraData?: { 
      matricula: string; 
      idEmpresa: string; 
      idObraPadrao: string; 
      perfil: Perfil; 
      idObrasFornecedor?: string[]; 
      fotoBiometria?: string;
      senha?: string;
      requerTrocaSenha?: boolean;
    }
  ) => {
    const updated = usuarios.map(u => {
      if (u.id === id) {
        if (extraData && status === UserStatus.Aprovado) {
          return { 
            ...u, 
            status,
            matricula: extraData.matricula,
            idEmpresa: extraData.idEmpresa,
            idObraPadrao: extraData.idObraPadrao,
            perfil: extraData.perfil,
            idObrasFornecedor: extraData.idObrasFornecedor || [],
            fotoBiometria: extraData.fotoBiometria,
            senha: extraData.senha || u.senha || '1234@',
            requerTrocaSenha: extraData.requerTrocaSenha !== undefined ? extraData.requerTrocaSenha : true
          };
        }
        return { ...u, status };
      }
      return u;
    });
    setUsuarios(updated);

    const finalUserObj = updated.find(u => u.id === id);
    if (finalUserObj) {
      saveToFirestore('usuarios', finalUserObj);
    }

    const userObj = usuarios.find(u => u.id === id);
    
    let opMessage = '';
    if (status === UserStatus.Aprovado) {
      const empLabel = empresas.find(e => e.id === finalUserObj?.idEmpresa)?.nome || 'N/A';
      const obraLabel = obras.find(o => o.id === finalUserObj?.idObraPadrao)?.nome || 'N/A';
      opMessage = `Cadastro APROVADO: ${finalUserObj?.nome} (Mat: ${finalUserObj?.matricula || 'Sem Matrícula'}, Empresa: ${empLabel}, Setor: ${obraLabel}, Perfil: ${finalUserObj?.perfil})`;
    } else {
      opMessage = `Cadastro REJEITADO: Solicitante ${userObj?.nome}`;
    }
      
    appendAuditLog(opMessage);
    triggerFlashNotification(status === UserStatus.Aprovado ? `Colaborador aprovado com sucesso! Carimbo e dados salvos pelo RH. ✅` : `Cadastro rejeitado.`);
  };

  // Toggle user activation / block desocupado
  const handleToggleUserActive = (id: string) => {
    const updated = usuarios.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === UserStatus.Desativado ? UserStatus.Aprovado : UserStatus.Desativado;
        return { ...u, status: nextStatus };
      }
      return u;
    });
    setUsuarios(updated);

    const finalUserObj = updated.find(u => u.id === id);
    if (finalUserObj) {
      saveToFirestore('usuarios', finalUserObj);
    }

    const userObj = usuarios.find(u => u.id === id);
    const wasDeactivated = userObj?.status !== UserStatus.Desativado;
    const opMessage = wasDeactivated 
      ? `Usuário DESATIVADO (Desligador/Sem uso): ${userObj?.nome}`
      : `Usuário REATIVADO: ${userObj?.nome}`;

    appendAuditLog(opMessage);
    triggerFlashNotification(wasDeactivated ? `Colaborador desativado do ecossistema SGR.` : `Colaborador reativado!`);
  };

  // Permanently delete user and purge all corresponding bookings securely
  const handleDeleteUser = async (id: string) => {
    const userToDelete = usuarios.find(u => u.id === id);
    if (!userToDelete) return;

    // 1. Delete user document from Firestore'usuarios' collection
    try {
      await deleteDoc(doc(db, 'usuarios', id));
    } catch (e) {
      console.error("Error deleting user from Firestore:", e);
    }
    
    // 2. Delete all related reservations from Firestore 'reservas' collection
    const userReservations = reservas.filter(r => r.idUsuario === id);
    for (const res of userReservations) {
      try {
        await deleteDoc(doc(db, 'reservas', res.id));
      } catch (e) {
        console.error(`Error deleting reservation ${res.id} for user ${id}:`, e);
      }
    }

    // 3. Update local state directly so interface adapts immediately
    setUsuarios(prev => prev.filter(u => u.id !== id));
    setReservas(prev => prev.filter(r => r.idUsuario !== id));

    // 4. Log the audit activity
    appendAuditLog(`Usuário Excluído pelo RH: ${userToDelete.nome} (CPF: ${userToDelete.cpf || 'N/A'}). Todos os seus dados cadastrais e de reservas foram completamente expurgados do sistema de forma segura.`);
    triggerFlashNotification(`Usuário "${userToDelete.nome}" e todas as suas reservas foram excluídos com sucesso do SGR.`);
  };

  // Save Settings from Admin Panel
  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    saveSystemSettings(newSettings);
    appendAuditLog(`Parâmetros de Sistema atualizados: Limite=${newSettings.horarioLimite}, Preço Próprio=R$ ${newSettings.valorRefeicaoPropria}`);
    triggerFlashNotification('Parâmetros administrativos salvos com sucesso! ⚙');
  };

  // Save / Update Obra (Worksite) Settings & Pricing
  const handleSaveObra = async (newObra: Obra) => {
    setObras(prev => {
      const idx = prev.findIndex(o => o.id === newObra.id);
      if (idx >= 0) {
        const list = [...prev];
        list[idx] = newObra;
        return list;
      }
      return [...prev, newObra];
    });
    saveToFirestore('obras', newObra);
    appendAuditLog(`Unidade/Obra configurada: ${newObra.nome} (${newObra.centroCusto}) - Preço Refeição: R$ ${newObra.valorRefeicao?.toFixed(2) || 'Global (padrão)'}`);
    triggerFlashNotification(`Unidade ${newObra.nome} configurada com sucesso!`);
  };

  // Save / Update User (Colaborador) properties
  const handleSaveUser = async (updatedUser: Usuario) => {
    setUsuarios(prev => {
      const exists = prev.some(u => u.id === updatedUser.id);
      if (exists) {
        return prev.map(u => u.id === updatedUser.id ? updatedUser : u);
      } else {
        return [...prev, updatedUser];
      }
    });
    saveToFirestore('usuarios', updatedUser);
    
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    
    appendAuditLog(`Usuário salvo pelo RH: ${updatedUser.nome} (${updatedUser.email}) - Perfil: ${updatedUser.perfil}`);
    triggerFlashNotification(`Colaborador ${updatedUser.nome} salvo com sucesso!`);
  };

  // Save / Update Empresa properties
  const handleSaveEmpresa = async (newEmp: Empresa, originalId?: string) => {
    setEmpresas(prev => {
      let list = [...prev];
      if (originalId && originalId !== newEmp.id) {
        list = list.filter(e => e.id !== originalId);
        try {
          deleteDoc(doc(db, 'empresas', originalId));
        } catch (e) {
          console.error("Firestore delete empresa failed:", e);
        }
      }
      const idx = list.findIndex(e => e.id === newEmp.id);
      if (idx >= 0) {
        list[idx] = newEmp;
      } else {
        list.push(newEmp);
      }
      return list;
    });
    saveToFirestore('empresas', newEmp);
    appendAuditLog(`Ficha de Empresa homologada: ${newEmp.nome} (${newEmp.tipo})`);
    triggerFlashNotification(`Empresa ${newEmp.nome} configurada com sucesso!`);
  };

  const handleResetUserPassword = (userId: string, tempPass: string) => {
    let targetUser: Usuario | undefined;
    setUsuarios(prev => prev.map(u => {
      if (u.id === userId) {
        targetUser = { ...u, senha: tempPass };
        return targetUser;
      }
      return u;
    }));
    
    setTimeout(() => {
      if (targetUser) {
        saveToFirestore('usuarios', targetUser);
        appendAuditLog(`Recuperação de senha por e-mail realizada para: ${targetUser.nome}`);
      }
    }, 100);
  };

  // Save / Update Feriado properties
  const handleSaveFeriado = async (newFeriado: Feriado) => {
    setFeriados(prev => {
      const idx = prev.findIndex(f => f.id === newFeriado.id);
      if (idx >= 0) {
        const list = [...prev];
        list[idx] = newFeriado;
        return list;
      }
      return [...prev, newFeriado];
    });
    saveToFirestore('feriados', newFeriado);
    appendAuditLog(`Feriado configurado: ${newFeriado.descricao} na data ${newFeriado.data} (${newFeriado.abrangencia === 'especifico' ? 'Obras específicas' : 'Nacional'})`);
    triggerFlashNotification(`Feriado "${newFeriado.descricao}" gravado com sucesso!`);
  };

  // Delete Feriado
  const handleDeleteFeriado = async (id: string) => {
    const found = feriados.find(f => f.id === id);
    if (!found) return;

    setFeriados(prev => prev.filter(f => f.id !== id));
    try {
      await deleteDoc(doc(db, 'feriados', id));
    } catch (e) {
      console.error("Firestore delete holiday failed:", e);
    }
    appendAuditLog(`Feriado excluído: ${found.descricao} na data ${found.data}`);
    triggerFlashNotification(`Feriado "${found.descricao}" removido com sucesso.`);
  };

  // Clear reservations based on selected mode
  const handleClearAllReservas = async (mode: 'all' | 'future') => {
    const todayStr = getTodayDate();
    let toDelete = [...reservas];
    
    if (mode === 'future') {
      toDelete = toDelete.filter(res => res.data >= todayStr);
    }
    
    if (toDelete.length === 0) {
      triggerFlashNotification('Nenhuma reserva encontrada para os critérios selecionados.');
      return;
    }

    const modeText = mode === 'all' 
      ? 'TODAS as reservas (histórico completo de consumos e planejamentos futuros)' 
      : `reservas da data atual (${todayStr}) em diante`;

    let isConfirmed = false;
    try {
      isConfirmed = window.confirm(`ATENÇÃO CORP: Você selecionou apagar permanentemente ${toDelete.length} ${modeText}.\nDeseja prosseguir com essa exclusão definitiva no banco de dados Firestore?`);
    } catch (e) {
      isConfirmed = true; // safe fallback in iframe environments where confirm is blocked
    }
    if (!isConfirmed) return;

    // Delete in Firestore
    try {
      const { writeBatch } = await import('firebase/firestore');
      
      // Since Firestore batch limit is 500 operations, we chunk deletions in chunks of 400!
      const chunks: typeof toDelete[] = [];
      for (let i = 0; i < toDelete.length; i += 400) {
        chunks.push(toDelete.slice(i, i + 400));
      }
      
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(res => {
          if (res.id) {
            const docRef = doc(db, 'reservas', res.id);
            batch.delete(docRef);
          }
        });
        await batch.commit();
      }
      console.log(`[Firestore] Deleted ${toDelete.length} reservations successfully.`);
    } catch (e) {
      console.error("Erro ao deletar reservas no Firestore:", e);
      triggerFlashNotification('Ocorreu um erro ao excluir as reservas do banco de dados na nuvem.');
      return;
    }

    // Update state correctly
    if (mode === 'all') {
      setReservas([]);
      localStorage.setItem('sgr_reservas', JSON.stringify([]));
      appendAuditLog('Limpeza total efetuada: Todas as reservas passadas e futuras foram excluídas da nuvem.');
      triggerFlashNotification('Histórico e futuras reservas apagados com sucesso! 🗑️');
    } else {
      const remaining = reservas.filter(res => res.data < todayStr);
      setReservas(remaining);
      localStorage.setItem('sgr_reservas', JSON.stringify(remaining));
      appendAuditLog(`Limpeza parcial efetuada: Reservas apagadas de hoje (${todayStr}) em diante.`);
      triggerFlashNotification('Agendamentos futuros cancelados e removidos com sucesso! 🗑️');
    }
  };

  // Save / Add a reservation (especially for visitors or manually created by RH)
  const handleAddReserva = (newRes: Reserva) => {
    setReservas(prev => {
      // Prevent duplicates
      if (prev.some(r => r.id === newRes.id)) return prev;
      return [...prev, newRes];
    });
    saveToFirestore('reservas', newRes);
    const label = newRes.nomeVisitante ? `Visitante (${newRes.nomeVisitante})` : `Colaborador (${newRes.idUsuario})`;
    appendAuditLog(`Reserva avulsa/visita lançada pelo RH para ${label} no dia ${newRes.data}`);
    triggerFlashNotification(`Lançamento realizado: ${newRes.nomeVisitante || 'Refeição Colaborador'} agendada! 🟢`);
  };

  // Delete/Cancel a reservation manually by RH
  const handleDeleteReserva = async (id: string) => {
    setReservas(prev => prev.filter(r => r.id !== id));
    try {
      await deleteDoc(doc(db, 'reservas', id));
    } catch (e) {
      console.error("Firestore delete reservation failed:", e);
    }
    appendAuditLog(`Lançamento de reserva (${id}) deletado pelo RH`);
    triggerFlashNotification('Lançamento excluído com sucesso.');
  };

  // Simulated facial biometrics scan confirms withdrawal of meal in kitchen
  const handleConfirmWithdrawal = (idUsuario: string, date: string, excessFee: boolean) => {
    const existingIndex = reservas.findIndex(r => r.idUsuario === idUsuario && r.data === date);
    const userObj = usuarios.find(u => u.id === idUsuario);

    if (existingIndex > -1) {
      const updated = [...reservas];
      const selectedRes = { ...updated[existingIndex], consumido: true, alteradoEm: new Date().toISOString() };
      updated[existingIndex] = selectedRes;
      setReservas(updated);
      saveToFirestore('reservas', selectedRes);
      appendAuditLog(`Marmita retirada com Reconhecimento Facial por ${userObj?.nome} na cozinha da obra`, userObj?.nome, userObj?.email);
    } else if (excessFee) {
      // Create new booking directly since it's an excess of site meal
      const excessRes: Reserva = {
        id: 'r-' + Math.random().toString(36).substr(2, 9),
        idUsuario,
        data: date,
        status: ReservaStatus.Reservado,
        consumido: true,
        idObraNoDia: userObj?.idObraPadrao || 'o-1',
        alteradoEm: new Date().toISOString(),
        ipOrigem: '127.0.0.1 (Tablet Refeitório)',
        dispositivo: 'Tablet Samsung Refeitório'
      };
      setReservas(prev => [...prev, excessRes]);
      saveToFirestore('reservas', excessRes);
      appendAuditLog(`REFEIÇÃO EXCEDENTE RETIRADA: Gravado custo extra para obra de ${userObj?.nome} (sem reserva prévia)`, userObj?.nome, userObj?.email);
    }
  };

  // Register a new user from register modal form
  const handleRegisterUser = (newUser: Usuario, finishMessage: string) => {
    setUsuarios(prev => [...prev, newUser]);
    saveToFirestore('usuarios', newUser);
    
    // Audit Logging the solicitation
    const opLogMsg = newUser.status === UserStatus.Aprovado
      ? `Solicitação auto-aprovada por domínio corporativo: ${newUser.nome} (${newUser.email})`
      : `Novo cadastro pendente de aprovação do RH: ${newUser.nome} (${newUser.email})`;
      
    const auditUserName = newUser.nome;
    const auditUserEmail = newUser.email;
    
    // Temporarily append log with custom name
    const newLogItem: AuditoriaLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      usuarioNome: auditUserName,
      usuarioEmail: auditUserEmail,
      dataHora: `${new Date().toISOString().split('T')[0]}T${virtualTime}:00Z`,
      operacao: opLogMsg,
      ip: '189.231.11.45',
      dispositivo: 'External Registration Browser',
      perfil: newUser.perfil
    };
    
    setLogs(prev => [newLogItem, ...prev]);
    saveToFirestore('logs', newLogItem);
    triggerFlashNotification(finishMessage);

    // If autoApproved, switch simulations to this user to let them test!
    if (newUser.status === UserStatus.Aprovado) {
      setCurrentUser(newUser);
    }
  };

  // Handle first-access provisional password reset mandate
  const handleMandatoryPasswordReset = (newPassword: string) => {
    const updatedUser = {
      ...currentUser,
      senha: newPassword,
      requerTrocaSenha: false
    };

    // Update in Global list state
    setUsuarios(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);

    // Persist into LocalStorage list fallback
    const saved = localStorage.getItem('sgr_usuarios');
    if (saved) {
      try {
        const parsed: Usuario[] = JSON.parse(saved);
        const updatedList = parsed.map(u => u.id === currentUser.id ? updatedUser : u);
        localStorage.setItem('sgr_usuarios', JSON.stringify(updatedList));
      } catch {}
    }

    // Save to Firestore Database
    saveToFirestore('usuarios', updatedUser);

    // Corporate compliance audit log
    appendAuditLog(`ALTERAÇÃO OBRIGATÓRIA DE SENHA: Colaborador alterou a senha provisória de primeiro acesso com sucesso.`, currentUser.nome, currentUser.email);

    triggerFlashNotification(`Senha cadastrada com sucesso! Bem-vindo ao SGR da Fontana. 🔐`);
  };

  // Accept privacy terms & LGPD consent handler
  const handleAcceptLGPD = (ip: string) => {
    const updatedUser = {
      ...currentUser,
      aceitouLGPD: true,
      dataAceiteLGPD: new Date().toISOString(),
      ipAceiteLGPD: ip
    };
    
    // Update in Global list state
    setUsuarios(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    
    // Persist into LocalStorage list fallback
    const saved = localStorage.getItem('sgr_usuarios');
    if (saved) {
      try {
        const parsed: Usuario[] = JSON.parse(saved);
        const updatedList = parsed.map(u => u.id === currentUser.id ? updatedUser : u);
        localStorage.setItem('sgr_usuarios', JSON.stringify(updatedList));
      } catch {}
    }
    
    // Save to Firestore Database
    saveToFirestore('usuarios', updatedUser);
    
    // Corporate compliance audit log
    const logItem: AuditoriaLog = {
      id: 'log-lgpd-' + Math.random().toString(36).substr(2, 9),
      usuarioNome: currentUser.nome,
      usuarioEmail: currentUser.email || currentUser.matricula,
      dataHora: new Date().toISOString(),
      operacao: `CONCENTIMENTO LGPD OUTORGADO: Colaborador aceitou os Termos de Privacidade. IP: ${ip}`,
      ip: ip,
      dispositivo: 'SGR Mobile Interface (React PWA)',
      perfil: currentUser.perfil
    };
    
    setLogs(prev => [logItem, ...prev]);
    saveToFirestore('logs', logItem);
    
    triggerFlashNotification(`Termos de Privacidade (LGPD) aceitos com sucesso! Básico liberado. 🛡️`);
  };

  const handleDeclineLGPD = () => {
    if (modoProducao) {
      // Clear session logic
      localStorage.removeItem('sgr_is_logged');
      localStorage.removeItem('sgr_logged_user_id');
      setIsLogged(false);
      const foundAdmin = usuarios.find(u => u.perfil === Perfil.Admin) || usuarios[0];
      setCurrentUser(foundAdmin);
      triggerFlashNotification('Aceite da LGPD obrigatório recusado pelo usuário. Conexão encerrada.');
    } else {
      // In Simulation, revert back to simulation admin so they don't lock the simulator
      const foundAdmin = usuarios.find(u => u.perfil === Perfil.Admin) || usuarios[0];
      setCurrentUser(foundAdmin);
      triggerFlashNotification('Consentimento LGPD recusado. Retornando ao Perfil Admin de Simulação.');
    }
  };

  // Standard Factory reset
  const handleReset = () => {
    let isConfirmed = false;
    try {
      isConfirmed = window.confirm('Deseja realmente limpar todas as alterações e recarregar os dados padrões para demonstração?');
    } catch (e) {
      isConfirmed = true; // safe fallback
    }
    if (!isConfirmed) return;

    localStorage.removeItem('sgr_obras');
    localStorage.removeItem('sgr_empresas');
    localStorage.removeItem('sgr_usuarios');
    localStorage.removeItem('sgr_feriados');
    localStorage.removeItem('sgr_reservas');
    localStorage.removeItem('sgr_settings');
    localStorage.removeItem('sgr_logs');

    setObras(INITIAL_OBRAS);
    setEmpresas(INITIAL_EMPRESAS);
    setUsuarios(INITIAL_USUARIOS);
    setFeriados(INITIAL_FERIADOS);
    setReservas(INITIAL_RESERVAS);
    setSettings(INITIAL_SETTINGS);
    setLogs(INITIAL_LOGS);

    saveBatchToFirestore('obras', INITIAL_OBRAS);
    saveBatchToFirestore('empresas', INITIAL_EMPRESAS);
    saveBatchToFirestore('usuarios', INITIAL_USUARIOS);
    saveBatchToFirestore('feriados', INITIAL_FERIADOS);
    saveBatchToFirestore('reservas', INITIAL_RESERVAS);
    saveSystemSettings(INITIAL_SETTINGS);
    saveBatchToFirestore('logs', INITIAL_LOGS);

    setCurrentUser(INITIAL_USUARIOS[0]);
    setVirtualTime('07:30');
    setActiveTab('dashboard');
    
    triggerFlashNotification('Banco de dados em nuvem reiniciado com sucesso! 🔄');
  };

  // Utility mappings
  const getObraName = (id: string) => obras.find(o => o.id === id)?.nome || 'Sede';

  // Count pending users for simulation indicators
  const pendingCount = usuarios.filter(u => u.status === UserStatus.Pendente).length;

  const handleLogout = () => {
    localStorage.removeItem('sgr_is_logged');
    localStorage.removeItem('sgr_logged_user_id');
    setIsLogged(false);
    const foundAdmin = usuarios.find(u => u.perfil === Perfil.Admin) || usuarios[0];
    setCurrentUser(foundAdmin);
    triggerFlashNotification('Sessão encerrada com sucesso.');
  };

  // Login guard screen for Production Mode
  if (modoProducao && !isLogged) {
    return (
      <>
        <LoginScreen
          usuarios={usuarios}
          settings={settings}
          onLoginSuccess={(user) => {
            localStorage.setItem('sgr_is_logged', 'true');
            localStorage.setItem('sgr_logged_user_id', user.id);
            setCurrentUser(user);
          registerFCMToken(user.id);
            setIsLogged(true);
            triggerFlashNotification(`Bem-vindo, ${user.nome}! Identificação efetuada com sucesso.`);
          }}
          onOpenRegister={() => setIsRegisterOpen(true)}
          onResetPassword={handleResetUserPassword}
        />
        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          obras={obras}
          empresas={empresas}
          usuarios={usuarios}
          onRegister={handleRegisterUser}
        />
      </>
    );
  }

  return (
    <div className="bg-neutral-100 min-h-screen text-neutral-800 font-sans flex flex-col" id="app-root-container">
      
      {/* Simulation Header */}
      <SimulationHeader
        usuarios={usuarios}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        virtualTime={virtualTime}
        setVirtualTime={setVirtualTime}
        onReset={handleReset}
        onOpenRegister={() => setIsRegisterOpen(true)}
        pendingCount={pendingCount}
        modoProducao={modoProducao}
        setModoProducao={setModoProducao}
        onLogout={handleLogout}
        isAfterCutoff={isAfterCutoff}
        todayDate={todayDate}
        settings={settings}
      />

      {/* Main Flash Feedback alert */}
      {flashNotification && (
        <div className="max-w-7xl mx-auto px-4 mt-4 w-full" id="flash-notifier-overlay text-xs">
          <div className="bg-emerald-600 text-white p-3.5 rounded-xl shadow-lg border border-emerald-500 font-medium flex items-center gap-2.5 animate-[fadeIn_0.3s_ease]">
            <BellRing className="h-4.5 w-4.5 animate-bounce text-emerald-100 shrink-0" />
            <span className="text-sm">{flashNotification}</span>
          </div>
        </div>
      )}

      {/* Background/Scheduled PWA FCM Push Notification floating banner slide down */}
      {backgroundPushAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-sm bg-neutral-950/95 text-white p-4 rounded-2xl shadow-2xl border border-neutral-800 flex items-start gap-3 animate-[slideDown_0.3s_cubic-bezier(0.16,1,0.3,1)]" id="background-push-banner">
          <div className="bg-emerald-600 rounded-lg p-2 text-white shrink-0 shadow-inner">
            <Smartphone className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 pr-1 text-left">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase font-mono">SGR FONTANA • Alerta Push</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-xs leading-normal font-medium text-neutral-100">{backgroundPushAlert}</p>
          </div>
          <button 
            onClick={() => setBackgroundPushAlert(null)}
            className="text-neutral-500 hover:text-white transition p-0.5 rounded-full hover:bg-white/10 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Database offline/error feedback alert */}
      {dbState.status === 'error' && (
        <div className="max-w-7xl mx-auto px-4 mt-4 w-full" id="db-error-notifier">
          <div className="bg-amber-100 border border-amber-300 text-amber-950 p-4 rounded-xl shadow-sm font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-[pulse_2s_infinite]">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-amber-200 text-amber-800 rounded-lg text-xs font-bold whitespace-nowrap">⚠️ Sincronização offline</span>
              <span className="text-xs">{dbState.errorMsg || 'A conexão com o banco de dados falhou.'}</span>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="text-[11px] bg-amber-950 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-amber-900 transition shrink-0"
            >
              Recarregar Página 🔄
            </button>
          </div>
        </div>
      )}

      {/* Content Layout */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full flex flex-col gap-6" id="sgr-main-viewport">
        {/* Strict security checks: if user is pending, block fully */}
        {currentUser.status === UserStatus.Pendente ? (
          <div className="bg-white rounded-xl shadow p-12 text-center col-span-full border border-neutral-200 max-w-2xl mx-auto my-12 space-y-4" id="role-pending-gate">
            <span className="inline-block p-4 bg-amber-50 text-amber-600 rounded-full text-3xl">⏳</span>
            <h3 className="text-lg font-bold text-neutral-800">Seu Cadastro está PENDENTE</h3>
            <p className="text-xs text-neutral-500 leading-relaxed text-neutral-600">
              O colaborador <strong>{currentUser.nome}</strong> cadastrou-se recentemente. A liberação de reservas e consumo de refeições está bloqueada até que o administrador do RH aprove seu cadastro no painel.
            </p>
          </div>
        ) : (
          <>
            {/* View Switching Section */}
            <div className="flex flex-col md:flex-row gap-6">
              
              {/* Vertical Side Navigator */}
              <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2" id="sidebar-navigator">
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-neutral-400 px-3 hidden md:inline">
                  Menu Operacional
                </span>

                {/* Submenu links */}
                <div className="flex flex-row md:flex-col gap-1 overflow-x-auto p-1 bg-white md:bg-transparent rounded-lg border border-neutral-200 md:border-none shadow-xs md:shadow-none">
                  
                  {/* ADMIN ONLY BUTTONS */}
                  {currentUser.perfil === Perfil.Admin && (
                    <>
                      <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                          activeTab === 'dashboard'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-neutral-700 hover:bg-neutral-200'
                        }`}
                        id="nav-dashboard"
                      >
                        <LayoutDashboard className="h-4.5 w-4.5" /> Painel de Indicadores
                      </button>

                      <button
                        onClick={() => setActiveTab('colaborador')}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                          activeTab === 'colaborador'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-neutral-700 hover:bg-neutral-200'
                        }`}
                        id="nav-colaborador"
                      >
                        <CalendarRange className="h-4.5 w-4.5" /> Agenda do Colaborador
                      </button>

                      <button
                        onClick={() => setActiveTab('admin')}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                          activeTab === 'admin'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-neutral-700 hover:bg-neutral-200'
                        }`}
                        id="nav-admin"
                      >
                        <UsersRound className="h-4.5 w-4.5" /> Painel Administrativo
                        {pendingCount > 0 && (
                          <span className="ml-auto px-1.5 py-0.2 bg-rose-500 text-white text-[9px] rounded-full scale-105">
                            {pendingCount}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab('reports')}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                          activeTab === 'reports'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-neutral-700 hover:bg-neutral-200'
                        }`}
                        id="nav-reports"
                      >
                        <FilePieChart className="h-4.5 w-4.5" /> Relatórios & Custos
                      </button>

                      <button
                        onClick={() => setActiveTab('refeitorio')}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                          activeTab === 'refeitorio'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-neutral-700 hover:bg-neutral-200'
                        }`}
                        id="nav-refeitorio"
                      >
                        <ChefHat className="h-4.5 w-4.5" /> Tablet do Refeitório (Cozinha)
                      </button>

                      <button
                        onClick={() => setActiveTab('gestor')}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                          activeTab === 'gestor'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-neutral-700 hover:bg-neutral-200'
                        }`}
                        id="nav-gestor"
                      >
                        <HardHat className="h-4.5 w-4.5" /> Visão Gestor (Obras)
                      </button>
                    </>
                  )}

                  {/* COLABORADOR / ADMIN BUTTONS */}
                  {(currentUser.perfil === Perfil.Colaborador || currentUser.perfil === Perfil.Admin) && (
                    <button
                      onClick={() => setActiveTab('colaborador')}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'colaborador'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-neutral-750 bg-neutral-100 border border-neutral-200'
                      }`}
                      id="nav-colaborador-sec"
                    >
                      <CalendarRange className="h-4.5 w-4.5 text-emerald-600" /> Minha Agenda de Reservas
                    </button>
                  )}

                  {/* GESTOR ONLY BUTTONS */}
                  {currentUser.perfil === Perfil.Gestor && (
                    <button
                      onClick={() => setActiveTab('gestor')}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'gestor'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-neutral-750 bg-neutral-100 border border-neutral-200'
                      }`}
                      id="nav-gestor-sec"
                    >
                      <HardHat className="h-4.5 w-4.5 text-emerald-600" /> Minhas Equipes (Áreas/Obras)
                    </button>
                  )}

                  {/* FORNECEDOR ONLY BUTTONS */}
                  {currentUser.perfil === Perfil.Fornecedor && (
                    <button
                      onClick={() => setActiveTab('fornecedor')}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'fornecedor'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-neutral-750 bg-neutral-100 border border-neutral-200'
                      }`}
                      id="nav-fornecedor-sec"
                    >
                      <UtensilsCrossed className="h-4.5 w-4.5 text-emerald-600" /> Logística de Cozinha
                    </button>
                  )}

                </div>



                {/* Dispositivo e Biometria Widget */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs text-neutral-600 space-y-3 mt-4" id="biometrics-sidebar-badge">
                  <div className="flex items-center gap-2">
                    <Fingerprint className={`h-4.5 w-4.5 ${deviceBiometricActive ? 'text-emerald-600' : 'text-neutral-400'}`} />
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-neutral-400 block leading-none">
                      Biometria do Celular
                    </span>
                  </div>
                  
                  {deviceBiometricActive ? (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded text-[11px] text-emerald-800 font-medium">
                        ✅ Biometria ativa neste aparelho para <strong className="font-mono text-[10px]">{currentUser.email.split('@')[0]}</strong>.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('sgr_biometria_cadastrada_' + currentUser.email);
                          
                          // Remove from list
                          try {
                            const emails: string[] = JSON.parse(localStorage.getItem('sgr_biometria_cadastrada_emails') || '[]');
                            const filtered = emails.filter(e => e !== currentUser.email);
                            localStorage.setItem('sgr_biometria_cadastrada_emails', JSON.stringify(filtered));
                          } catch (e) {}

                          setDeviceBiometricActive(false);
                          appendAuditLog(`Usuário removeu cadastro de biometria deste dispositivo.`);
                          alert("Biometria desativada com sucesso neste aparelho!");
                        }}
                        className="w-full py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-150 text-[10px] rounded font-bold transition-all text-center"
                      >
                        Desativar Biometria
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] leading-relaxed text-neutral-500">
                        Acesse este aplicativo sem precisar digitar sua senha! Habilite o leitor físico ou facial próprio do seu celular.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsBiometriaSetupOpen(true)}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] rounded font-bold transition-all text-center flex items-center justify-center gap-1 shadow-sm"
                        id="activate-biometrics-sidebar-btn"
                      >
                        <Fingerprint className="w-3.5 h-3.5 animate-pulse" /> Ativar Biometria Celular
                      </button>
                    </div>
                  )}
                </div>

                {/* Account Settings & Notifications Shortcut Widget */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs text-neutral-600 space-y-3 mt-4" id="account-settings-sidebar-badge">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4.5 w-4.5 text-neutral-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-neutral-400 block leading-none">
                      Conta & Notificações
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] leading-relaxed text-neutral-500">
                      Altere sua senha de acesso e configure lembretes diários para confirmação de refeições no seu celular.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAccountSettingsOpen(true)}
                      className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-850 text-white text-[10px] rounded font-bold transition-all text-center flex items-center justify-center gap-1 shadow-sm"
                      id="open-account-settings-sidebar-btn"
                    >
                      <Settings className="w-3.5 h-3.5" /> Configurar Alertas & Senha
                    </button>
                  </div>
                </div>
              </aside>

              {/* Central Dynamic Context Area View Router */}
              <div className="flex-1" id="dynamic-viewport-container">
                {activeTab === 'dashboard' && currentUser.perfil === Perfil.Admin && (
                  <DashboardView
                    reservas={reservas}
                    usuarios={usuarios}
                    obras={obras}
                    empresas={empresas}
                    settings={settings}
                  />
                )}

                {activeTab === 'colaborador' && (
                  <ColaboradorView
                    currentUser={currentUser}
                    reservas={reservas}
                    feriados={feriados}
                    settings={settings}
                    isAfterCutoff={isAfterCutoff}
                    todayDate={todayDate}
                    onToggleReserva={handleToggleReserva}
                    onPeriodReserva={handlePeriodReserva}
                    obrasNome={getObraName}
                    obras={obras}
                    onSaveObra={handleSaveObra}
                  />
                )}

                {activeTab === 'admin' && currentUser.perfil === Perfil.Admin && (
                  <AdminView
                    usuarios={usuarios}
                    onApproveUser={handleApproveUser}
                    onToggleUserActive={handleToggleUserActive}
                    onDeleteUser={handleDeleteUser}
                    settings={settings}
                    onSaveSettings={handleSaveSettings}
                    logs={logs}
                    obras={obras}
                    empresas={empresas}
                    onSaveObra={handleSaveObra}
                    onSaveUser={handleSaveUser}
                    onSaveEmpresa={handleSaveEmpresa}
                    feriados={feriados}
                    onSaveFeriado={handleSaveFeriado}
                    onDeleteFeriado={handleDeleteFeriado}
                    onClearAllReservas={handleClearAllReservas}
                    reservas={reservas}
                    onAddReserva={handleAddReserva}
                    onDeleteReserva={handleDeleteReserva}
                  />
                )}

                {activeTab === 'reports' && currentUser.perfil === Perfil.Admin && (
                  <ReportsView
                    reservas={reservas}
                    usuarios={usuarios}
                    obras={obras}
                    empresas={empresas}
                    settings={settings}
                    todayDate={todayDate}
                  />
                )}

                {activeTab === 'refeitorio' && currentUser.perfil === Perfil.Admin && (
                  <RefeitorioView
                    reservas={reservas}
                    usuarios={usuarios}
                    obras={obras}
                    empresas={empresas}
                    settings={settings}
                    onConfirmWithdrawal={handleConfirmWithdrawal}
                  />
                )}

                {activeTab === 'gestor' && (currentUser.perfil === Perfil.Gestor || currentUser.perfil === Perfil.Admin) && (
                  <GestorView
                    currentUser={currentUser}
                    reservas={reservas}
                    usuarios={usuarios}
                    obras={obras}
                    empresas={empresas}
                    settings={settings}
                  />
                )}

                {activeTab === 'fornecedor' && currentUser.perfil === Perfil.Fornecedor && (
                  <FornecedorView
                    currentUser={currentUser}
                    reservas={reservas}
                    obras={obras}
                    settings={settings}
                  />
                )}
              </div>

            </div>
          </>
        )}
      </main>

      {/* Footer information bar */}
      <footer className="bg-neutral-900 border-t border-neutral-800 py-6 text-center text-xs text-neutral-500 mt-12 space-y-2">
        <p className="max-w-md mx-auto">
          APP Restaurante - FONTANA © 2026. Todos os direitos reservados.
        </p>
        <p className="text-[10px] text-neutral-600 font-mono">
          Desenvolvido com foco em auditoria civil, distribuição de custos e integrabilidade nativa de hardware ERP Sienge.
        </p>
      </footer>

      {/* Register dialog modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        obras={obras}
        empresas={empresas}
        usuarios={usuarios}
        onRegister={handleRegisterUser}
      />

      {/* Biometrics registration modal */}
      <BiometriaModal
        isOpen={isBiometriaSetupOpen}
        onClose={() => setIsBiometriaSetupOpen(false)}
        onSuccess={(registeredEmail) => {
          localStorage.setItem('sgr_biometria_cadastrada_' + registeredEmail, 'true');
          
          try {
            const emails: string[] = JSON.parse(localStorage.getItem('sgr_biometria_cadastrada_emails') || '[]');
            const cpfs: string[] = JSON.parse(localStorage.getItem('sgr_biometria_cadastrada_cpfs') || '[]');
            const isEmail = registeredEmail.includes('@');
            if (isEmail) {
              if (!emails.includes(registeredEmail)) {
                emails.push(registeredEmail);
                localStorage.setItem('sgr_biometria_cadastrada_emails', JSON.stringify(emails));
              }
            } else {
              if (!cpfs.includes(registeredEmail)) {
                cpfs.push(registeredEmail);
                localStorage.setItem('sgr_biometria_cadastrada_cpfs', JSON.stringify(cpfs));
              }
            }
          } catch (e) {}

          setDeviceBiometricActive(true);
          appendAuditLog(`Usuário cadastrou biometria do celular neste aparelho.`, currentUser.nome, currentUser.email);
          setIsBiometriaSetupOpen(false);
          
          // Show flash notification
          setFlashNotification("✅ Biometria ativada com sucesso! Agora você pode acessar o SGR FONTANA com apenas um toque biométrico neste celular.");
          setTimeout(() => setFlashNotification(null), 5000);
        }}
        mode="register"
        userEmail={currentUser.cpf || currentUser.email}
        usuarios={usuarios}
      />

      {/* Account Settings & Alertas Modal */}
      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        currentUser={currentUser}
        usuarios={usuarios}
        onUpdatePassword={handleUpdatePassword}
        onUpdateNotifications={handleUpdateNotifications}
        appendAuditLog={(msg, name, email) => appendAuditLog(msg, name || currentUser.nome, email || currentUser.email)}
        onTriggerFlash={(msg) => {
          setFlashNotification(msg);
          setTimeout(() => setFlashNotification(null), 5000);
        }}
        settings={settings}
      />

      {/* LGPD Consent System Modal */}
      <LgpdConsentModal
        isOpen={isLogged && !currentUser.aceitouLGPD}
        currentUser={currentUser}
        onAccept={handleAcceptLGPD}
        onDecline={handleDeclineLGPD}
      />

      {/* Primeiro Acesso: Redefinição Obrigatória de Senha Provisória */}
      <FirstAccessPasswordResetModal
        isOpen={isLogged && currentUser.aceitouLGPD && !!currentUser.requerTrocaSenha}
        currentUser={currentUser}
        onSubmit={handleMandatoryPasswordReset}
      />
    </div>
  );
}
