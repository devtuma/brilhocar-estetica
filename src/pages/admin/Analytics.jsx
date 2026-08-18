import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { db } from '../../firebase';
import { TrendingUp, Calendar, DollarSign, Users, Loader2, Activity, Car as CarIcon } from 'lucide-react';

const COLORS = ['#00e676', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

const METRIC_CARDS = [
  { key: 'total', label: 'Total Agendamentos', icon: Calendar, color: 'text-primary' },
  { key: 'today', label: 'Hoje', icon: Activity, color: 'text-blue-500' },
  { key: 'revenue', label: 'Receita Total', icon: DollarSign, color: 'text-green-500', isCurrency: true },
  { key: 'avgTicket', label: 'Ticket Médio', icon: TrendingUp, color: 'text-yellow-500', isCurrency: true },
];

export default function Analytics() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30); // dias

  useEffect(() => {
    const q = collection(db, 'appointments');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ============== MÉTRICAS ==============
  const total = appointments.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const today = appointments.filter(a => a.date === todayStr).length;
  const revenue = appointments.reduce((s, a) => s + (a.totalPrice || 0), 0);
  const avgTicket = total > 0 ? revenue / total : 0;

  // ============== AGENDAMENTOS POR DIA (últimos N dias) ==============
  const days = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      count: 0,
      revenue: 0,
    });
  }
  appointments.forEach(a => {
    const idx = days.findIndex(d => d.date === a.date);
    if (idx >= 0) {
      days[idx].count++;
      days[idx].revenue += a.totalPrice || 0;
    }
  });

  // ============== SERVIÇOS MAIS POPULARES ==============
  const serviceCount = {};
  appointments.forEach(a => {
    const svcs = a.services || (a.service ? [{ name: a.service }] : []);
    svcs.forEach(s => {
      const name = s.name || 'Sem nome';
      serviceCount[name] = (serviceCount[name] || 0) + 1;
    });
  });
  const servicesData = Object.entries(serviceCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ============== STATUS DISTRIBUIÇÃO ==============
  const statusCount = {};
  appointments.forEach(a => {
    const st = a.status || 'Sem status';
    statusCount[st] = (statusCount[st] || 0) + 1;
  });
  const statusData = Object.entries(statusCount)
    .map(([name, value]) => ({ name, value }));

  // ============== HORÁRIOS DE PICO ==============
  const hourCount = {};
  appointments.forEach(a => {
    if (a.time) {
      hourCount[a.time] = (hourCount[a.time] || 0) + 1;
    }
  });
  const hoursData = Object.entries(hourCount)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time));

  // ============== DIAS DA SEMANA ==============
  const weekdayCount = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sáb: 0 };
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  appointments.forEach(a => {
    if (a.date) {
      const d = new Date(a.date + 'T12:00:00');
      weekdayCount[weekdayNames[d.getDay()]]++;
    }
  });
  const weekdayData = weekdayNames.map(n => ({ day: n, count: weekdayCount[n] }));

  const tooltipStyle = {
    contentStyle: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' },
    labelStyle: { color: '#fff', fontWeight: 'bold' },
    itemStyle: { color: '#00e676' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <TrendingUp className="text-primary" size={28} />
            Analytics
          </h1>
          <p className="text-gray-400 mt-1">Métricas e gráficos do seu negócio</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Período:</span>
          {[7, 15, 30, 90].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                period === p
                  ? 'bg-primary text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRIC_CARDS.map(m => {
          const value = m.key === 'total' ? total
            : m.key === 'today' ? today
            : m.key === 'revenue' ? revenue
            : avgTicket;
          return (
            <div key={m.key} className="bg-surface border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-xs font-semibold uppercase">{m.label}</span>
                <m.icon size={20} className={m.color} />
              </div>
              <p className="text-2xl md:text-3xl font-black text-white">
                {m.isCurrency ? `R$ ${value.toFixed(0)}` : value}
              </p>
            </div>
          );
        })}
      </div>

      {total === 0 ? (
        <div className="bg-surface border border-gray-800 rounded-2xl p-12 text-center">
          <Activity size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">Nenhum agendamento registrado ainda</p>
          <p className="text-gray-500 text-sm mt-1">Os gráficos aparecerão aqui quando houver dados</p>
        </div>
      ) : (
        <>
          {/* Agendamentos por dia */}
          <div className="bg-surface border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-bold mb-4">📅 Agendamentos por dia</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e676" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#00e676" strokeWidth={2.5} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Receita + Serviços */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">💰 Receita por dia (R$)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={days}>
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">🏆 Serviços mais populares</h3>
              {servicesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={servicesData} layout="vertical">
                    <XAxis type="number" stroke="#6b7280" fontSize={11} />
                    <YAxis dataKey="name" type="category" width={110} stroke="#6b7280" fontSize={11} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="#00e676" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-sm">Sem dados de serviços</p>}
            </div>
          </div>

          {/* Status + Dias da semana */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">📊 Status dos agendamentos</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">📆 Dia da semana com mais agendamentos</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weekdayData}>
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Horários de pico */}
          {hoursData.length > 0 && (
            <div className="bg-surface border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">⏰ Horários de pico</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hoursData}>
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
