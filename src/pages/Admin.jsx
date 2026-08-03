import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { LayoutDashboard, LogOut, Search, Clock, CheckCircle, Car } from 'lucide-react';

export default function Admin() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuta em tempo real todas as OSs
    const q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Agendado': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'Veículo Recebido': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'Serviço Iniciado': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'Finalizado': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'Entregue': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default: return 'text-white bg-gray-800 border-gray-700';
    }
  };

  const total = appointments.length;
  const inProgress = appointments.filter(a => ['Veículo Recebido', 'Serviço Iniciado'].includes(a.status)).length;
  const done = appointments.filter(a => ['Finalizado', 'Entregue'].includes(a.status)).length;

  return (
    <div className="animate-fade-in-up mt-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <LayoutDashboard className="text-primary"/> Painel Administrativo
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-surface border border-gray-800 rounded-3xl p-8 flex items-center gap-6">
          <div className="bg-gray-900 p-4 rounded-2xl text-primary"><Search size={32}/></div>
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-1">Total Agendados</p>
            <p className="text-4xl font-black">{loading ? '-' : total}</p>
          </div>
        </div>
        <div className="bg-surface border border-gray-800 rounded-3xl p-8 flex items-center gap-6">
          <div className="bg-gray-900 p-4 rounded-2xl text-accent"><Car size={32}/></div>
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-1">Na Garagem</p>
            <p className="text-4xl font-black">{loading ? '-' : inProgress}</p>
          </div>
        </div>
        <div className="bg-surface border border-gray-800 rounded-3xl p-8 flex items-center gap-6">
          <div className="bg-gray-900 p-4 rounded-2xl text-green-500"><CheckCircle size={32}/></div>
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-1">Finalizados</p>
            <p className="text-4xl font-black">{loading ? '-' : done}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-gray-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 border-b border-gray-800">
                <th className="p-4 font-bold text-gray-400 uppercase tracking-wider text-xs">OS / Cliente</th>
                <th className="p-4 font-bold text-gray-400 uppercase tracking-wider text-xs">Veículo</th>
                <th className="p-4 font-bold text-gray-400 uppercase tracking-wider text-xs">Serviço</th>
                <th className="p-4 font-bold text-gray-400 uppercase tracking-wider text-xs">Data/Hora</th>
                <th className="p-4 font-bold text-gray-400 uppercase tracking-wider text-xs">Status</th>
                <th className="p-4 font-bold text-gray-400 uppercase tracking-wider text-xs text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(app => (
                <tr key={app.id} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors">
                  <td className="p-4">
                    <div className="font-black text-white">{app.os}</div>
                    <div className="text-gray-400 text-sm">{app.name}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold">{app.car}</div>
                    <div className="text-accent text-sm font-black">{app.plate}</div>
                  </td>
                  <td className="p-4 font-semibold">{app.service}</td>
                  <td className="p-4 text-gray-400">
                    <div className="flex items-center gap-2"><Clock size={14}/> {app.date}</div>
                    <div className="text-sm mt-1">{app.time}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <select 
                      value={app.status} 
                      onChange={(e) => updateStatus(app.id, e.target.value)}
                      className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2"
                    >
                      <option value="Agendado">Agendado</option>
                      <option value="Veículo Recebido">Veículo Recebido</option>
                      <option value="Serviço Iniciado">Serviço Iniciado</option>
                      <option value="Finalizado">Finalizado</option>
                      <option value="Entregue">Entregue</option>
                    </select>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">Nenhum agendamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
