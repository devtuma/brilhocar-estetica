import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { CalendarCheck, Clock, CheckCircle, Settings, Gift, Globe, TrendingUp, Users, DollarSign, CreditCard, Calendar, Shield, AlertCircle, Sparkles, Trash2, X, FileText, RefreshCcw, CheckSquare, Square, Loader2, QrCode } from 'lucide-react';
import CheckinScanner from '../components/CheckinScanner';

export default function Admin() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState(null);
  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [showCheckinScanner, setShowCheckinScanner] = useState(false);

  useEffect(() => {
    // Escuta em tempo real todas as OSs
    const q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(data);
      setLoading(false);
    }, (err) => {
      console.error('Erro ao carregar agendamentos:', err);
      setLoading(false);
    });

    // Verificar se o usuário é admin (na coleção admins)
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        setCheckingAdmin(false);
        return;
      }
      try {
        const adminDoc = await import('firebase/firestore').then(m => m.getDoc(doc(db, 'admins', auth.currentUser.uid)));
        setIsAdmin(adminDoc.exists());
      } catch (err) {
        console.error('Erro ao verificar admin:', err);
        setIsAdmin(false);
      }
      setCheckingAdmin(false);
    };
    checkAdmin();

    return () => unsubscribe();
  }, []);

  const handleBootstrapAdmin = async () => {
    setBootstrapping(true);
    setBootstrapMsg(null);
    try {
      // Pegar token do Firebase Auth
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Não foi possível obter token de autenticação');

      // Chamar endpoint HTTP com CORS habilitado
      const response = await fetch('https://us-central1-brilhocar-estetica-9f14b.cloudfunctions.net/bootstrapAdminHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }

      setBootstrapMsg({ type: 'success', text: data.message });
      setIsAdmin(true);
      // Recarregar após 1.5 segundo para aplicar permissões
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Erro no bootstrap:', err);
      setBootstrapMsg({ type: 'error', text: err.message || 'Erro ao tornar-se admin' });
    } finally {
      setBootstrapping(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const docRef = doc(db, 'appointments', id);
      await updateDoc(docRef, {
        status: newStatus,
        timeline: arrayUnion({ status: newStatus, date: new Date().toISOString() })
      });
    } catch (err) {
      alert('Erro ao atualizar status');
    }
  };

  const handleDelete = async (app) => {
    const reason = prompt(
      `Excluir agendamento ${app.os}?\n\nMotivo (opcional):`,
      ''
    );
    if (reason === null) return; // cancelou

    try {
      // 1. Salvar log ANTES de deletar
      await addDoc(collection(db, 'audit_logs'), {
        type: 'appointment_deleted',
        appointmentId: app.id,
        appointmentData: {
          os: app.os || null,
          userId: app.userId || null,
          userName: app.name || app.userName || null,
          userCelular: app.userCelular || app.celular || null,
          userEmail: app.userEmail || app.email || null,
          car: app.car || null,
          plate: app.plate || null,
          services: app.services || [],
          totalPrice: app.totalPrice || null,
          totalDuration: app.totalDuration || null,
          date: app.date || null,
          time: app.time || null,
          status: app.status || null,
          pixStatus: app.pixStatus || null,
          pixAmount: app.pixAmount || null,
          pixPaymentId: app.pixPaymentId || null,
          createdAt: app.createdAt || null,
        },
        reason: reason || 'Não informado',
        deletedBy: auth.currentUser?.uid || 'admin',
        deletedByEmail: auth.currentUser?.email || 'admin',
        deletedAt: serverTimestamp(),
      });

      // 2. Deletar o agendamento
      await deleteDoc(doc(db, 'appointments', app.id));

      alert(`Agendamento ${app.os} removido e registrado no histórico.`);
    } catch (err) {
      console.error('Erro ao deletar:', err);
      alert('Erro ao deletar agendamento. Verifique permissões.');
    }
  };

  // Seleção múltipla
  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === appointments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(appointments.map(a => a.id)));
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    const reason = prompt(
      `Excluir ${count} agendamento${count > 1 ? 's' : ''}?\n\nMotivo (opcional):`,
      ''
    );
    if (reason === null) return; // cancelou

    setDeletingMultiple(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const id of selectedIds) {
        const app = appointments.find(a => a.id === id);
        if (!app) continue;

        try {
          // Salvar log
          await addDoc(collection(db, 'audit_logs'), {
            type: 'appointment_deleted',
            appointmentId: id,
            appointmentData: {
              os: app.os || null,
              userId: app.userId || null,
              userName: app.name || app.userName || null,
              userCelular: app.userCelular || app.celular || null,
              userEmail: app.userEmail || app.email || null,
              car: app.car || null,
              plate: app.plate || null,
              services: app.services || [],
              totalPrice: app.totalPrice || null,
              totalDuration: app.totalDuration || null,
              date: app.date || null,
              time: app.time || null,
              status: app.status || null,
              pixStatus: app.pixStatus || null,
              pixAmount: app.pixAmount || null,
              pixPaymentId: app.pixPaymentId || null,
              createdAt: app.createdAt || null,
            },
            reason: reason || 'Não informado',
            deletedBy: auth.currentUser?.uid || 'admin',
            deletedByEmail: auth.currentUser?.email || 'admin',
            deletedAt: serverTimestamp(),
            batchDelete: true,
            totalInBatch: count,
          });

          // Deletar
          await deleteDoc(doc(db, 'appointments', id));
          successCount++;
        } catch (err) {
          console.error(`Erro ao deletar ${id}:`, err);
          failCount++;
        }
      }

      setSelectedIds(new Set());

      if (failCount === 0) {
        alert(`${successCount} agendamento${successCount > 1 ? 's' : ''} removido${successCount > 1 ? 's' : ''} e registrado${successCount > 1 ? 's' : ''} no histórico.`);
      } else {
        alert(`${successCount} deletado${successCount > 1 ? 's' : ''}, ${failCount} falhou${failCount > 1 ? 'ram' : ''}.`);
      }
    } catch (err) {
      console.error('Erro na exclusão em massa:', err);
      alert('Erro ao deletar agendamentos.');
    } finally {
      setDeletingMultiple(false);
    }
  };

  const total = appointments.length;
  const today = appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length;
  const inProgress = appointments.filter(a => ['Veículo Recebido', 'Serviço Iniciado'].includes(a.status)).length;
  const done = appointments.filter(a => ['Finalizado', 'Entregue'].includes(a.status)).length;

  // Calcular receita do mês
  const currentMonth = new Date().getMonth();
  const monthlyRevenue = appointments
    .filter(a => new Date(a.createdAt?.seconds * 1000).getMonth() === currentMonth)
    .reduce((sum, a) => sum + (a.totalPrice || 0), 0);

  const stats = [
    { label: 'Total Agendamentos', value: total, icon: CalendarCheck, color: 'text-primary' },
    { label: 'Agendamentos Hoje', value: today, icon: Clock, color: 'text-blue-500' },
    { label: 'Em Andamento', value: inProgress, icon: TrendingUp, color: 'text-yellow-500' },
    { label: 'Receita do Mês', value: `R$ ${monthlyRevenue.toFixed(0)}`, icon: DollarSign, color: 'text-green-500' },
  ];

  return (
    <div className="pt-4 md:pt-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Painel Administrativo</h2>
          <p className="text-gray-400 mt-1">Controle total do seu negócio</p>
        </div>
      </div>

      {/* Banner de permissões - aparece se não for admin */}
      {!checkingAdmin && !isAdmin && (
        <div className="mb-8 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
              <Shield className="text-yellow-500" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-500 text-lg mb-1">
                Permissão de Admin Necessária
              </h3>
              <p className="text-yellow-200/80 text-sm mb-4">
                Você está logado mas não tem permissão para salvar configurações.
                Clique no botão abaixo para se tornar admin (apenas na primeira vez).
              </p>
              {bootstrapMsg && (
                <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${
                  bootstrapMsg.type === 'success'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {bootstrapMsg.text}
                </div>
              )}
              <button
                onClick={handleBootstrapAdmin}
                disabled={bootstrapping}
                className="bg-yellow-500 text-black font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-400 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {bootstrapping ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Ativando...
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    Ativar Permissões Admin
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu de Navegação CMS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link
          to="/admin/horarios"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <Calendar size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Horários</p>
          <p className="text-xs text-gray-500 mt-1">Dias e horários disponíveis</p>
        </Link>

        <Link
          to="/admin/servicos"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <Sparkles size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Serviços</p>
          <p className="text-xs text-gray-500 mt-1">Preços, duração e descrição</p>
        </Link>

        <Link
          to="/admin/textos"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <Globe size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Textos do Site</p>
          <p className="text-xs text-gray-500 mt-1">Editar textos e banners</p>
        </Link>

        <Link
          to="/admin/promocoes"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <Gift size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Promoções</p>
          <p className="text-xs text-gray-500 mt-1">Black Friday, Natal, etc</p>
        </Link>

        <Link
          to="/admin/pix"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-green-500/50 transition-all group"
        >
          <CreditCard size={28} className="text-green-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Configurar PIX</p>
          <p className="text-xs text-gray-500 mt-1">Gateway de pagamento</p>
        </Link>

        <Link
          to="/admin/analytics"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <TrendingUp size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Analytics</p>
          <p className="text-xs text-gray-500 mt-1">Métricas e gráficos</p>
        </Link>

        <Link
          to="/admin/historico"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <FileText size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Histórico</p>
          <p className="text-xs text-gray-500 mt-1">Logs e exclusões</p>
        </Link>

        <Link
          to="/admin/reagendamentos"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <RefreshCcw size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Reagendamentos</p>
          <p className="text-xs text-gray-500 mt-1">Pedidos pendentes</p>
        </Link>

        <Link
          to="/admin/configuracoes"
          className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-primary/50 transition-all group"
        >
          <Settings size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Configurações</p>
          <p className="text-xs text-gray-500 mt-1">Regras do sistema</p>
        </Link>

        <button
          onClick={() => setShowCheckinScanner(!showCheckinScanner)}
          className={`bg-surface border rounded-2xl p-5 hover:border-primary/50 transition-all group text-left ${showCheckinScanner ? 'border-primary/50' : 'border-gray-800'}`}
        >
          <QrCode size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-white">Check-in</p>
          <p className="text-xs text-gray-500 mt-1">Escanear QR Code</p>
        </button>
      </div>

      {/* Scanner de Check-in */}
      {showCheckinScanner && (
        <div className="mb-8">
          <CheckinScanner />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-surface border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-semibold">{stat.label}</span>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-3xl font-black text-white">
              {loading ? '-' : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Appointments Table */}
      <div className="bg-[#f8f9fa] rounded-xl overflow-hidden shadow-lg border border-gray-200">
        {/* Barra de seleção múltipla */}
        {selectedIds.size > 0 && (
          <div className="bg-red-500 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare size={20} />
              <span className="font-bold">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={handleDeleteMultiple}
              disabled={deletingMultiple}
              className="bg-white text-red-500 font-bold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {deletingMultiple ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Excluir Selecionados
                </>
              )}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-black">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-4 font-semibold text-sm w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    title="Selecionar todos"
                  >
                    {selectedIds.size === appointments.length && appointments.length > 0 ? (
                      <CheckSquare size={18} className="text-primary" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="p-4 font-semibold text-sm">OS</th>
                <th className="p-4 font-semibold text-sm">Cliente</th>
                <th className="p-4 font-semibold text-sm">Veículo</th>
                <th className="p-4 font-semibold text-sm">Serviço</th>
                <th className="p-4 font-semibold text-sm">Valor</th>
                <th className="p-4 font-semibold text-sm">Status</th>
                <th className="p-4 font-semibold text-sm">Ações</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(app => (
                <tr key={app.id} className={`border-b border-gray-200 hover:bg-white transition-colors text-sm ${selectedIds.has(app.id) ? 'bg-red-50' : ''}`}>
                  <td className="p-4">
                    <button
                      onClick={() => toggleSelect(app.id)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {selectedIds.has(app.id) ? (
                        <CheckSquare size={18} className="text-primary" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </td>
                  <td className="p-4 font-mono font-bold">{app.os}</td>
                  <td className="p-4">
                    <div>{app.name}</div>
                    <div className="text-xs text-gray-500">{app.userCelular || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div>{app.car}</div>
                    <div className="text-xs text-gray-500">{app.plate}</div>
                  </td>
                  <td className="p-4">
                    <div className="max-w-[150px] truncate">
                      {app.services?.map(s => s.name).join(', ') || app.service || '-'}
                    </div>
                  </td>
                  <td className="p-4 font-bold">
                    {app.totalPrice ? `R$ ${app.totalPrice.toFixed(2)}` : '-'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      app.status === 'Entregue' ? 'bg-green-100 text-green-700' :
                      app.status === 'Finalizado' ? 'bg-blue-100 text-blue-700' :
                      app.status === 'Serviço Iniciado' ? 'bg-yellow-100 text-yellow-700' :
                      app.status === 'Veículo Recebido' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={app.status}
                        onChange={(e) => updateStatus(app.id, e.target.value)}
                        className="bg-transparent border-none font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-0 text-sm"
                      >
                        <option value="Aguardando Pagamento">Aguardando Pgto</option>
                        <option value="Agendado">Agendado</option>
                        <option value="Veículo Recebido">Recebido</option>
                        <option value="Serviço Iniciado">Iniciar</option>
                        <option value="Finalizado">Pronto</option>
                        <option value="Entregue">Finalizar</option>
                      </select>
                      <button
                        onClick={() => handleDelete(app)}
                        title="Excluir agendamento (será registrado no histórico)"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-500 font-medium">
                    Nenhum agendamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
