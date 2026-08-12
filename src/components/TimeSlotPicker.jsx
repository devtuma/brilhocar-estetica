import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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

  // Gerar horários padrão (08:00 a 18:00)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 60) {
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

  // Carregar horários agendados para a data
  useEffect(() => {
    const loadBookedSlots = async () => {
      if (!selectedDate) return;

      setLoading(true);
      try {
        // Buscar agendamentos do dia
        const appointmentsRef = collection(db, 'appointments');
        const q = query(
          appointmentsRef,
          where('date', '==', selectedDate),
          where('status', 'in', ['Aguardando Pagamento', 'Agendado', 'Veículo Recebido', 'Serviço Iniciado'])
        );

        const snapshot = await getDocs(q);
        const booked = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            time: data.time,
            duration: data.totalDuration || 60
          };
        });

        setBookedSlots(booked);
      } catch (err) {
        console.error('Erro ao carregar horários:', err);
        // Se der erro, assumimos que não há horários ocupados
        setBookedSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookedSlots();
  }, [selectedDate]);

  // Verificar se um horário está disponível
  const isSlotAvailable = (time) => {
    if (bookedSlots.length === 0) return true;

    // Converter horário para minutos
    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + appointmentDuration;

    // Verificar se há algum agendamento que conflita
    for (const booking of bookedSlots) {
      const bookingStart = timeToMinutes(booking.time);
      const bookingEnd = bookingStart + (booking.duration || 60);

      // Verificar sobreposição
      if (slotStart < bookingEnd && slotEnd > bookingStart) {
        return false;
      }
    }

    return true;
  };

  // Selecionar horário
  const handleSelect = (time) => {
    if (!isSlotAvailable(time)) return;
    setSelectedTime(time);
    onSelectTime(time);
  };

  // Formatar data para exibição
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const allSlots = generateTimeSlots();
  const availableCount = allSlots.filter(t => isSlotAvailable(t)).length;

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
