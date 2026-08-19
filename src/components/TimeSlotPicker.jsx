import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export default function TimeSlotPicker({
  selectedDate,
  onSelectTime,
  appointmentDuration = 60,
  onClose
}) {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTime, setSelectedTime] = useState(null);
  const [businessHours, setBusinessHours] = useState(() => {
    // Defaults iniciais
    return {
      monday: { open: '08:00', close: '18:00', active: true },
      tuesday: { open: '08:00', close: '18:00', active: true },
      wednesday: { open: '08:00', close: '18:00', active: true },
      thursday: { open: '08:00', close: '18:00', active: true },
      friday: { open: '08:00', close: '18:00', active: true },
      saturday: { open: '08:00', close: '14:00', active: true },
      sunday: { open: '08:00', close: '18:00', active: false },
    };
  });
  const [blockedDates, setBlockedDates] = useState([]);
  const [blockedRanges, setBlockedRanges] = useState({}); // intervalos bloqueados por dia da semana: {monday: [{start,end}], ...}
  const [blockedHours, setBlockedHours] = useState({}); // fallback legibilidade

  // Helper: "HH:MM" → minutos
  const toMinutes = (time) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Verifica se um slot está dentro de algum intervalo bloqueado
  const isSlotBlockedByRange = (time, dayRanges, durationMins) => {
    if (!dayRanges || dayRanges.length === 0) return false;
    const slotStart = toMinutes(time);
    const slotEnd = slotStart + durationMins;
    return dayRanges.some(r => {
      const bStart = toMinutes(r.start);
      const bEnd = toMinutes(r.end);
      // Sobreposição: [slotStart, slotEnd) intersect [bStart, bEnd)
      return slotStart < bEnd && bStart < slotEnd;
    });
  };

  // Gerar horários baseado na config do admin
  const generateTimeSlots = () => {
    // Default caso config não exista (8h-18h, todos os dias)
    const defaultHours = {
      monday: { open: '08:00', close: '18:00', active: true },
      tuesday: { open: '08:00', close: '18:00', active: true },
      wednesday: { open: '08:00', close: '18:00', active: true },
      thursday: { open: '08:00', close: '18:00', active: true },
      friday: { open: '08:00', close: '18:00', active: true },
      saturday: { open: '08:00', close: '14:00', active: true },
      sunday: { open: '08:00', close: '18:00', active: false },
    };
    const hoursConfig = (businessHours && Object.keys(businessHours).length > 0) ? businessHours : defaultHours;

    const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayOfWeek];
    const dayConfig = hoursConfig[dayKey];
    const dayRanges = blockedRanges[dayKey] || [];

    if (!dayConfig || !dayConfig.active) {
      return [];
    }

    const slots = [];
    const [openH, openM] = dayConfig.open.split(':').map(Number);
    const [closeH, closeM] = dayConfig.close.split(':').map(Number);
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    const duration = appointmentDuration || 60;

    for (let m = openMin; m + duration <= closeMin; m += 60) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeSlot = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push(timeSlot);
    }

    return slots;
  };

  // Carregar config de horários + agendamentos
  useEffect(() => {
    const loadData = async () => {
      if (!selectedDate) return;
      setLoading(true);

      try {
        // Buscar config (businessHours + blockedDates)
        const configSnap = await getDoc(doc(db, 'config', 'main'));
        if (configSnap.exists()) {
          const data = configSnap.data();
          if (data.businessHours) {
            // Normalizar chaves (remover espaços extras que podem vir do Firestore)
            const normalized = {};
            Object.keys(data.businessHours).forEach(dayKey => {
              const dayConfig = data.businessHours[dayKey];
              // Chave pode vir como "active" ou "active " (com espaço)
              const activeValue = dayConfig.active ?? dayConfig['active '];
              normalized[dayKey] = {
                open: dayConfig.open || dayConfig['open '] || '08:00',
                close: dayConfig.close || dayConfig['close '] || '18:00',
                active: activeValue === true || activeValue === 'true',
              };
            });
            console.log('[TimeSlotPicker] businessHours normalizado:', normalized);
            setBusinessHours(normalized);
          } else {
            console.warn('[TimeSlotPicker] config existe mas sem businessHours');
          }
          if (data.blockedDates) setBlockedDates(data.blockedDates);
          if (data.blockedRanges) setBlockedRanges(data.blockedRanges);
          if (data.blockedHours) setBlockedHours(data.blockedHours); // fallback legado
        }

        // Buscar agendamentos do dia
        const appointmentsRef = collection(db, 'appointments');
        const q = query(
          appointmentsRef,
          where('date', '==', selectedDate),
          where('status', 'in', ['Aguardando Pagamento', 'Agendado', 'Veículo Recebido', 'Serviço Iniciado'])
        );

        const snapshot = await getDocs(q);
        const now = Date.now();
        // SLOT_TIMEOUT: 10 minutos (tempo para confirmar pagamento PIX)
        // Após esse tempo, o slot é liberado para outra pessoa marcar
        const SLOT_HOLD_MS = 10 * 60 * 1000;
        const booked = snapshot.docs.map(doc => {
          const d = doc.data();
          const data = {
            time: d.time,
            duration: d.totalDuration || 60,
            status: d.status,
            createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt ? new Date(d.createdAt).getTime() : 0)
          };
          return data;
        }).filter(d => {
          // IMPORTANTE: Slots com 'Aguardando Pagamento' só bloqueiam por 10 minutos
          // Depois disso, o slot é LIBERADO para outra pessoa agendar
          if (d.status === 'Aguardando Pagamento') {
            const elapsed = now - d.createdAt;
            if (elapsed > SLOT_HOLD_MS) {
              console.log(`[TimeSlotPicker] Liberando slot ${d.time} (Aguardando há ${Math.round(elapsed/60000)}min)`);
              return false; // Não conta como ocupado
            }
          }
          return true; // Conta como ocupado
        }).map(d => ({ time: d.time, duration: d.duration }));

        setBookedSlots(booked);
      } catch (err) {
        console.error('Erro ao carregar horários:', err);
        setBookedSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDate]);

  // Verificar se um horário está disponível
  const isSlotAvailable = (time) => {
    if (!time) return false;

    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + appointmentDuration;

    // 0. Verificar se o horário já passou (se for HOJE)
    // CORREÇÃO: não permitir agendar horários que já passaram
    const now = new Date();
    const selected = new Date(selectedDate + 'T00:00:00');
    const isToday = selected.toDateString() === now.toDateString();
    if (isToday) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (slotEnd <= nowMinutes) {
        // Slot termina no passado - indisponível
        return false;
      }
      // Se slot está parcialmente no passado mas termina no futuro, ainda pode ser selecionado
      // MAS só se faltar pelo menos 30 minutos para começar (margem de preparação)
      if (slotStart < nowMinutes + 30) {
        return false;
      }
    }

    // 1. Verificar agendamentos existentes
    for (const booking of bookedSlots) {
      const bookingStart = timeToMinutes(booking.time);
      const bookingEnd = bookingStart + (booking.duration || 60);
      if (slotStart < bookingEnd && slotEnd > bookingStart) {
        return false;
      }
    }

    // 2. Verificar intervalos bloqueados pelo admin (formato novo: blockedRanges)
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[new Date(selectedDate + 'T12:00:00').getDay()];
    const dayRanges = blockedRanges[dayKey] || [];
    for (const range of dayRanges) {
      const bStart = timeToMinutes(range.start);
      const bEnd = timeToMinutes(range.end);
      if (slotStart < bEnd && bStart < slotEnd) {
        return false;
      }
    }

    // 3. Fallback: horários bloqueados (formato antigo: blockedHours)
    const dayBlockedHours = blockedHours[dayKey] || [];
    if (dayBlockedHours.includes(time)) {
      return false;
    }

    return true;
  };

  const handleSelect = (time) => {
    if (!isSlotAvailable(time)) return;
    setSelectedTime(time);
    onSelectTime(time);
  };

  const formatDate = (dateStr) => {
    // Adicionar T12:00:00 para evitar problema de timezone UTC vs local
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  // Verifica se a data está bloqueada
  const isBlockedDate = blockedDates.includes(selectedDate);

  // Se a data está bloqueada, mostra mensagem
  if (isBlockedDate) {
    return (
      <div className="bg-surface border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Clock className="text-red-500" size={20} />
          </div>
          <div>
            <h3 className="font-bold">Data Indisponível</h3>
            <p className="text-xs text-gray-400">{formatDate(selectedDate)}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400 mb-2">Esta data está bloqueada para agendamentos.</p>
          <p className="text-xs text-gray-500">Por favor escolha outra data.</p>
        </div>
      </div>
    );
  }

  const allSlots = generateTimeSlots();
  const availableCount = allSlots.filter(t => isSlotAvailable(t)).length;

  // Se não há slots (dia fechado)
  if (allSlots.length === 0) {
    return (
      <div className="bg-surface border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Clock className="text-red-500" size={20} />
          </div>
          <div>
            <h3 className="font-bold">Loja Fechada</h3>
            <p className="text-xs text-gray-400">{formatDate(selectedDate)}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400 mb-2">A loja não funciona neste dia da semana.</p>
          <p className="text-xs text-gray-500">Por favor escolha outra data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-gray-800 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Clock className="text-primary" size={20} />
          </div>
          <div>
            <h3 className="font-bold">Horários Disponíveis</h3>
            <p className="text-xs text-gray-400">{formatDate(selectedDate)}</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {availableCount}/{allSlots.length} disponíveis
        </div>
      </div>

      {/* Slots */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {allSlots.map(time => {
            const available = isSlotAvailable(time);
            const isSelected = selectedTime === time;

            return (
              <button
                key={time}
                disabled={!available}
                onClick={() => handleSelect(time)}
                className={`
                  py-3 px-2 rounded-xl text-sm font-semibold transition-all
                  ${isSelected
                    ? 'bg-primary text-black'
                    : available
                      ? 'bg-gray-800 text-white hover:bg-gray-700 hover:border-gray-600 border border-transparent'
                      : 'bg-gray-900 text-gray-600 cursor-not-allowed opacity-50'
                  }
                `}
              >
                <div className="flex items-center justify-center gap-1">
                  {isSelected && <Check size={14} className="shrink-0" />}
                  <span>{time}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-800 border border-gray-700"></div>
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary"></div>
            <span>Selecionado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-900 opacity-50"></div>
            <span>Ocupado</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          * Duração estimada: ~{appointmentDuration} minutos por serviço selecionado
        </p>
      </div>
    </div>
  );
}
