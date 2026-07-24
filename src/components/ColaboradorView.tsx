/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Usuario, Reserva, ReservaStatus, Feriado, SystemSettings, Obra, Perfil } from '../types';
import { Calendar as CalendarIcon, Check, X, ShieldAlert, Clock, RefreshCw, FileText, Download, AlertTriangle, MousePointerClick, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { downloadPdfOrFile, dataUrlToBlob, blobToDataUrl } from '../lib/downloadHelper';

interface Refeicao {
  pratoPrincipal: string;
  acompanhamentos: string;
  sobremesaBebida: string;
  tipo: string;
}

const CARDAPIO_ROTATIVO: Record<number, Refeicao> = {
  1: { // Segunda
    pratoPrincipal: 'Virado à Paulista com Bisteca de Porco Grelhada',
    acompanhamentos: 'Arroz Branco, Feijão Carioca, Couve Refogada, Ovo Frito',
    sobremesaBebida: 'Doce de Leite Mineiro e Suco de Maracujá Orgânico',
    tipo: 'Padrão'
  },
  2: { // Terça
    pratoPrincipal: 'Frango Assado com Batatas Coradas ao Perfume de Alecrim',
    acompanhamentos: 'Arroz com Brócolis, Feijão Preto, Purê de Batatas Cremoso',
    sobremesaBebida: 'Flan de Baunilha com Calda de Caramelo e Suco de Uva',
    tipo: 'Padrão'
  },
  3: { // Quarta
    pratoPrincipal: 'Feijoada Completa Premium com Torresmo e Vinagrete',
    acompanhamentos: 'Arroz Branco, Farofa de Mandioca, Couve Mineira, Laranja fatiada',
    sobremesaBebida: 'Pudim de Leite Condensado e Suco de Caju Fresco',
    tipo: 'Padrão'
  },
  4: { // Quinta
    pratoPrincipal: 'Carne de Panela Macia ao Molho de Tomate Rústico',
    acompanhamentos: 'Arroz Branco, Feijão Carioca, Polenta Cremosa, Legumes Refogados',
    sobremesaBebida: 'Gelatina de Morango e Suco de Laranja Natural',
    tipo: 'Padrão'
  },
  5: { // Sexta
    pratoPrincipal: 'Filé de Merluza Grelhado com Molho de Camarão Alcaparrado',
    acompanhamentos: 'Arroz Branco, Feijão Carioca, Purê de Mandioquinha, Salada de Alface',
    sobremesaBebida: 'Mousse de Limão e Chá Gelado de Pêssego',
    tipo: 'Padrão'
  },
  6: { // Sábado
    pratoPrincipal: 'Churrasco Misto (Linguiça, Sobrecoxa e Alcatra fatiada)',
    acompanhamentos: 'Arroz Carreteiro, Farofa de Ovos, Salada de Maionese de Batatas',
    sobremesaBebida: 'Sorvete de Creme e Suco de Abacaxi com Hortelã',
    tipo: 'Especial Fim de Semana'
  },
  0: { // Domingo
    pratoPrincipal: 'Lasanha à Bolonhesa Clássica com Queijo Muçarela Gratinado',
    acompanhamentos: 'Arroz Branco, Batata Palha, Salada Verde de Folhas Nobres',
    sobremesaBebida: 'Pavê de Chocolate Belga e Chá Matte Gelado com Limão',
    tipo: 'Especial Fim de Semana'
  }
};

const getDayOfWeekIndex = (dateString: string) => {
  const dateObj = new Date(dateString + 'T12:00:00');
  return dateObj.getDay(); // 0 is Sunday, 1 is Monday ...
};

const getDayOfWeekName = (dateString: string) => {
  const names = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  return names[getDayOfWeekIndex(dateString)];
};

interface ColaboradorViewProps {
  currentUser: Usuario;
  reservas: Reserva[];
  feriados: Feriado[];
  settings: SystemSettings;
  isAfterCutoff: boolean;
  todayDate: string;
  onToggleReserva: (date: string) => void;
  onPeriodReserva: (startDate: string, endDate: string, action: 'reservar' | 'cancelar') => void;
  obrasNome: (id: string) => string;
  obras: Obra[];
  onSaveObra?: (obra: Obra) => Promise<void>;
}

export default function ColaboradorView({
  currentUser,
  reservas,
  feriados,
  settings,
  isAfterCutoff,
  todayDate,
  onToggleReserva,
  onPeriodReserva,
  obrasNome,
  obras,
  onSaveObra,
}: ColaboradorViewProps) {
  
  // Active calendar view month and year states initialized dynamically to the real current month/year
  const [currentYear, setCurrentYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    return new Date().getMonth(); // 0-indexed (e.g. July is 6)
  });
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // States for Batch/Period Booking (next Monday to Friday of the todayDate)
  const [batchStart, setBatchStart] = useState<string>(() => {
    const baseDateStr = todayDate === '2026-06-13' ? (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })() : todayDate;

    if (baseDateStr) {
      const start = new Date(baseDateStr + 'T12:00:00');
      const nextMonday = new Date(start);
      const day = nextMonday.getDay();
      const distance = (1 - day + 7) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + distance);
      const year = nextMonday.getFullYear();
      const month = String(nextMonday.getMonth() + 1).padStart(2, '0');
      const dayVal = String(nextMonday.getDate()).padStart(2, '0');
      return `${year}-${month}-${dayVal}`;
    }
    return '2026-06-15'; // Monday next week of simulation start
  });

  const [batchEnd, setBatchEnd] = useState<string>(() => {
    const baseDateStr = todayDate === '2026-06-13' ? (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })() : todayDate;

    if (baseDateStr) {
      const start = new Date(baseDateStr + 'T12:00:00');
      const nextMonday = new Date(start);
      const day = nextMonday.getDay();
      const distance = (1 - day + 7) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + distance);
      
      const nextFriday = new Date(nextMonday);
      nextFriday.setDate(nextFriday.getDate() + 4);
      
      const year = nextFriday.getFullYear();
      const month = String(nextFriday.getMonth() + 1).padStart(2, '0');
      const dayVal = String(nextFriday.getDate()).padStart(2, '0');
      return `${year}-${month}-${dayVal}`;
    }
    return '2026-06-19'; // Friday next week of simulation start
  });

  // Synchronize calendar view, active dates and selected menu date when todayDate changes
  React.useEffect(() => {
    if (todayDate) {
      const parts = todayDate.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const mn = parseInt(parts[1], 10) - 1;
        
        setSelectedMenuDate(todayDate);
        
        // Dynamic batch dates for the new todayDate
        const baseDateStr = todayDate === '2026-06-13' ? (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })() : todayDate;

        const start = new Date(baseDateStr + 'T12:00:00');
        const nextMonday = new Date(start);
        const day = nextMonday.getDay();
        const distance = (1 - day + 7) % 7 || 7;
        nextMonday.setDate(nextMonday.getDate() + distance);
        
        const nextFriday = new Date(nextMonday);
        nextFriday.setDate(nextFriday.getDate() + 4);
        
        const formatDate = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dy}`;
        };
        
        setBatchStart(formatDate(nextMonday));
        setBatchEnd(formatDate(nextFriday));
      }
    }
  }, [todayDate]);

  const [batchAction, setBatchAction] = useState<'reservar' | 'cancelar'>('reservar');
  const [showBatchResult, setShowBatchResult] = useState<string | null>(null);

  // States for interactive range selection and cancel confirmation
  const [activePickerField, setActivePickerField] = useState<'start' | 'end' | null>(null);
  const [cancelConfirmationDate, setCancelConfirmationDate] = useState<string | null>(null);

  const applyShortcut = (shortcut: 'proximos_5' | 'proxima_semana' | 'todo_mes') => {
    const start = new Date(todayDate + 'T12:00:00');
    if (isAfterCutoff) {
      start.setDate(start.getDate() + 1);
    }
    
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (shortcut === 'proximos_5') {
      const dates: string[] = [];
      let current = new Date(start);
      while (dates.length < 5) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          dates.push(formatDate(current));
        }
        current.setDate(current.getDate() + 1);
      }
      if (dates.length > 0) {
        setBatchStart(dates[0]);
        setBatchEnd(dates[dates.length - 1]);
      }
    } else if (shortcut === 'proxima_semana') {
      const nextMonday = new Date(start);
      const day = nextMonday.getDay();
      const distance = (1 - day + 7) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + distance);
      
      const nextFriday = new Date(nextMonday);
      nextFriday.setDate(nextFriday.getDate() + 4);
      
      setBatchStart(formatDate(nextMonday));
      setBatchEnd(formatDate(nextFriday));
    } else if (shortcut === 'todo_mes') {
      const startLimit = formatDate(start);
      const activeFirstDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const activeLastDay = new Date(currentYear, currentMonth + 1, 0);
      const activeLastDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(activeLastDay.getDate()).padStart(2, '0')}`;
      
      const calcStart = startLimit > activeLastDayStr ? activeLastDayStr : (startLimit < activeFirstDayStr ? activeFirstDayStr : startLimit);
      setBatchStart(calcStart);
      setBatchEnd(activeLastDayStr);
    }
  };


  const colaboradorObra = obras.find(o => o.id === currentUser.idObraPadrao);
  const [cachedCardapioBlob, setCachedCardapioBlob] = useState<Blob | null>(null);
  const [isFetchingCardapioBlob, setIsFetchingCardapioBlob] = useState(false);
  const [cachedCardapioDataUrl, setCachedCardapioDataUrl] = useState<string | null>(null);

  // Pre-fetch remote cardapio or convert dataUrl to Blob in advance so the download button uses a ready Blob synchronously
  React.useEffect(() => {
    const cardapioUrl = colaboradorObra?.cardapioUrl;
    if (!cardapioUrl) {
      setCachedCardapioBlob(null);
      setCachedCardapioDataUrl(null);
      setIsFetchingCardapioBlob(false);
      return;
    }

    if (cardapioUrl.startsWith('data:')) {
      try {
        const b = dataUrlToBlob(cardapioUrl);
        setCachedCardapioBlob(b);
        setCachedCardapioDataUrl(cardapioUrl);
      } catch (e) {
        console.warn('Failed to parse dataUrlToBlob for cardapioUrl:', e);
        setCachedCardapioBlob(null);
        setCachedCardapioDataUrl(null);
      }
      setIsFetchingCardapioBlob(false);
      return;
    }

    if (cardapioUrl.startsWith('http://') || cardapioUrl.startsWith('https://')) {
      let cancelled = false;
      setIsFetchingCardapioBlob(true);
      fetch(cardapioUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return res.blob();
        })
        .then(b => {
          if (!cancelled) {
            setCachedCardapioBlob(b);
                                  blobToDataUrl(b)
                                                .then(du => { if (!cancelled) setCachedCardapioDataUrl(du); })
                                                              .catch(() => {})
                                                                            .finally(() => { if (!cancelled) setIsFetchingCardapioBlob(false); });
          }
        })
        .catch(err => {
          if (!cancelled) {
            console.warn('Pre-fetch do cardápio falhou:', err);
            setCachedCardapioBlob(null);
            setCachedCardapioDataUrl(null);
            setIsFetchingCardapioBlob(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [colaboradorObra?.cardapioUrl]);

  // Helper: Download a file reliably on all browsers and mobile WebViews (Google Play apps), using Web Share API or safe anchor triggers.
  const downloadCardapioFile = async (sourceUrl: string, filename: string) => {
    try {
      if (!sourceUrl) return;

      if (isFetchingCardapioBlob) {
        alert('O arquivo do cardápio ainda está sendo preparado. Aguarde um instante...');
        return;
      }

      const isDataUrl = sourceUrl.startsWith('data:');
      await downloadPdfOrFile({
        blob: cachedCardapioBlob,
        dataUrl: cachedCardapioDataUrl || (isDataUrl ? sourceUrl : undefined),
        url: sourceUrl,
        filename,
        title: 'Cardápio Semanal — Fontana',
        mimeType: 'application/pdf',
      });
    } catch (e: any) {
      console.error('Erro ao gerar download do cardápio:', e);
      alert(e?.message || 'Erro ao baixar o arquivo do cardápio. Tente novamente.');
    }
  };
  
  // Custom Cardapio State
  const [selectedMenuDate, setSelectedMenuDate] = useState<string>(todayDate);
  const [isUploadingCardapio, setIsUploadingCardapio] = useState(false);
  const [newPdfName, setNewPdfName] = useState('');
  const [newPdfContent, setNewPdfContent] = useState(''); // holds either a base64 or URL
  const [dragOverCardapio, setDragOverCardapio] = useState(false);

  // Quick Upload Cardapio handlers
  const handleQuickUploadFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Erro: Envie apenas arquivos no formato PDF!');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const colaboradorObra = obras.find(o => o.id === currentUser.idObraPadrao);
      if (!colaboradorObra) {
        alert('Erro: Nenhuma obra de lotação ativa associada ao seu usuário.');
        return;
      }
      if (!onSaveObra) {
        alert('Erro interno: callback de salvamento não está disponível.');
        return;
      }
      
      const fileData = ev.target?.result as string;
      const updated: Obra = {
        ...colaboradorObra,
        cardapioUrl: fileData,
        cardapioNome: file.name,
        cardapioAtualizadoEm: new Date().toISOString()
      };
      
      try {
        setIsUploadingCardapio(true);
        await onSaveObra(updated);
        setNewPdfName(file.name);
        setNewPdfContent(fileData);
        alert(`Sucesso! O cardápio "${file.name}" foi publicado para a unidade ${colaboradorObra.nome}.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao atualizar o cardápio no servidor.');
      } finally {
        setIsUploadingCardapio(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickSaveUrl = async (urlStr: string, nameStr: string) => {
    if (!urlStr) {
      alert('Por favor, digite um link de URL válido primeiro.');
      return;
    }
    const colaboradorObra = obras.find(o => o.id === currentUser.idObraPadrao);
    if (!colaboradorObra) {
      alert('Erro: Nenhuma obra de lotação ativa associada ao seu usuário.');
      return;
    }
    if (!onSaveObra) {
      alert('Erro interno: callback de salvamento não está disponível.');
      return;
    }

    const docName = nameStr.trim() || 'cardapio_link.pdf';
    const updated: Obra = {
      ...colaboradorObra,
      cardapioUrl: urlStr.trim(),
      cardapioNome: docName,
      cardapioAtualizadoEm: new Date().toISOString()
    };

    try {
      setIsUploadingCardapio(true);
      await onSaveObra(updated);
      setNewPdfName(docName);
      setNewPdfContent(urlStr.trim());
      alert(`Sucesso! O link do cardápio "${docName}" foi publicado para a unidade ${colaboradorObra.nome}.`);
    } catch (err) {
      console.error(err);
      alert('Erro ao vincular o cardápio.');
    } finally {
      setIsUploadingCardapio(false);
    }
  };

  // Minimum selectable date calculations
  const getMinBatchDate = () => {
    const d = new Date(todayDate + 'T12:00:00');
    if (isAfterCutoff) {
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const minBatchDate = getMinBatchDate();

  // Helper to determine day status and label
  const getDayInfo = (dateStr: string) => {
    // 1. Is it a holiday applicable to this user's obra?
    const holiday = feriados.find(f => {
      if (f.data !== dateStr) return false;
      // If national coverage (or legacy, undefined abrangencia), it impacts everyone
      if (!f.abrangencia || f.abrangencia === 'nacional') return true;
      // If specific coverage, only if current user's default work location is assigned
      return f.idObras?.includes(currentUser.idObraPadrao) ?? false;
    });
    
    // 2. Is there an active reservation?
    const reservation = reservas.find(r => r.idUsuario === currentUser.id && r.data === dateStr);
    
    // 3. Is it weekend?
    const isWeekend = false; // We can parse the actual day of week
    const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
    const isSatOrSun = dayOfWeek === 0 || dayOfWeek === 6;

    // 4. Is the date editable?
    let isLocked = false;
    let lockReason = '';

    if (holiday) {
      isLocked = true;
      lockReason = `Feriado / Ponte: ${holiday.descricao}`;
    } else if (dateStr < todayDate) {
      isLocked = true;
      lockReason = 'Data passada';
    } else if (dateStr === todayDate && isAfterCutoff) {
      isLocked = true;
      lockReason = `Horário Limite Excedido (Após ${settings.horarioLimite})`;
    } else if (isSatOrSun && !settings.permitirFinsDeSemana) {
      isLocked = true;
      lockReason = 'Fins de Semana Bloqueados';
    }

    return {
      holiday,
      reservation,
      isSatOrSun,
      isLocked,
      lockReason,
    };
  };

  // Click date handler
  const handleDateClick = (dateStr: string) => {
    // Automatically focus menu preview on clicked date
    setSelectedMenuDate(dateStr);

    if (activePickerField === 'start') {
      const minCalculated = getMinBatchDate();
      if (dateStr < minCalculated) {
        alert(`O período selecionado deve começar a partir do primeiro dia disponível: ${formatDateLabel(minCalculated)}`);
        return;
      }
      setBatchStart(dateStr);
      if (!batchEnd || batchEnd < dateStr) {
        setBatchEnd(dateStr);
      }
      setActivePickerField('end');
      return;
    }
    if (activePickerField === 'end') {
      const minCalculated = getMinBatchDate();
      if (dateStr < minCalculated) {
        alert(`O período selecionado deve começar a partir do primeiro dia disponível: ${formatDateLabel(minCalculated)}`);
        return;
      }
      if (dateStr < batchStart) {
        alert('A data final não pode ser anterior à data inicial.');
        return;
      }
      setBatchEnd(dateStr);
      setActivePickerField(null);
      return;
    }

    const info = getDayInfo(dateStr);
    if (info.isLocked) {
      alert(`⚠️ Alteração bloqueada para o dia ${formatDateLabel(dateStr)}: ${info.lockReason}`);
      return;
    }
    
    // Check if confirming cancel
    if (info.reservation && info.reservation.status === ReservaStatus.Reservado) {
      setCancelConfirmationDate(dateStr);
    } else {
      onToggleReserva(dateStr);
    }
  };

  // Batch run handler
  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchStart || !batchEnd) {
      alert('Selecione data inicial e data final.');
      return;
    }
    if (batchStart > batchEnd) {
      alert('A data inicial não pode ser superior à data final.');
      return;
    }

    // Standard warnings for past dates
    if (batchStart < todayDate) {
      alert('Atenção: datas passadas incluídas no lote não serão alteradas.');
    }

    onPeriodReserva(batchStart, batchEnd, batchAction);
    setShowBatchResult(`Reserva em lote processada para o período de ${formatDateLabel(batchStart)} até ${formatDateLabel(batchEnd)}!`);
    setTimeout(() => setShowBatchResult(null), 5000);
  };

  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  // Generate calendar dates matrix helper for the selected month/year
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const dates: string[] = [];
    while (date.getMonth() === month) {
      const y = date.getFullYear();
      const mStr = String(date.getMonth() + 1).padStart(2, '0');
      const dStr = String(date.getDate()).padStart(2, '0');
      dates.push(`${y}-${mStr}-${dStr}`);
      date.setDate(date.getDate() + 1);
    }
    return dates;
  };

  const getMonthOffset = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...
    // Map Sunday (0) to 6, Monday (1) to 0, Tuesday (2) to 1, etc.
    return firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  };

  const currentMonthDays = getDaysInMonth(currentYear, currentMonth);
  const startOffset = getMonthOffset(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Count employee statistics in selected Month/Year
  const formatMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const userMonthReservas = reservas.filter(r => r.idUsuario === currentUser.id && r.data.startsWith(formatMonthStr));
  const totalReservados = userMonthReservas.filter(r => r.status === ReservaStatus.Reservado).length;
  const totalCancelados = userMonthReservas.filter(r => r.status === ReservaStatus.Cancelado).length;
  const totalConsumidos = userMonthReservas.filter(r => r.status === ReservaStatus.Reservado && (r.consumido || !settings.usarTabletRetirada)).length;

  // Calcule o valor total de desconto em folha e custo original por obra com base no histórico
  let totalCustoCozinha = 0;
  let totalDescontoReservado = 0;
  let totalDescontoConsumido = 0;

  userMonthReservas.forEach(r => {
    if (r.status === ReservaStatus.Reservado) {
      const oId = r.idObraNoDia || currentUser.idObraPadrao;
      const oObj = obras.find(o => o.id === oId);
      const price = oObj?.valorRefeicao && oObj.valorRefeicao > 0 ? oObj.valorRefeicao : settings.valorRefeicaoPropria;
      const discount = oObj?.valorDescontoColaborador ?? 0;

      totalCustoCozinha += price;
      totalDescontoReservado += discount;

      const isCons = r.consumido || !settings.usarTabletRetirada;
      if (isCons) {
        totalDescontoConsumido += discount;
      }
    }
  });

  const formattedTodayText = (() => {
    try {
      const d = new Date(todayDate + 'T12:00:00');
      return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    } catch {
      return '13 de Junho';
    }
  })();

  return (
    <div className="space-y-6" id="colaborador-view-panel">
      
      {/* Banner / Instructions */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="md:col-span-2">
          <h3 className="font-bold text-neutral-800 text-base" id="persona-welcome-title">
            Painel do Colaborador: {currentUser.nome}
          </h3>
          <p className="text-xs text-neutral-600 mt-1 max-w-xl">
            Clique diretamente no dia do calendário para inverter seu status de reserva. Para planejar férias ou semanas completas, utilize o painel de <strong>Reserva por Período</strong> ao lado.
          </p>
          <div className="mt-3 flex gap-4 text-xs text-neutral-600 font-medium">
            <span>📍 Obra Vinculada: <strong>{obrasNome(currentUser.idObraPadrao)}</strong></span>
            <span>💳 Registro: <strong>{currentUser.matricula}</strong></span>
          </div>
        </div>

        <div className="bg-neutral-50 px-4 py-3 rounded-lg border border-neutral-200 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-neutral-500">
            Resumos Gerais ({monthNames[currentMonth].substring(0,3)}/{String(currentYear).substring(2)})
          </span>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded flex flex-col justify-center min-h-[64px]" title="Total de reservas do período">
              <span className="block text-sm font-extrabold">{totalReservados}</span>
              <span className="text-[9px] font-medium text-neutral-500">Reservas</span>
            </div>
            <div className="p-1.5 bg-neutral-100 text-neutral-800 rounded flex flex-col justify-center min-h-[64px]" title="Reservas canceladas no período">
              <span className="block text-sm font-extrabold">{totalCancelados}</span>
              <span className="text-[9px] font-medium text-neutral-550">Cancelas</span>
            </div>
            <div className="p-1.5 bg-rose-50 text-rose-800 rounded flex flex-col justify-center min-h-[64px]" title="Valor total de desconto em folha do período">
              <span className="block text-sm font-extrabold">R$ {totalDescontoReservado.toFixed(2)}</span>
              <span className="text-[9px] font-medium text-rose-500">Desc. Folha</span>
            </div>
          </div>
          
          <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex flex-col gap-0.5 text-[10px] text-neutral-500">
            <div className="flex justify-between items-center">
              <span>Custo Total na Cozinha:</span>
              <span className="font-semibold text-neutral-700">R$ {totalCustoCozinha.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Valor Pago pela Empresa:</span>
              <span className="font-bold text-emerald-700">R$ {(totalCustoCozinha - totalDescontoReservado).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Interactive Calendar */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm lg:col-span-2 space-y-4" id="calendar-block">
          <div className="flex justify-between items-center pb-2 border-b border-neutral-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-emerald-600" />
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-neutral-100 rounded cursor-pointer text-neutral-600 transition border border-neutral-200"
                title="Mês Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 font-sans">
                {/* Month Dropdown Selector */}
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="px-2 py-1 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans cursor-pointer"
                  id="calendar-month-select"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>

                {/* Year Dropdown Selector */}
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  className="px-2 py-1 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans cursor-pointer"
                  id="calendar-year-select"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </select>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-neutral-100 rounded cursor-pointer text-neutral-600 transition border border-neutral-200"
                title="Próximo Mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Status color legend keys */}
          <div className="flex flex-wrap gap-3 py-1 bg-neutral-50 p-2 rounded text-[10px] font-mono justify-around">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 bg-emerald-500 border border-emerald-600 rounded" />
              <span className="text-neutral-700 font-bold">🟢 Reservado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 bg-white border border-neutral-300 rounded" />
              <span className="text-neutral-700">⚪ Sem Reserva</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 bg-amber-200 border border-amber-300 rounded" />
              <span className="text-neutral-700">🟡 Feriado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 bg-neutral-200 border border-neutral-300 opacity-60 rounded" />
              <span className="text-neutral-700">🔒 Bloqueado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 border-2 border-blue-600 rounded" />
              <span className="text-neutral-700 font-bold">🔵 Hoje</span>
            </div>
          </div>

          {/* Grid Headers - Days of the Week */}
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-mono font-bold text-neutral-400 border-b border-neutral-100 pb-1 pt-2">
            <span>SEG</span>
            <span>TER</span>
            <span>QUA</span>
            <span>QUI</span>
            <span>SEX</span>
            <span className="text-amber-600">SÁB</span>
            <span className="text-amber-600">DOM</span>
          </div>

          {/* Calendar Grid Matrix */}
          <div className="grid grid-cols-7 gap-2.5" id="navigable-calendar-matrix">
            {/* Empty Offset cells */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div 
                key={`empty-${i}`} 
                className="min-h-[75px] p-2 bg-neutral-50/50 border border-neutral-100/70 rounded-lg opacity-40 select-none" 
              />
            ))}

            {currentMonthDays.map((dateStr) => {
              const dayNum = parseInt(dateStr.split('-')[2]);
              const { reservation, holiday, isSatOrSun, isLocked, lockReason } = getDayInfo(dateStr);
              const isToday = dateStr === todayDate;

              // Style calculation
              let cardBg = 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-400 cursor-pointer';
              let badgeText = '';

              if (holiday) {
                cardBg = 'bg-amber-100 text-amber-800 border-amber-300 cursor-pointer hover:bg-amber-150';
                badgeText = 'Feriado';
              } else if (reservation && reservation.status === ReservaStatus.Reservado) {
                cardBg = 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-sm cursor-pointer';
                if (reservation.consumido || !settings.usarTabletRetirada) {
                  badgeText = settings.usarTabletRetirada ? '✓ Consumido' : '✓ Entregue';
                } else {
                  badgeText = 'Reservado';
                }
              } else if (isSatOrSun && !settings.permitirFinsDeSemana) {
                cardBg = 'bg-neutral-100 text-neutral-400 border-neutral-200 opacity-65 cursor-not-allowed';
                badgeText = 'Fim de Sem.';
              } else {
                badgeText = 'Sem reserva';
              }

              // Overwrite for locked fields
              let buttonLockClass = '';
              if (isLocked) {
                buttonLockClass = ' relative ';
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateClick(dateStr)}
                  disabled={false} // Click registers always but shows explanations in alert if locked
                  className={`min-h-[75px] p-2 flex flex-col justify-between border rounded-lg transition-all text-left text-xs ${cardBg} ${buttonLockClass} ${
                    isToday ? 'ring-2 ring-blue-500 ring-offset-1 font-bold' : ''
                  }`}
                  id={`calendar-day-${dayNum}`}
                  title={`${dateStr} - Click para reservar/cancelar.${lockReason ? ` [Motivo bloqueio: ${lockReason}]` : ''}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-sm leading-none font-bold">
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="px-1 py-0.5 bg-blue-600 text-white text-[8px] font-bold rounded uppercase leading-none">
                        Hoje
                      </span>
                    )}
                    {isLocked && !holiday && (
                      <span className="text-neutral-400" title={lockReason}>🔒</span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1.5">
                    {/* Badge text */}
                    {badgeText && (
                      <span className="block text-[8px] font-mono leading-none tracking-tight break-all font-semibold uppercase">
                        {badgeText}
                      </span>
                    )}
                    {/* Holiday description */}
                    {holiday && (
                      <span className="block text-[8px] leading-tight text-amber-700 truncate font-medium bg-amber-200/50 p-0.5 rounded" title={holiday.descricao}>
                        {holiday.descricao}
                      </span>
                    )}
                    {/* Consumed verification */}
                    {reservation && reservation.status === ReservaStatus.Reservado && (reservation.consumido || !settings.usarTabletRetirada) && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] bg-emerald-700 text-white px-1 py-0.2 rounded font-mono font-bold leading-none">
                        {settings.usarTabletRetirada ? 'FACIAL OK' : 'ENTREGUE'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Guidelines notes */}
          <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <span className="text-[11px] text-neutral-600 leading-relaxed max-w-lg">
              ℹ **Regra do Horário Limite:** Até **{settings.horarioLimite}**, você pode reservar ou cancelar o dia atual livremente. Após o horário limite, o dia atual fica bloqueado para quaisquer edições de forma a evitar desperdícios.
            </span>
            <div className="text-[10px] font-semibold text-neutral-500 bg-white px-2 py-1.5 border border-neutral-200 rounded flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-600" />
              <span>Limite configurado: {settings.horarioLimite}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Batch / Period booking and Today's Menu */}
        <div className="space-y-6" id="period-and-menu-blocks">
          {/* Batch reservation form */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4" id="batch-form-block">
            <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-wide flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-sky-500" /> Reserva por Período
            </h4>
            <p className="text-xs text-neutral-500">
              Reserve ou cancele refeições para múltiplos dias úteis ao mesmo tempo. Facilitado para férias ou semanas cheias.
            </p>

            {showBatchResult && (
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded text-xs text-indigo-700 font-medium">
                {showBatchResult}
              </div>
            )}

            {activePickerField && (
              <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-lg text-xs text-sky-700 font-bold flex flex-col gap-1.5 animate-pulse" id="picker-helper-banner">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 bg-sky-500 h-2 rounded-full animate-ping"></span>
                  🎯 Clique em um dia do calendário principal para definir a <strong>{activePickerField === 'start' ? 'Data Inicial' : 'Data Final'}</strong>!
                </span>
                <button
                  type="button"
                  onClick={() => setActivePickerField(null)}
                  className="text-left text-[10px] uppercase underline text-sky-600 hover:text-sky-805 font-black cursor-pointer"
                >
                  Cancelar seleção direta
                </button>
              </div>
            )}

            <form onSubmit={handleBatchSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Data Inicial</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="date"
                    required
                    value={batchStart}
                    min={minBatchDate}
                    max="2027-12-31"
                    onChange={(e) => setBatchStart(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white text-neutral-800 text-center font-semibold"
                    id="batch-start-date"
                  />
                  <button
                    type="button"
                    onClick={() => setActivePickerField(activePickerField === 'start' ? null : 'start')}
                    className={`p-1.5 border rounded cursor-pointer transition flex items-center justify-center ${
                      activePickerField === 'start'
                        ? 'bg-sky-500 border-sky-600 text-white'
                        : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-300 text-neutral-600'
                    }`}
                    title="Definir clicando diretamente no calendário"
                  >
                    <MousePointerClick className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">Data Final</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="date"
                    required
                    value={batchEnd}
                    min={minBatchDate}
                    max="2027-12-31"
                    onChange={(e) => setBatchEnd(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white text-neutral-800 text-center font-semibold"
                    id="batch-end-date"
                  />
                  <button
                    type="button"
                    onClick={() => setActivePickerField(activePickerField === 'end' ? null : 'end')}
                    className={`p-1.5 border rounded cursor-pointer transition flex items-center justify-center ${
                      activePickerField === 'end'
                        ? 'bg-sky-500 border-sky-600 text-white'
                        : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-300 text-neutral-600'
                    }`}
                    title="Definir clicando diretamente no calendário"
                  >
                    <MousePointerClick className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Quick preselected shortcuts */}
              <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200/60 space-y-1">
                <span className="block text-[9px] uppercase font-bold text-neutral-500">Atalhos para Navegação Rápida:</span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => applyShortcut('proximos_5')}
                    className="py-1 px-1 bg-white hover:bg-neutral-100 text-neutral-700 text-[9px] font-bold rounded transition border border-neutral-300 cursor-pointer text-center truncate shadow-2xs"
                  >
                    🚀 Próx. 5 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShortcut('proxima_semana')}
                    className="py-1 px-1 bg-white hover:bg-neutral-100 text-neutral-700 text-[9px] font-bold rounded transition border border-neutral-300 cursor-pointer text-center truncate shadow-2xs"
                  >
                    📅 Próx. Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShortcut('todo_mes')}
                    className="py-1 px-1 bg-white hover:bg-neutral-100 text-neutral-700 text-[9px] font-bold rounded transition border border-neutral-300 cursor-pointer text-center truncate shadow-2xs"
                  >
                    📊 Resto do Mês
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBatchAction('reservar')}
                  className={`py-2 text-xs font-semibold rounded border transition-all ${
                    batchAction === 'reservar'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                  id="batch-action-reserve"
                >
                  🟢 Reservar Tudo
                </button>
                <button
                  type="button"
                  onClick={() => setBatchAction('cancelar')}
                  className={`py-2 text-xs font-semibold rounded border transition-all ${
                    batchAction === 'cancelar'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                  id="batch-action-cancel"
                >
                  ⚪ Cancelar Tudo
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-neutral-950 text-white hover:bg-neutral-850 rounded text-xs font-bold transition-all mt-2.5 flex items-center justify-center gap-1"
                id="apply-batch-btn"
              >
                Aplicar no Período
              </button>
            </form>
          </div>

          {/* Today's standard menu placeholder PDF style layout */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4" id="menu-block">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100 flex-wrap gap-2">
              <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" /> Cardápio da Obra
              </h4>
              <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-500 font-mono">
                {obras.find(o => o.id === currentUser.idObraPadrao)?.nome || 'Sem obra'}
              </span>
            </div>

            {(() => {
              const colaboradorObra = obras.find(o => o.id === currentUser.idObraPadrao);
              const temCardapio = colaboradorObra && colaboradorObra.cardapioUrl;

              return (
                <div className="space-y-4">
                  {/* PDF Segment if active */}
                  {temCardapio ? (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-3" id="cardapio-oficial-preview">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Cardápio Oficial Disponível</span>
                        </div>
                        {colaboradorObra.cardapioAtualizadoEm && (
                          <span className="text-[10px] text-emerald-700 font-medium bg-emerald-100/70 px-2 py-0.5 rounded-full font-mono">
                            {new Date(colaboradorObra.cardapioAtualizadoEm).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      
                      <div className="bg-white border border-emerald-100 rounded-xl p-3.5 shadow-xs space-y-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-black text-neutral-800 truncate" title={colaboradorObra.cardapioNome}>
                              {colaboradorObra.cardapioNome || 'Cardápio Oficial PDF'}
                            </span>
                            <span className="block text-[10px] text-neutral-500 font-medium mt-0.5">
                              Atualizado: {colaboradorObra.cardapioAtualizadoEm ? new Date(colaboradorObra.cardapioAtualizadoEm).toLocaleDateString('pt-BR') : 'Recentemente'}
                            </span>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          disabled={isFetchingCardapioBlob}
                          onClick={() => downloadCardapioFile(colaboradorObra.cardapioUrl, colaboradorObra.cardapioNome || 'cardapio.pdf')}
                          className={`w-full py-2.5 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-2 ${
                            isFetchingCardapioBlob
                              ? 'bg-emerald-400 cursor-not-allowed opacity-80'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer'
                          }`}
                          title="Baixar arquivo do cardápio diretamente"
                          id="btn-download-cardapio-direto"
                        >
                          {isFetchingCardapioBlob ? (
                            <>
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                              <span>Preparando Cardápio...</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 shrink-0" />
                              <span>Baixar Cardápio PDF</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 text-[10.5px] font-semibold leading-normal flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="block font-black text-neutral-850">Cardápio Indisponível</span>
                        <span className="text-neutral-600 font-normal mt-0.5 block">Nenhum cardápio oficial em PDF foi cadastrado para a unidade <strong>{colaboradorObra?.nome ?? 'de lotação'}</strong> no momento.</span>
                        {onSaveObra && (currentUser.perfil === Perfil.Admin || currentUser.perfil === Perfil.Gestor || currentUser.perfil === Perfil.Fornecedor) ? (
                          <span className="block text-emerald-700 font-bold mt-1.5">
                            ⚙️ Gestor: Utilize a área técnica abaixo para enviar o arquivo original PDF.
                          </span>
                        ) : (
                          <span className="block text-neutral-500 font-normal mt-1 italic">Consulte o encarregado da cozinha ou a administração da obra.</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Informational Calendar interaction tip replacing the random food block */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-[10.5px] text-neutral-600 leading-relaxed flex items-start gap-2">
                    <MousePointerClick className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-850">Agendamentos no Calendário:</strong> Selecione qualquer dia no calendário ao lado para verificar seus agendamentos correspondentes ou gerenciar suas reservas de forma individual.
                    </div>
                  </div>

                  {/* Admin/Gestor Quick-Update Tools Box */}
                  {onSaveObra && (currentUser.perfil === Perfil.Admin || currentUser.perfil === Perfil.Gestor || currentUser.perfil === Perfil.Fornecedor) && (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3" id="quick-upload-admin-cardapio">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animated-spin" />
                          <span>Área Técnica: Enviar Cardápio PDF</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold uppercase rounded font-mono">Acesso Admin</span>
                      </div>

                      <div className="space-y-3">
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
                            if (file) handleQuickUploadFile(file);
                          }}
                          onClick={() => document.getElementById('quick-pdf-file-input')?.click()}
                          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                            dragOverCardapio
                              ? 'border-emerald-500 bg-emerald-50'
                              : newPdfContent.startsWith('data:')
                              ? 'border-emerald-300 bg-emerald-50/20 text-neutral-700'
                              : 'border-neutral-300 hover:border-neutral-400 bg-white text-neutral-500'
                          }`}
                        >
                          <input
                            type="file"
                            id="quick-pdf-file-input"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleQuickUploadFile(file);
                            }}
                          />
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <FileText className={`h-6 w-6 text-neutral-400 ${newPdfContent.startsWith('data:') ? 'text-emerald-500' : ''}`} />
                            {newPdfName ? (
                              <div className="space-y-0.5 max-w-full">
                                <p className="text-[10px] font-bold text-emerald-850 truncate">{newPdfName}</p>
                                <p className="text-[8px] text-neutral-400 font-mono">Arquivo lido com sucesso ✓</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-[10px] font-bold text-neutral-700">Escolher arquivo ou Arrastar PDF aqui</p>
                                <p className="text-[8px] text-neutral-400">Apenas .PDF no formato oficial</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Text input to paste a direct URL easily */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[9px] uppercase font-bold text-neutral-500 font-mono">Ou vincular Link Web (URL) direto:</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newPdfContent.startsWith('data:') ? '' : newPdfContent}
                              placeholder="https://exemplo.com/doc.pdf"
                              onChange={(e) => {
                                setNewPdfContent(e.target.value);
                                if (!newPdfName || newPdfName.endsWith('.pdf')) {
                                  setNewPdfName(e.target.value.substring(e.target.value.lastIndexOf('/') + 1) || 'cardapio_link.pdf');
                                }
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white text-neutral-800 placeholder-neutral-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuickSaveUrl(newPdfContent, newPdfName)}
                              className="px-3 bg-neutral-900 text-white rounded text-[11px] font-bold hover:bg-neutral-800 transition active:scale-95"
                            >
                              Vincular URL
                            </button>
                          </div>
                        </div>

                        {colaboradorObra && (colaboradorObra.cardapioUrl) && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('Deseja realmente remover o PDF do cardápio vinculado a esta unidade?')) {
                                const updated = {
                                  ...colaboradorObra,
                                  cardapioUrl: '',
                                  cardapioNome: '',
                                  cardapioAtualizadoEm: ''
                                };
                                if (onSaveObra) {
                                  await onSaveObra(updated);
                                  setNewPdfContent('');
                                  setNewPdfName('');
                                  alert('Cardápio removido com sucesso!');
                                }
                              }
                            }}
                            className="w-full py-1 text-[9px] bg-red-50 hover:bg-red-100 text-red-600 rounded font-bold border border-red-200 transition"
                          >
                            🗑️ Limpar / Remover Cardápio PDF Existente
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="text-[10px] text-neutral-500 font-mono text-center pt-2 border-t border-neutral-200/50">
              ⚠️ Em caso de restrições alimentares, avise o encarregado da cozinha da obra com 24h de antecedência.
            </div>
          </div>
        </div>

      </div>

      {/* Cancel Confirmation Dialog Modal */}
      {cancelConfirmationDate && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="cancel-confirmation-modal">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-amber-500 text-white px-5 py-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-white" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">Confirmar Cancelamento</h3>
            </div>
            
            <div className="p-5 space-y-3">
              <p className="text-xs text-neutral-600 leading-relaxed">
                Você realmente deseja cancelar a sua reserva de refeição para o dia <strong className="text-neutral-800 font-bold">{formatDateLabel(cancelConfirmationDate)} ({monthNames[parseInt(cancelConfirmationDate.split('-')[1]) - 1]}/{cancelConfirmationDate.split('-')[0]})</strong>?
              </p>
              <div className="bg-neutral-50 px-3 py-2.5 rounded-lg border border-neutral-150 flex items-start gap-2">
                <span className="text-xs">⚠️</span>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  Colaboradores sem reserva ativa não terão refeição contabilizada no faturamento da obra para este dia.
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-200 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCancelConfirmationDate(null)}
                className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 text-xs font-bold rounded-lg hover:bg-neutral-100 transition cursor-pointer"
              >
                Voltar / Manter Reserva
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cancelConfirmationDate) {
                    onToggleReserva(cancelConfirmationDate);
                    setCancelConfirmationDate(null);
                  }
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition-all cursor-pointer"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
