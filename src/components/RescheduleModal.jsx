import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, serverTimestamp, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Loader2, Send } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export default function RescheduleModal({ appointment, onClose }) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [config, setConfig] = useState({ hoursWindow: 24, retentionPercent: 50 });
  const [availableSlots, setAvailableSlots] = useState([]);

  // Carregar config e horários disponíveis
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists()) {
        const r = snap.data().rescheduleConfig;
        if (r) setConfig({
          hoursWindow: r.hoursWindow ?? 24,
          retentionPercent: r.retentionPercent ?? 50,
        });
        if (snap.data().texts?.businessHours) {
          // Carregar slots baseado no dia da semana selecionado
        }
      }
    });

    // Carregar agendamentos existentes para bloquear horários
    const unsubApts = onSnapshot(collection(db, 'appointments'), (snap) => {
      const apts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // gerar slots do dia selecionado
      if (newDate) generateSlots(newDate, apts);
    });

    return () => { unsub(); unsubApts(); };
  }, [newDate]);

  const generateSlots = (dateStr, existingAppointments = []) => {
    if (!dateStr) return setAvailableSlots([]);
    const date = new Date(dateStr + 'T12:00:00');
    const dow = date.getDay();
    const weekdayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    onSnapshot(doc(db, 'config', 'main'), (snap) => {
      const hours = snap.data()?.texts?.businessHours;
      if (!hours) return setAvailableSlots([]);

      const dayKey = weekdayMap[dow];
      const dayHours = hours[dayKey];
      if (!dayHours?.active) return setAvailableSlots([]);

      // Gerar slots de hora em hora
      const slots = [];
      const [oh, om] = dayHours.open.split(':').map(Number);
      const [ch, cm] = dayHours.close.split(':').map(Number);
      let openMin = oh * 60 + om;
      let closeMin = ch * 60 + cm;
      const duration = appointment.totalDuration || 60;

      const dayBlocked = hours.blockedDates?.[dateStr] || [];
      const blockedHours = hours.blockedHours?.[dayKey] || [];
      const blockedRanges = hours.blockedRanges?.[dayKey] || [];

      const occupied = existingAppointments
        .filter(a => a.date === dateStr && a.status !== 'Cancelado' && a.id !== appointment.id)
        .map(a => a.time);

      const timeToMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      for (let m = openMin; m + duration <= closeMin; m += 60) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const timeSlot = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        if (dayBlocked.includes(dateStr)) continue;
        if (blockedHours.includes(timeSlot)) continue;

        // Bloqueio por intervalo (novo formato)
        const slotStart = timeToMinutes(timeSlot);
        const slotEnd = slotStart + duration;
        const isInBlockedRange = blockedRanges.some(r => {
          const bStart = timeToMinutes(r.start);
          const bEnd = timeToMinutes(r.end);
          return slotStart < bEnd && bStart < slotEnd;
        });
        if (isInBlockedRange) continue;

        if (occupied.includes(timeSlot)) continue;
        slots.push(timeSlot);
      }
      setAvailableSlots(slots);
    });
  };

  // Calcular se está fora da janela e quanto será retido
  const getHoursUntil = () => {
    const original = new Date(`${appointment.date}T${appointment.time}:00`);
    const now = new Date();
    return (original - now) / (1000 * 60 * 60);
  };

  const outsideWindow = getHoursUntil() < config.hoursWindow;
  const willRetain = outsideWindow ? (appointment.pixAmount || 0) * (config.retentionPercent / 100) : 0;
  const willRefund = (appointment.pixAmount || 0) - willRetain;

  const handleSubmit = async () => {
    if (!newDate || !newTime) {
      alert('Escolha nova data e horário');
      return;
    }
    if (!reason.trim()) {
      alert('Conte o motivo do reagendamento');
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, 'reschedule_requests'), {
        appointmentId: appointment.id,
        appointmentOS: appointment.os,
        userId: auth.currentUser?.uid,
        userName: appointment.name,
        userCelular: appointment.userCelular,
        pixAmount: appointment.pixAmount || 0,
        originalDate: appointment.date,
        originalTime: appointment.time,
        newDate,
        newTime,
        reason,
        status: 'pending',
        outsideWindow,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar solicitação: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-gray-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="text-primary" size={22} />
            Reagendar
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle size={48} className="text-primary mx-auto mb-3" />
            <p className="text-white font-bold text-lg">Solicitação enviada!</p>
            <p className="text-gray-400 text-sm mt-2">
              O admin irá analisar e aprovar sua solicitação em breve.
            </p>
          </div>
        ) : (
          <>
            {/* Dados atuais */}
            <div className="bg-gray-900 rounded-2xl p-4 mb-4">
              <p className="text-xs text-gray-500 mb-1">Agendamento atual</p>
              <p className="text-white font-bold">{appointment.date} às {appointment.time}</p>
              <p className="text-gray-400 text-sm">OS: {appointment.os}</p>
            </div>

            {/* Aviso sobre regra */}
            {outsideWindow && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <p className="text-red-300 font-bold mb-1">Fora da janela de {config.hoursWindow}h</p>
                    <p className="text-red-200/80">
                      Será retido <span className="font-bold">R$ {willRetain.toFixed(2)}</span> ({config.retentionPercent}%) do valor pago.
                    </p>
                    {willRefund > 0 && (
                      <p className="text-red-200/80 mt-1">
                        Reembolso: <span className="font-bold text-green-400">R$ {willRefund.toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!outsideWindow && appointment.pixStatus === 'paid' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <p className="text-green-300 font-bold">Dentro da janela de {config.hoursWindow}h</p>
                    <p className="text-green-200/80">
                      Sem custo! Seu reagendamento será aprovado rapidamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Formulário */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  <Calendar size={14} className="inline mr-1" />
                  Nova data
                </label>
                <input
                  type="date"
                  value={newDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-primary"
                />
              </div>

              {newDate && (
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">
                    <Clock size={14} className="inline mr-1" />
                    Horários disponíveis
                  </label>
                  {availableSlots.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum horário livre nesta data</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setNewTime(slot)}
                          className={`py-2 px-3 rounded-lg text-sm font-bold ${
                            newTime === slot
                              ? 'bg-primary text-black'
                              : 'bg-gray-800 text-white hover:bg-gray-700'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  Motivo do reagendamento
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique o motivo..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending || !newDate || !newTime || !reason.trim()}
                className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-[#00c853] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Solicitar reagendamento
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
