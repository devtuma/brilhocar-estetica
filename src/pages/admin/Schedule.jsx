import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Save, Clock, Calendar, AlertCircle, CheckCircle, Ban, Plus, X } from 'lucide-react';

const DIAS_SEMANA = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

// Opções de horários para bloquear (ex: almoço)
const HORARIOS_COMUNS = [
  { time: '12:00', label: '12:00 (Almoço)' },
  { time: '12:30', label: '12:30 (Almoço)' },
  { time: '13:00', label: '13:00 (Almoço)' },
  { time: '13:30', label: '13:30 (Almoço)' },
  { time: '14:00', label: '14:00 (Pós-Almoço)' },
];

export default function Schedule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Config de horários por dia da semana
  const [businessHours, setBusinessHours] = useState({
    monday: { open: '08:00', close: '18:00', active: true },
    tuesday: { open: '08:00', close: '18:00', active: true },
    wednesday: { open: '08:00', close: '18:00', active: true },
    thursday: { open: '08:00', close: '18:00', active: true },
    friday: { open: '08:00', close: '18:00', active: true },
    saturday: { open: '08:00', close: '14:00', active: true },
    sunday: { open: '08:00', close: '18:00', active: false },
  });

  // Horários bloqueados por dia (ex: horário de almoço)
  const [blockedHours, setBlockedHours] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });

  // Datas bloqueadas (feriados, folgas)
  const [blockedDates, setBlockedDates] = useState([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [editingDay, setEditingDay] = useState(null); // qual dia está editando horários bloqueados

  // Carregar config atual
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessHours) {
          // Normalizar chaves (caso Firestore tenha dados antigos com chaves tipo "active ")
          const normalized = {};
          Object.keys(data.businessHours).forEach(dayKey => {
            const dc = data.businessHours[dayKey];
            const activeValue = dc.active ?? dc['active '];
            normalized[dayKey] = {
              open: dc.open || dc['open '] || '08:00',
              close: dc.close || dc['close '] || '18:00',
              active: activeValue === true || activeValue === 'true',
            };
          });
          setBusinessHours(normalized);
        }
        if (data.blockedDates) setBlockedDates(data.blockedDates);
        if (data.blockedHours) setBlockedHours(data.blockedHours);
      }
      setLoading(false);
    }, (err) => {
      console.error('Erro ao carregar config:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleHourChange = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const toggleDay = (day) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const addBlockedDate = () => {
    if (!newBlockedDate) return;
    if (blockedDates.includes(newBlockedDate)) {
      setMessage({ type: 'error', text: 'Data já bloqueada' });
      return;
    }
    setBlockedDates(prev => [...prev, newBlockedDate].sort());
    setNewBlockedDate('');
  };

  const removeBlockedDate = (date) => {
    setBlockedDates(prev => prev.filter(d => d !== date));
  };

  // Gerenciar horários bloqueados por dia
  const toggleBlockedHour = (dayKey, hour) => {
    setBlockedHours(prev => {
      const current = prev[dayKey] || [];
      if (current.includes(hour)) {
        return { ...prev, [dayKey]: current.filter(h => h !== hour) };
      } else {
        return { ...prev, [dayKey]: [...current, hour].sort() };
      }
    });
  };

  const getBlockedHoursCount = (dayKey) => {
    return (blockedHours[dayKey] || []).length;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // VALIDAÇÃO: verificar se open < close para cada dia ativo
    const errors = [];
    Object.keys(businessHours).forEach(dayKey => {
      const day = businessHours[dayKey];
      if (day.active && day.open && day.close) {
        if (day.open >= day.close) {
          const dayLabel = DIAS_SEMANA.find(d => d.key === dayKey)?.label || dayKey;
          errors.push(`${dayLabel}: horário de fechamento deve ser após a abertura`);
        }
      }
    });

    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join('. ') });
      setSaving(false);
      return;
    }

    try {
      const configRef = doc(db, 'config', 'main');
      await updateDoc(configRef, {
        businessHours,
        blockedDates,
        blockedHours, // Salvar horários bloqueados
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: 'Horários salvos com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] rounded-xl p-6 shadow-lg border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="text-primary" size={20} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-800">Horários de Funcionamento</h3>
          <p className="text-sm text-gray-500">Configure os dias e horários disponíveis para agendamento</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Dias da semana */}
        <div>
          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Clock size={18} /> Dias de Funcionamento
          </h4>
          <div className="space-y-2">
            {DIAS_SEMANA.map(dia => (
              <div key={dia.key} className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border ${
                businessHours[dia.key].active
                  ? 'bg-white border-gray-300'
                  : 'bg-gray-100 border-gray-200 opacity-60'
              }`}>
                <input
                  type="checkbox"
                  checked={businessHours[dia.key].active}
                  onChange={() => toggleDay(dia.key)}
                  className="w-5 h-5 rounded accent-primary cursor-pointer"
                />
                <span className={`font-semibold w-32 ${businessHours[dia.key].active ? 'text-gray-800' : 'text-gray-500'}`}>
                  {dia.label}
                </span>

                {businessHours[dia.key].active && (
                  <>
                    <input
                      type="time"
                      value={businessHours[dia.key].open}
                      onChange={e => handleHourChange(dia.key, 'open', e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-3 py-1 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-gray-500">às</span>
                    <input
                      type="time"
                      value={businessHours[dia.key].close}
                      onChange={e => handleHourChange(dia.key, 'close', e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-3 py-1 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    {/* Botão para bloquear horários específicos */}
                    <button
                      type="button"
                      onClick={() => setEditingDay(editingDay === dia.key ? null : dia.key)}
                      className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        getBlockedHoursCount(dia.key) > 0
                          ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
                          : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'
                      }`}
                    >
                      <Ban size={14} />
                      {getBlockedHoursCount(dia.key) > 0
                        ? `Bloqueados: ${getBlockedHoursCount(dia.key)}`
                        : 'Bloquear Horários'
                      }
                    </button>
                  </>
                )}

                {!businessHours[dia.key].active && (
                  <span className="text-gray-500 text-sm italic ml-auto">Fechado</span>
                )}

                {/* Painel de horários bloqueados */}
                {editingDay === dia.key && businessHours[dia.key].active && (
                  <div className="w-full mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={16} className="text-gray-600" />
                      <span className="font-bold text-gray-700 text-sm">
                        Horários bloqueados em {dia.label}:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {HORARIOS_COMUNS.map(h => {
                        const isBlocked = (blockedHours[dia.key] || []).includes(h.time);
                        return (
                          <button
                            key={h.time}
                            type="button"
                            onClick={() => toggleBlockedHour(dia.key, h.time)}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              isBlocked
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {isBlocked && <X size={12} className="inline mr-1" />}
                            {h.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Horários já bloqueados */}
                    {(blockedHours[dia.key] || []).length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        Bloqueados: {blockedHours[dia.key].join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Datas bloqueadas (feriados, folgas) */}
        <div className="pt-6 border-t border-gray-200">
          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar size={18} /> Datas Bloqueadas (Feriados / Fechado)
          </h4>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="date"
              value={newBlockedDate}
              onChange={e => setNewBlockedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addBlockedDate}
              className="bg-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-[#00c853] transition-colors"
            >
              Bloquear
            </button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nenhuma data bloqueada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map(date => {
                const d = new Date(date + 'T00:00:00');
                const formatted = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                return (
                  <span key={date} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                    {formatted}
                    <button
                      type="button"
                      onClick={() => removeBlockedDate(date)}
                      className="hover:text-red-900 font-bold"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-bold text-blue-800 text-sm mb-2">ℹ️ Como funciona:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Marque os dias da semana em que a loja atende</li>
            <li>• Defina horário de abertura e fechamento para cada dia</li>
            <li>• Clique em "Bloquear Horários" para fechar horários específicos (ex: horário de almoço)</li>
            <li>• Bloqueie datas específicas (feriados, férias, manutenção)</li>
            <li>• O sistema gera slots a cada 60min entre open e close</li>
            <li>• Slots já agendados ficam bloqueados automaticamente</li>
            <li>• Slots com pagamento pendente são liberados após 10min</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              Salvando...
            </>
          ) : (
            <>
              <Save size={20} />
              Salvar Horários
            </>
          )}
        </button>
      </form>
    </div>
  );
}
