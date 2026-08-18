import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Calendar, Check, X, Loader2, Clock, AlertTriangle, DollarSign, RefreshCcw } from 'lucide-react';

export default function Reagendamentos() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [config, setConfig] = useState({ retentionPercent: 50, hoursWindow: 24 });

  useEffect(() => {
    const q = query(collection(db, 'reschedule_requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRequests(data);
      setLoading(false);
    }, () => setLoading(false));

    // Carregar config de retenção
    const unsubCfg = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists()) {
        const r = snap.data().rescheduleConfig;
        if (r) setConfig({
          retentionPercent: r.retentionPercent ?? 50,
          hoursWindow: r.hoursWindow ?? 24,
        });
      }
    });

    return () => { unsub(); unsubCfg(); };
  }, []);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('pt-BR');
  };

  // Calcular se está dentro ou fora da janela de Xh
  const isOutsideWindow = (req) => {
    const original = new Date(`${req.originalDate}T${req.originalTime}:00`);
    const now = new Date();
    const diffHours = (original - now) / (1000 * 60 * 60);
    return diffHours < config.hoursWindow;
  };

  const calculateRetention = (req) => {
    // Dentro da janela = 0%
    // Fora da janela = config.retentionPercent (0-50%)
    if (!isOutsideWindow(req)) return 0;
    const paid = req.pixAmount || 0;
    return Math.min((paid * config.retentionPercent) / 100, paid * 0.5);
  };

  const handleApprove = async (req) => {
    const retention = calculateRetention(req);
    const refund = (req.pixAmount || 0) - retention;

    if (!confirm(
      `Aprovar reagendamento?\n\n` +
      `Cliente: ${req.userName}\n` +
      `OS: ${req.appointmentOS}\n` +
      `De: ${req.originalDate} ${req.originalTime}\n` +
      `Para: ${req.newDate} ${req.newTime}\n\n` +
      `Janela configurada: ${config.hoursWindow}h\n` +
      (isOutsideWindow(req)
        ? `⚠️ Fora da janela! Será retido R$ ${retention.toFixed(2)} (${config.retentionPercent}%)\n` +
          `💰 Reembolso: R$ ${refund.toFixed(2)}`
        : `✅ Dentro da janela, sem retenção`)
    )) return;

    setProcessingId(req.id);
    try {
      // 1. Atualizar appointment original
      const aptRef = doc(db, 'appointments', req.appointmentId);
      await updateDoc(aptRef, {
        date: req.newDate,
        time: req.newTime,
        rescheduled: true,
        previousDate: req.originalDate,
        previousTime: req.originalTime,
        retentionAmount: retention,
        refundAmount: refund,
        timeline: [
          ...(await getDoc(aptRef)).data().timeline || [],
          {
            status: 'Reagendado',
            date: new Date().toISOString(),
            note: `De ${req.originalDate} ${req.originalTime} → ${req.newDate} ${req.newTime}${retention > 0 ? ` (retido R$ ${retention.toFixed(2)})` : ''}`,
          }
        ],
        updatedAt: serverTimestamp(),
      });

      // 2. Atualizar status da solicitação
      await updateDoc(doc(db, 'reschedule_requests', req.id), {
        status: 'approved',
        retentionAmount: retention,
        refundAmount: refund,
        approvedAt: serverTimestamp(),
      });

      // 3. Log no audit
      await addDoc(collection(db, 'audit_logs'), {
        type: 'reschedule_approved',
        appointmentId: req.appointmentId,
        requestId: req.id,
        details: {
          from: `${req.originalDate} ${req.originalTime}`,
          to: `${req.newDate} ${req.newTime}`,
          retention,
          refund,
          outsideWindow: isOutsideWindow(req),
        },
        deletedBy: 'admin',
        deletedAt: serverTimestamp(),
      });

      alert('Reagendamento aprovado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return;

    setProcessingId(req.id);
    try {
      await updateDoc(doc(db, 'reschedule_requests', req.id), {
        status: 'rejected',
        rejectionReason: reason || 'Não informado',
        rejectedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'audit_logs'), {
        type: 'reschedule_rejected',
        appointmentId: req.appointmentId,
        requestId: req.id,
        reason,
        deletedBy: 'admin',
        deletedAt: serverTimestamp(),
      });

      alert('Solicitação rejeitada');
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <RefreshCcw className="text-primary" size={28} />
            Reagendamentos
          </h1>
          <p className="text-gray-400 mt-1">Solicitações de troca de data/horário</p>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
        >
          <option value="pending">⏳ Pendentes</option>
          <option value="approved">✅ Aprovados</option>
          <option value="rejected">❌ Rejeitados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Banner de regras */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
        <p className="text-blue-300 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          Regra atual: reagendamentos com mais de <span className="font-black">{config.hoursWindow}h</span> de antecedência são livres.
          Fora da janela: <span className="font-black">{config.retentionPercent}%</span> retido (configurável em Configurações).
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-gray-800 rounded-2xl p-12 text-center">
          <Calendar size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">Nenhuma solicitação {filter !== 'all' && `(${filter})`}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => {
            const retention = calculateRetention(req);
            const outside = isOutsideWindow(req);
            const statusColors = {
              pending: 'border-yellow-500/30 bg-yellow-500/5',
              approved: 'border-green-500/30 bg-green-500/5',
              rejected: 'border-red-500/30 bg-red-500/5',
            };
            return (
              <div
                key={req.id}
                className={`bg-surface border rounded-2xl p-5 ${statusColors[req.status] || 'border-gray-800'}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-white">{req.userName}</p>
                      <span className="text-xs text-gray-500 font-mono">{req.appointmentOS}</span>
                      {req.status === 'pending' && outside && (
                        <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                          ⚠️ Fora da janela
                        </span>
                      )}
                      {req.status === 'pending' && !outside && (
                        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                          ✅ Dentro da janela
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">📅 Data original</p>
                        <p className="text-white line-through">{req.originalDate} {req.originalTime}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">📅 Nova data</p>
                        <p className="text-white font-bold">{req.newDate} {req.newTime}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">💰 Pago</p>
                        <p className="text-white">R$ {(req.pixAmount || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">📆 Solicitado em</p>
                        <p className="text-white">{formatDate(req.createdAt)}</p>
                      </div>
                    </div>

                    {req.reason && (
                      <p className="mt-3 text-sm text-gray-300 bg-gray-900 rounded-lg p-3">
                        <span className="text-gray-500">Motivo: </span>{req.reason}
                      </p>
                    )}

                    {req.status !== 'pending' && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {req.retentionAmount > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs">🔒 Retido</p>
                            <p className="text-red-400 font-bold">R$ {req.retentionAmount.toFixed(2)}</p>
                          </div>
                        )}
                        {req.refundAmount > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs">💸 Reembolso</p>
                            <p className="text-green-400 font-bold">R$ {req.refundAmount.toFixed(2)}</p>
                          </div>
                        )}
                        {req.rejectionReason && (
                          <div className="col-span-2">
                            <p className="text-gray-500 text-xs">Motivo rejeição</p>
                            <p className="text-red-300">{req.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex md:flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={processingId === req.id}
                        className="bg-green-500 text-black font-bold px-4 py-2 rounded-xl hover:bg-green-400 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <Check size={16} />
                        {processingId === req.id ? '...' : 'Aprovar'}
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        disabled={processingId === req.id}
                        className="bg-red-500/20 text-red-400 font-bold px-4 py-2 rounded-xl hover:bg-red-500/30 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <X size={16} />
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
