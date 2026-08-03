import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

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

  const total = appointments.length;
  const inProgress = appointments.filter(a => ['Veículo Recebido', 'Serviço Iniciado'].includes(a.status)).length;
  const done = appointments.filter(a => ['Finalizado', 'Entregue'].includes(a.status)).length;

  return (
    <div className="max-w-6xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Painel Administrativo</h2>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">Controle dos agendamentos, status e WhatsApp automático.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="border border-gray-800 rounded-xl p-6 bg-[#0b0b0f]">
          <p className="text-5xl font-bold text-primary mb-2">{loading ? '-' : total}</p>
          <p className="text-gray-300 font-semibold">Agendamentos</p>
        </div>
        <div className="border border-gray-800 rounded-xl p-6 bg-[#0b0b0f]">
          <p className="text-5xl font-bold text-primary mb-2">{loading ? '-' : inProgress}</p>
          <p className="text-gray-300 font-semibold">Em andamento</p>
        </div>
        <div className="border border-gray-800 rounded-xl p-6 bg-[#0b0b0f]">
          <p className="text-5xl font-bold text-primary mb-2">{loading ? '-' : done}</p>
          <p className="text-gray-300 font-semibold">Entregues</p>
        </div>
      </div>

      <div className="bg-[#f8f9fa] rounded-xl overflow-hidden shadow-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-black">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-4 font-semibold text-sm">OS</th>
                <th className="p-4 font-semibold text-sm">Cliente</th>
                <th className="p-4 font-semibold text-sm">Veículo</th>
                <th className="p-4 font-semibold text-sm">Serviço</th>
                <th className="p-4 font-semibold text-sm">Status</th>
                <th className="p-4 font-semibold text-sm">Ações</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(app => (
                <tr key={app.id} className="border-b border-gray-200 hover:bg-white transition-colors text-sm">
                  <td className="p-4">{app.os}</td>
                  <td className="p-4">{app.name}</td>
                  <td className="p-4">
                    {app.car} <span className="text-gray-500 text-xs ml-1">{app.plate}</span>
                  </td>
                  <td className="p-4">{app.service}</td>
                  <td className="p-4">{app.status}</td>
                  <td className="p-4">
                    <select 
                      value={app.status} 
                      onChange={(e) => updateStatus(app.id, e.target.value)}
                      className="bg-transparent border-none font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-0"
                    >
                      <option value="Agendado">Entrada</option>
                      <option value="Veículo Recebido">Recebido</option>
                      <option value="Serviço Iniciado">Iniciar</option>
                      <option value="Finalizado">Pronto</option>
                      <option value="Entregue">Finalizar</option>
                    </select>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500 font-medium">Nenhum agendamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
