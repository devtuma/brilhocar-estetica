import { useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Car, AlertCircle, Loader2 } from 'lucide-react';

export default function Track() {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appointment, setAppointment] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;

    setLoading(true);
    setError('');
    setAppointment(null);

    try {
      const q = query(
        collection(db, 'appointments'),
        where('plate', '==', searchValue.trim().toUpperCase())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Fallback para telefone se placa não achar
        const qPhone = query(
          collection(db, 'appointments'),
          where('phone', '==', searchValue.trim())
        );
        const phoneSnapshot = await getDocs(qPhone);
        
        if (phoneSnapshot.empty) {
          setError('Nenhum veículo encontrado com essa Placa ou Telefone.');
          setLoading(false);
          return;
        }
        
        // Pega o mais recente
        const docs = phoneSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setAppointment(docs[0]);
      } else {
        const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setAppointment(docs[0]);
      }
      
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStep = (status) => {
    switch (status) {
      case 'Agendado': return 1;
      case 'Veículo Recebido': return 2;
      case 'Serviço Iniciado': return 3;
      case 'Finalizado': return 4;
      case 'Entregue': return 5;
      default: return 1;
    }
  };

  const currentStep = appointment ? getStatusStep(appointment.status) : 0;

  return (
    <div className="max-w-4xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Acompanhar Veículo</h2>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">Digite a placa ou seu telefone para ver o status em tempo real.</p>

      <form onSubmit={handleSearch} className="mb-12 flex flex-col md:flex-row gap-4">
        <input 
          type="text" 
          placeholder="Ex: ABC-1234 ou 11999999999" 
          value={searchValue}
          onChange={e=>setSearchValue(e.target.value)}
          className="flex-1 bg-white text-black font-semibold rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500"
        />
        <button type="submit" disabled={loading} className="bg-primary text-black font-semibold px-8 py-4 rounded-lg hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>} 
          Buscar Veículo
        </button>
      </form>

      {error && (
        <div className="text-red-500 flex items-center gap-2 bg-red-500/10 p-4 rounded-xl border border-red-500/20 mb-8">
          <AlertCircle/> {error}
        </div>
      )}

      {appointment && (
        <div className="bg-surface border border-gray-800 rounded-3xl p-6 md:p-8 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-gray-800 pb-6 mb-8 gap-4">
            <div>
              <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">OS: {appointment.os}</p>
              <h3 className="text-3xl font-black text-white">{appointment.car}</h3>
              <p className="text-primary font-bold mt-1 text-lg">{appointment.plate}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-gray-400 text-sm">Serviço Contratado</p>
              <p className="font-semibold text-lg">{appointment.service}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative pt-4 pb-8">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800 md:left-1/2 md:-ml-px"></div>
            
            <div className="space-y-8 relative">
              {['Agendado', 'Veículo Recebido', 'Serviço Iniciado', 'Finalizado', 'Entregue'].map((stepStatus, index) => {
                const stepNum = index + 1;
                const isCompleted = currentStep >= stepNum;
                const isCurrent = currentStep === stepNum;
                
                return (
                  <div key={stepStatus} className={`flex items-center md:justify-between ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                    <div className="hidden md:block w-5/12"></div>
                    <div className={`z-10 flex items-center justify-center w-8 h-8 rounded-full bg-surface border-4 shrink-0 shadow-xl ml-0 md:ml-0 ${isCompleted ? 'border-primary' : 'border-gray-800'}`} style={{ borderColor: isCompleted ? '#00e676' : '#1f2937' }}>
                      {isCompleted && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                    </div>
                    <div className={`w-11/12 md:w-5/12 pl-4 md:pl-0 md:px-4 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'} ${isCompleted ? 'text-white' : 'text-gray-600'}`}>
                      <h4 className={`text-lg font-bold ${isCurrent ? 'text-primary' : ''}`}>{stepStatus}</h4>
                      {isCurrent && <p className="text-sm text-gray-400 mt-1">Status atual do seu veículo</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
