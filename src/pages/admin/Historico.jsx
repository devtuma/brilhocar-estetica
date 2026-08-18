import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText, Trash2, Clock, User, Loader2 } from 'lucide-react';

export default function Historico() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('deletedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('pt-BR');
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <FileText className="text-primary" size={28} />
            Histórico
          </h1>
          <p className="text-gray-400 mt-1">Log de todas as ações administrativas</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="all">Todos os tipos</option>
            <option value="appointment_deleted">Agendamentos excluídos</option>
            <option value="appointment_cancelled">Agendamentos cancelados</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-gray-800 rounded-2xl p-12 text-center">
          <FileText size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">Nenhum registro no histórico</p>
          <p className="text-gray-500 text-sm mt-1">As ações aparecerão aqui quando forem executadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(log => {
            const data = log.appointmentData || {};
            return (
              <div key={log.id} className="bg-surface border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    log.type === 'appointment_deleted' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                  }`}>
                    <Trash2 size={20} className={log.type === 'appointment_deleted' ? 'text-red-500' : 'text-yellow-500'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <p className="font-bold text-white">
                          {log.type === 'appointment_deleted' && '🗑️ Agendamento excluído'}
                          {log.type === 'appointment_cancelled' && '⚠️ Agendamento cancelado'}
                          {!['appointment_deleted','appointment_cancelled'].includes(log.type) && log.type}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{data.os}</p>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(log.deletedAt || log.createdAt)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Cliente</p>
                        <p className="text-white font-semibold truncate">{data.userName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Celular</p>
                        <p className="text-white truncate">{data.userCelular || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Veículo</p>
                        <p className="text-white truncate">{data.car || '-'} <span className="text-gray-500">{data.plate}</span></p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Valor</p>
                        <p className="text-white font-bold">
                          R$ {data.totalPrice?.toFixed(2) || '0,00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Data original</p>
                        <p className="text-white">{data.date} {data.time}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Serviços</p>
                        <p className="text-white truncate">
                          {data.services?.map(s => s.name).join(', ') || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Status final</p>
                        <p className="text-white">{data.status || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Excluído por</p>
                        <p className="text-white truncate">{log.deletedByEmail || log.deletedBy || 'admin'}</p>
                      </div>
                    </div>

                    {log.reason && (
                      <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Motivo:</p>
                        <p className="text-gray-300 text-sm">{log.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
