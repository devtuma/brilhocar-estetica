import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Save, Clock, Calendar, AlertCircle, CheckCircle, Plus, X,
  Trash2, Ban, Coffee
} from 'lucide-react';

const DIAS_SEMANA = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

// Converte "HH:MM" em minutos desde 00:00
const toMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Converte minutos em "HH:MM"
const toTimeString = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Verifica se dois intervalos [a1,a2] e [b1,b2] se sobrepõem
const intervalsOverlap = (a1, a2, b1, b2) => {
  return a1 < b2 && b1 < a2;
};

// Labels comuns pré-prontos
const QUICK_BLOCKS = [
  { start: '12:00', end: '13:00', label: 'Almoço 12-13h', icon: '🍽️' },
  { start: '12:00', end: '14:00', label: 'Almoço 12-14h', icon: '🍽️' },
  { start: '13:00', end: '14:00', label: 'Almoço 13-14h', icon: '🍽️' },
];

export default function Schedule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [businessHours, setBusinessHours] = useState({
    monday: { open: '08:00', close: '18:00', active: true },
    tuesday: { open: '08:00', close: '18:00', active: true },
    wednesday: { open: '08:00', close: '18:00', active: true },
    thursday: { open: '08:00', close: '18:00', active: true },
    friday: { open: '08:00', close: '18:00', active: true },
    saturday: { open: '08:00', close: '14:00', active: true },
    sunday: { open: '00:00', close: '00:00', active: false },
  });

  // Intervalos bloqueados por dia: { monday: [{start: '12:00', end: '13:30'}, ...], ... }
  const [blockedRanges, setBlockedRanges] = useState({
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  });

  const [blockedDates, setBlockedDates] = useState([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [editingDay, setEditingDay] = useState(null);

  // Form para adicionar novo intervalo
  const [newRange, setNewRange] = useState({ start: '12:00', end: '13:00' });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.businessHours) {
          const normalized = {};
          Object.keys(data.businessHours).forEach(dayKey => {
            const dc = data.businessHours[dayKey];
            normalized[dayKey] = {
              open: dc.open || '08:00',
              close: dc.close || '18:00',
              active: dc.active === true,
            };
          });
          setBusinessHours(normalized);
        }
        if (data.blockedDates) setBlockedDates(data.blockedDates);

        // Migração: aceita tanto blockedRanges (novo) quanto blockedHours (antigo)
        if (data.blockedRanges) {
          setBlockedRanges(data.blockedRanges);
        } else if (data.blockedHours) {
          // Migra formato antigo
          const migrated = {};
          Object.keys(data.blockedHours).forEach(dayKey => {
            const hours = data.blockedHours[dayKey] || [];
            migrated[dayKey] = hours.map(h => ({ start: h, end: h })).filter(r => r.start);
          });
          setBlockedRanges(migrated);
        }
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const handleHourChange = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev, [day]: { ...prev[day], [field]: value }
    }));
  };

  const toggleDay = (day) => {
    setBusinessHours(prev => ({
      ...prev, [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const addBlockedDate = () => {
    if (!newBlockedDate) return;
    if (blockedDates.includes(newBlockedDate)) {
      setMessage({ type: 'error', text: 'Esta data já está bloqueada' });
      return;
    }
    setBlockedDates(prev => [...prev, newBlockedDate].sort());
    setNewBlockedDate('');
    setMessage(null);
  };

  const removeBlockedDate = (date) => {
    setBlockedDates(prev => prev.filter(d => d !== date));
  };

  // Validar e adicionar intervalo bloqueado para um dia
  const addRange = (dayKey) => {
    const day = businessHours[dayKey];
    const startMin = toMinutes(newRange.start);
    const endMin = toMinutes(newRange.end);

    // Validação 1: horário válido
    if (startMin >= endMin) {
      setMessage({
        type: 'error',
        text: `${dayKey}: horário final deve ser depois do horário inicial`
      });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    // Validação 2: dentro do horário de funcionamento
    const openMin = toMinutes(day.open);
    const closeMin = toMinutes(day.close);
    if (startMin < openMin || endMin > closeMin) {
      setMessage({
        type: 'error',
        text: `O intervalo (${newRange.start}-${newRange.end}) precisa estar dentro do horário de funcionamento (${day.open}-${day.close})`
      });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    // Validação 3: não sobrepor com intervalo existente
    const existing = blockedRanges[dayKey] || [];
    const conflict = existing.find(r => {
      const a1 = toMinutes(r.start);
      const a2 = toMinutes(r.end);
      return intervalsOverlap(a1, a2, startMin, endMin);
    });

    if (conflict) {
      setMessage({
        type: 'error',
        text: `Conflito: já existe bloqueio ${conflict.start}-${conflict.end} que sobrepõe com ${newRange.start}-${newRange.end}`
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    // Tudo certo - adiciona
    setBlockedRanges(prev => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] || []), { ...newRange }].sort((a, b) =>
        toMinutes(a.start) - toMinutes(b.start)
      )
    }));
    setMessage({ type: 'success', text: `Bloqueio ${newRange.start}-${newRange.end} adicionado!` });
    setTimeout(() => setMessage(null), 2000);
  };

  const removeRange = (dayKey, index) => {
    setBlockedRanges(prev => ({
      ...prev,
      [dayKey]: prev[dayKey].filter((_, i) => i !== index)
    }));
  };

  const addQuickBlock = (dayKey, block) => {
    setNewRange({ start: block.start, end: block.end });
    setTimeout(() => addRange(dayKey), 100);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Validação completa dos intervalos
    const errors = [];

    Object.keys(businessHours).forEach(dayKey => {
      const day = businessHours[dayKey];
      if (day.active && day.open && day.close) {
        if (day.open >= day.close) {
          const dayLabel = DIAS_SEMANA.find(d => d.key === dayKey)?.label || dayKey;
          errors.push(`${dayLabel}: horário de fechamento deve ser após a abertura`);
        }
      }

      // Validar todos os intervalos do dia
      const ranges = blockedRanges[dayKey] || [];
      const openMin = toMinutes(day.open);
      const closeMin = toMinutes(day.close);

      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        const s = toMinutes(r.start);
        const e = toMinutes(r.end);
        if (s >= e) {
          errors.push(`${dayKey}: intervalo ${r.start}-${r.end} inválido`);
        }
        if (day.active && (s < openMin || e > closeMin)) {
          errors.push(`${dayKey}: intervalo ${r.start}-${r.end} fora do horário de funcionamento`);
        }
        // Checar sobreposição com outros
        for (let j = i + 1; j < ranges.length; j++) {
          const r2 = ranges[j];
          const s2 = toMinutes(r2.start);
          const e2 = toMinutes(r2.end);
          if (intervalsOverlap(s, e, s2, e2)) {
            errors.push(`${dayKey}: intervalos ${r.start}-${r.end} e ${r2.start}-${r2.end} se sobrepõem`);
          }
        }
      }
    });

    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors[0] });
      setSaving(false);
      return;
    }

    try {
      const configRef = doc(db, 'config', 'main');
      await updateDoc(configRef, {
        businessHours,
        blockedDates,
        blockedRanges,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: 'Horários salvos com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erro ao salvar: ' + err.message });
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <Calendar className="text-primary" size={28} />
          Horários
        </h1>
        <p className="text-gray-400 mt-1">Configure dias, horários e bloqueios de agenda</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} className="mt-0.5" /> : <AlertCircle size={20} className="mt-0.5" />}
          <span className="font-semibold text-sm">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* DIAS DA SEMANA */}
        <div className="bg-surface border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-bold flex items-center gap-2 mb-4">
            <Clock size={20} className="text-primary" />
            Dias de Funcionamento
          </h3>

          <div className="space-y-3">
            {DIAS_SEMANA.map(dia => {
              const dayRanges = blockedRanges[dia.key] || [];
              const isEditing = editingDay === dia.key;
              return (
                <div
                  key={dia.key}
                  className={`border rounded-xl p-4 ${
                    businessHours[dia.key].active
                      ? 'bg-gray-900/50 border-gray-700'
                      : 'bg-gray-900/20 border-gray-800 opacity-70'
                  }`}
                >
                  {/* Header do dia */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={businessHours[dia.key].active}
                      onChange={() => toggleDay(dia.key)}
                      className="w-5 h-5 rounded accent-primary cursor-pointer"
                    />
                    <span className={`font-bold w-36 ${businessHours[dia.key].active ? 'text-white' : 'text-gray-500'}`}>
                      {dia.label}
                    </span>

                    {businessHours[dia.key].active ? (
                      <>
                        <input
                          type="time"
                          value={businessHours[dia.key].open}
                          onChange={e => handleHourChange(dia.key, 'open', e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-primary"
                        />
                        <span className="text-gray-500 text-sm">às</span>
                        <input
                          type="time"
                          value={businessHours[dia.key].close}
                          onChange={e => handleHourChange(dia.key, 'close', e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-primary"
                        />

                        <button
                          type="button"
                          onClick={() => setEditingDay(isEditing ? null : dia.key)}
                          className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                            dayRanges.length > 0
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                              : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                          }`}
                        >
                          <Ban size={14} />
                          {dayRanges.length > 0
                            ? `${dayRanges.length} bloqueio${dayRanges.length > 1 ? 's' : ''}`
                            : 'Bloquear horários'
                          }
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500 text-sm italic ml-auto">Fechado</span>
                    )}
                  </div>

                  {/* Bloqueios existentes */}
                  {businessHours[dia.key].active && dayRanges.length > 0 && !isEditing && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dayRanges.map((r, i) => (
                        <span
                          key={i}
                          className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2"
                        >
                          🚫 {r.start}–{r.end}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Painel de edição de bloqueios */}
                  {businessHours[dia.key].active && isEditing && (
                    <div className="mt-4 bg-gray-900/60 rounded-xl p-4 border border-gray-700 space-y-4">
                      <div>
                        <p className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                          <Ban size={14} className="text-red-400" />
                          Adicionar bloqueio de intervalo
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Início</label>
                            <input
                              type="time"
                              value={newRange.start}
                              onChange={e => setNewRange(prev => ({ ...prev, start: e.target.value }))}
                              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                            />
                          </div>
                          <span className="text-gray-500 mb-2">até</span>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Fim</label>
                            <input
                              type="time"
                              value={newRange.end}
                              onChange={e => setNewRange(prev => ({ ...prev, end: e.target.value }))}
                              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => addRange(dia.key)}
                            className="bg-red-500 text-black font-bold px-4 py-2 rounded-lg hover:bg-red-400 transition flex items-center gap-2"
                          >
                            <Plus size={14} /> Bloquear
                          </button>
                        </div>
                      </div>

                      {/* Atalhos rápidos */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2 font-semibold">⚡ Atalhos rápidos:</p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_BLOCKS.map(qb => (
                            <button
                              key={qb.label}
                              type="button"
                              onClick={() => addQuickBlock(dia.key, qb)}
                              className="bg-gray-800 border border-gray-700 hover:border-red-500/50 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                            >
                              {qb.icon} {qb.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lista de bloqueios do dia */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2 font-semibold">
                          Bloqueios ativos em {dia.label}:
                        </p>
                        {dayRanges.length === 0 ? (
                          <p className="text-gray-500 text-sm italic">Nenhum bloqueio cadastrado</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {dayRanges.map((r, i) => (
                              <div
                                key={i}
                                className="bg-red-500/20 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2"
                              >
                                <Ban size={12} />
                                {r.start} – {r.end}
                                <button
                                  type="button"
                                  onClick={() => removeRange(dia.key, i)}
                                  className="ml-1 text-red-400 hover:text-red-200"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* DATAS BLOQUEADAS */}
        <div className="bg-surface border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-bold flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-primary" />
            Datas Bloqueadas (Feriados / Folgas)
          </h3>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              type="date"
              value={newBlockedDate}
              onChange={e => setNewBlockedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={addBlockedDate}
              className="bg-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-[#00c853] transition flex items-center gap-2"
            >
              <Plus size={14} /> Bloquear data
            </button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nenhuma data bloqueada</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map(date => {
                const d = new Date(date + 'T00:00:00');
                const formatted = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                return (
                  <span key={date} className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2">
                    📅 {formatted}
                    <button type="button" onClick={() => removeBlockedDate(date)} className="hover:text-red-100">
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full md:w-auto bg-primary text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00c853] transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div> Salvando...</>
          ) : (
            <><Save size={18} /> Salvar configurações</>
          )}
        </button>
      </form>
    </div>
  );
}
