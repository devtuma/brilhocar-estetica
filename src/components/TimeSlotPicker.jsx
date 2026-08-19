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
          // CRITICO: incluir TODOS os status que ocupam slot, exceto Cancelados/Expirados
          where('status', 'in', ['Aguardando Pagamento', 'Agendado', 'Veículo Recebido', 'Serviço Iniciado'])
        );

        const snapshot = await getDocs(q);
        const now = Date.now();
        // IMPORTANTE: Slots com pagamento pendente ficam RESERVADOS ate o PIX expirar (10min)
        // APOS o PIX expirar, o slot e liberado (isso e feito pela Cloud Function checkExpiredPayments
        // que muda pixStatus para 'expired' e mantem o appointment, mas so conta como ocupado se pixStatus === 'paid')
        const SLOT_HOLD_MS = 10 * 60 * 1000;
        const booked = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            time: d.time,
            duration: d.totalDuration || 60,
            status: d.status,
            pixStatus: d.pixStatus,
            pixExpiresAt: d.pixExpiresAt?.toMillis ? d.pixExpiresAt.toMillis() : (d.pixExpiresAt ? new Date(d.pixExpiresAt).getTime() : 0),
            createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt ? new Date(d.createdAt).getTime() : 0),
            id: doc.id
          };
        }).filter(d => {
          // CRITICO: Cancelados nunca contam como ocupado
          if (d.status === 'Cancelado') return false;
          if (d.pixStatus === 'expired') return false; // PIX expirado = slot livre
          if (d.pixStatus === 'cancelled') return false;
          // Se ja foi pago, sempre bloqueia
          if (d.pixStatus === 'paid') return true;
          // Se esta aguardando pagamento, bloqueia ate expirar
          if (d.status === 'Aguardando Pagamento') {
            const elapsed = now - d.createdAt;
            if (elapsed > SLOT_HOLD_MS) {
              console.log(`[TimeSlotPicker] Liberando slot ${d.time} (PIX expirado)`);
              return false; // Liberar slot
            }
          }
          return true; // Bloquear slot
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

  // Estado para tooltip de horário ocupado
  const [hoveredOccupiedSlot, setHoveredOccupiedSlot] = useState(null);

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
            // Encontrar info do agendamento que bloqueia este slot
            const occupyingBooking = !available ? bookedSlots.find(b => {
              const bookingStart = timeToMinutes(b.time);
              const bookingEnd = bookingStart + (b.duration || 60);
              const slotStart = timeToMinutes(time);
              const slotEnd = slotStart + appointmentDuration;
              return slotStart < bookingEnd && slotEnd > bookingStart;
            }) : null;

            return (
              <div key={time} className="relative">
                <button
                  disabled={!available}
                  onClick={() => handleSelect(time)}
                  onMouseEnter={() => !available && setHoveredOccupiedSlot(time)}
                  onMouseLeave={() => setHoveredOccupiedSlot(null)}
                  className={`
                    w-full py-3 px-2 rounded-xl text-sm font-semibold transition-all relative
                    ${isSelected
                      ? 'bg-primary text-black'
                      : available
                        ? 'bg-gray-800 text-white hover:bg-gray-700 border border-transparent'
                        : 'bg-gray-900/50 cursor-not-allowed'
                    }
                  `}
                >
                  {/* Overlay riscado para horários ocupados */}
                  {!available && (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl">
                      {/* Linhas diagonais de "riscado" */}
                      <div className="absolute inset-0 opacity-30">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#ef4444" strokeWidth="2" />
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className={`flex items-center justify-center gap-1 ${!available ? 'text-gray-500' : ''}`}>
                    {isSelected && <Check size={14} className="shrink-0" />}
                    <span className={!available ? 'line-through decoration-red-500/70' : ''}>{time}</span>
                  </div>

                  {/* Indicador de ocupado */}
                  {!available && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">✕</span>
                    </div>
                  )}
                </button>

                {/* Tooltip com info do agendamento */}
                {hoveredOccupiedSlot === time && occupyingBooking && (
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-red-500/50 rounded-lg shadow-xl whitespace-nowrap">
                    <div className="text-xs font-bold text-red-400 mb-1">⛔ Horário Ocupado</div>
                    <div className="text-[10px] text-gray-400 space-y-0.5">
                      <div>🕐 {occupyingBooking.time}</div>
                      <div>⏱️ {occupyingBooking.duration || 60} min</div>
                      {occupyingBooking.pixStatus === 'paid' && (
                        <div className="text-green-400">✅ Pagamento confirmado</div>
                      )}
                      {occupyingBooking.status === 'Aguardando Pagamento' && (
                        <div className="text-yellow-400">⏳ Aguardando PIX</div>
                      )}
                      {['Agendado', 'Veículo Recebido', 'Serviço Iniciado'].includes(occupyingBooking.status) && (
                        <div className="text-blue-400">📋 {occupyingBooking.status}</div>
                      )}
                    </div>
                    {/* Seta do tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
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
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <line x1="0" y1="0" x2="100%" y2="100%" stroke="#ef4444" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <span className="text-red-400/70">Ocupado</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          * Duração estimada: ~{appointmentDuration} minutos por serviço selecionado
        </p>
      </div>
    </div>
  );
}
