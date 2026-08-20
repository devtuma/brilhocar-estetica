import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { CalendarCheck, Clock, CheckCircle, AlertCircle, Car, User, Filter, Search, RefreshCw, ChevronRight, Play, Check, Package, ClipboardList } from 'lucide-react';

export default function Schedule() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [serviceTypes, setServiceTypes] = useState([]);

  // Carregar agendamentos em tempo real
  useEffect(() => {
    const q = query(
      collection(db, 'appointments'),
      orderBy('date', 'desc'),
      orderBy('time', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAppointments(data);

      // Extrair tipos de serviços únicos
      const types = [...new Set(data.flatMap(a =>
        (a.services || []).map(s => typeof s === 'string' ? s : s.name)
      ))];
      setServiceTypes(types.sort());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtrar agendamentos
  const filteredAppointments = appointments.filter(app => {
    // Filtro por tipo de serviço
    if (activeTab !== 'all') {
      const hasType = (app.services || []).some(s =>
        (typeof s === 'string' ? s : s.name) === activeTab
      );
      if (!hasType) return false;
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      if (app.status !== statusFilter) return false;
    }

    // Busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (app.os?.toLowerCase() || '').includes(term) ||
        (app.name?.toLowerCase() || '').includes(term) ||
        (app.userName?.toLowerCase() || '').includes(term) ||
        (app.plate?.toLowerCase() || '').includes(term) ||
        (app.car?.toLowerCase() || '').includes(term) ||
        (app.celular?.toLowerCase() || '').includes(term) ||
        (app.userCelular?.toLowerCase() || '').includes(term)
      );
    }

    return true;
  });

  // Contagens por status
  const counts = {
    all: appointments.length,
    'Aguardando Pagamento': appointments.filter(a => a.status === 'Aguardando Pagamento').length,
    'Agendado': appointments.filter(a => a.status === 'Agendado').length,
    'Veículo Recebido': appointments.filter(a => a.status === 'Veículo Recebido').length,
    'Serviço Iniciado': appointments.filter(a => a.status === 'Serviço Iniciado').length,
    'Finalizado': appointments.filter(a => a.status === 'Finalizado').length,
    'Cancelado': appointments.filter(a => a.status === 'Cancelado').length,
  };

  // Atualizar status
  const updateStatus = async (appointmentId, newStatus) => {
    setUpdating(true);
    try {
      const ref = doc(db, 'appointments', appointmentId);
      const timeline = {
        status: newStatus,
        date: new Date().toISOString(),
        note: `Status atualizado via painel`
      };

      await updateDoc(ref, {
        status: newStatus,
        updatedAt: new Date(),
        timeline: []
      });

      // Adicionar ao timeline existente
      const app = appointments.find(a => a.id === appointmentId);
      if (app?.timeline) {
        await updateDoc(ref, {
          timeline: [...(app.timeline || []), timeline]
        });
      }

      setSelectedAppointment(null);
    } catch (err) {
      console.error('Erro ao atualizar:', err);
      alert('Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  // Status workflow
  const statusFlow = ['Agendado', 'Veículo Recebido', 'Serviço Iniciado', 'Finalizado', 'Entregue'];

  // Próximo status
  const getNextStatus = (current) => {
    const idx = statusFlow.indexOf(current);
    if (idx === -1 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
  };

  // Cor do status
  const getStatusColor = (status) => {
    const colors = {
      'Aguardando Pagamento': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Agendado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Veículo Recebido': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Serviço Iniciado': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Finalizado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Entregue': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'Cancelado': 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  // Ícone do status
  const getStatusIcon = (status) => {
    const icons = {
      'Aguardando Pagamento': <Clock size={14} />,
      'Agendado': <CalendarCheck size={14} />,
      'Veículo Recebido': <Car size={14} />,
      'Serviço Iniciado': <Play size={14} />,
      'Finalizado': <CheckCircle size={14} />,
      'Entregue': <Package size={14} />,
      'Cancelado': <AlertCircle size={14} />,
    };
    return icons[status] || <ClipboardList size={14} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-4 md:pt-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Agenda de Trabalhos</h2>
          <p className="text-gray-400 mt-1">{appointments.length} agendamentos no total</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por OS, nome, placa, celular..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Tabs de Status */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'Aguardando Pagamento', label: '⏳ Aguardando', count: counts['Aguardando Pagamento'] },
          { key: 'Agendado', label: '📅 Agendado', count: counts['Agendado'] },
          { key: 'Veículo Recebido', label: '🚗 Recebido', count: counts['Veículo Recebido'] },
          { key: 'Serviço Iniciado', label: '🔧 Em Serviço', count: counts['Serviço Iniciado'] },
          { key: 'Finalizado', label: '✅ Finalizado', count: counts['Finalizado'] },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
              statusFilter === tab.key
                ? 'bg-primary text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              statusFilter === tab.key ? 'bg-black/20' : 'bg-gray-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabs de Tipos de Serviço */}
      {serviceTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'
            }`}
          >
            Todos os Serviços
          </button>
          {serviceTypes.map(type => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === type
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Lista de Agendamentos */}
      <div className="space-y-3">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <CalendarCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">Nenhum agendamento encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          filteredAppointments.map(app => (
            <div
              key={app.id}
              onClick={() => setSelectedAppointment(app)}
              className={`bg-surface border rounded-2xl p-5 cursor-pointer hover:border-primary/50 transition-all ${
                selectedAppointment?.id === app.id ? 'border-primary' : 'border-gray-800'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info Principal */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-primary text-lg">{app.os}</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${getStatusColor(app.status)}`}>
                      {getStatusIcon(app.status)}
                      {app.status}
                    </span>
                    {app.pixStatus === 'paid' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        ✅ PIX
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <User size={14} />
                      <span>{app.userName || app.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Car size={14} />
                      <span>{app.car}</span>
                      <span className="font-mono text-xs">({app.plate})</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {(app.services || []).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">
                        {typeof s === 'string' ? s : s.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Data e Hora */}
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
                    <CalendarCheck size={16} />
                    <span>{app.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
                    <Clock size={14} />
                    <span>{app.time}</span>
                  </div>
                </div>

                <ChevronRight className="text-gray-500" size={20} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAppointment(null)}>
          <div className="bg-surface border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-surface border-b border-gray-800 p-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedAppointment.os}</h3>
                <p className="text-sm text-gray-400">Detalhes do Agendamento</p>
              </div>
              <button onClick={() => setSelectedAppointment(null)} className="p-2 hover:bg-gray-800 rounded-lg">
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-5">
              {/* Status atual */}
              <div className={`p-4 rounded-xl border ${getStatusColor(selectedAppointment.status)}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedAppointment.status)}
                  <span className="font-bold">{selectedAppointment.status}</span>
                </div>
              </div>

              {/* Cliente */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">CLIENTE</h4>
                <div className="bg-gray-900/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nome:</span>
                    <span className="font-semibold">{selectedAppointment.userName || selectedAppointment.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Celular:</span>
                    <span className="font-semibold">{selectedAppointment.userCelular || selectedAppointment.celular}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Veículo:</span>
                    <span className="font-semibold">{selectedAppointment.car}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Placa:</span>
                    <span className="font-mono font-bold">{selectedAppointment.plate}</span>
                  </div>
                </div>
              </div>

              {/* Serviços */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">SERVIÇOS</h4>
                <div className="bg-gray-900/50 rounded-xl p-4">
                  {(selectedAppointment.services || []).map((s, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                      <span>{typeof s === 'string' ? s : s.name}</span>
                      <span className="font-bold text-primary">
                        {s.price ? `R$ ${Number(s.price).toFixed(2)}` : ''}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 mt-2 border-t border-gray-700">
                    <span className="font-bold">TOTAL:</span>
                    <span className="font-black text-xl text-primary">
                      R$ {Number(selectedAppointment.totalPrice || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Horários */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">AGENDAMENTO</h4>
                <div className="bg-gray-900/50 rounded-xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Data</p>
                    <p className="font-bold">{selectedAppointment.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Horário</p>
                    <p className="font-bold">{selectedAppointment.time}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Duração</p>
                    <p className="font-bold">{selectedAppointment.totalDuration || 60} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valor PIX</p>
                    <p className="font-bold text-green-400">
                      {selectedAppointment.pixAmount ? `R$ ${Number(selectedAppointment.pixAmount).toFixed(2)}` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {selectedAppointment.timeline && selectedAppointment.timeline.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">HISTÓRICO</h4>
                  <div className="space-y-2">
                    {(selectedAppointment.timeline || []).map((entry, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                        <div>
                          <span className="font-semibold">{entry.status}</span>
                          <span className="text-gray-500 mx-2">·</span>
                          <span className="text-gray-400 text-xs">
                            {new Date(entry.date).toLocaleString('pt-BR')}
                          </span>
                          {entry.note && (
                            <p className="text-gray-500 text-xs mt-1">{entry.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="pt-4 border-t border-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">AVANÇAR STATUS</h4>
                <div className="flex flex-wrap gap-2">
                  {getNextStatus(selectedAppointment.status) ? (
                    <button
                      onClick={() => updateStatus(selectedAppointment.id, getNextStatus(selectedAppointment.status))}
                      disabled={updating}
                      className="flex-1 min-w-[200px] px-6 py-4 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {updating ? (
                        <RefreshCw className="animate-spin" size={18} />
                      ) : (
                        <>
                          {getStatusIcon(getNextStatus(selectedAppointment.status))}
                          Avançar para {getNextStatus(selectedAppointment.status)}
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-gray-500 text-sm">
                      Status final atingido ou não há próximo passo definido
                    </span>
                  )}

                  {selectedAppointment.status === 'Agendado' && (
                    <button
                      onClick={() => updateStatus(selectedAppointment.id, 'Veículo Recebido')}
                      disabled={updating}
                      className="px-6 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Car size={18} />
                      Receber Veículo
                    </button>
                  )}

                  {selectedAppointment.status === 'Veículo Recebido' && (
                    <button
                      onClick={() => updateStatus(selectedAppointment.id, 'Serviço Iniciado')}
                      disabled={updating}
                      className="px-6 py-4 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Play size={18} />
                      Iniciar Serviço
                    </button>
                  )}

                  {(selectedAppointment.status === 'Serviço Iniciado' || selectedAppointment.status === 'Veículo Recebido') && (
                    <button
                      onClick={() => updateStatus(selectedAppointment.id, 'Finalizado')}
                      disabled={updating}
                      className="px-6 py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle size={18} />
                      Finalizar
                    </button>
                  )}

                  {selectedAppointment.status === 'Finalizado' && (
                    <button
                      onClick={() => updateStatus(selectedAppointment.id, 'Entregue')}
                      disabled={updating}
                      className="px-6 py-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Package size={18} />
                      Entregar ao Cliente
                    </button>
                  )}
                </div>
              </div>

              {/* Cancelar (se não for final) */}
              {!['Finalizado', 'Entregue', 'Cancelado'].includes(selectedAppointment.status) && (
                <button
                  onClick={() => {
                    if (confirm('Tem certeza que deseja cancelar este agendamento?')) {
                      updateStatus(selectedAppointment.id, 'Cancelado');
                    }
                  }}
                  className="w-full px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-400 font-semibold rounded-xl hover:bg-red-500/30 transition-colors"
                >
                  Cancelar Agendamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
