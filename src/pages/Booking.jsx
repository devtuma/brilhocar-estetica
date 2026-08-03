import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import QRCode from 'react-qr-code';
import { Calendar, Clock, Car, Phone, User, CheckCircle } from 'lucide-react';

const servicesList = [
  'Lavagem Técnica', 'Lavagem Detalhada', 'Polimento Técnico', 
  'Vitrificação', 'Higienização Interna', 'Tratamento de Vidros'
];

export default function Booking() {
  const [searchParams] = useSearchParams();
  const initialService = searchParams.get('service') || '';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', phone: '', car: '', plate: '', service: initialService, date: '', time: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Generate OS Number
    const year = new Date().getFullYear();
    const osNumber = `CC-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const appointment = {
      ...formData,
      os: osNumber,
      status: 'Agendado',
      createdAt: serverTimestamp(),
      timeline: [{ status: 'Agendado', date: new Date().toISOString() }]
    };

    try {
      const docRef = await addDoc(collection(db, 'appointments'), appointment);
      setSuccessData({ id: docRef.id, ...appointment });
    } catch (err) {
      console.error(err);
      alert('Erro ao agendar. Verifique as configurações do Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsapp = () => {
    if (!successData) return;
    const phoneNum = successData.phone.replace(/\D/g, '');
    const msg = `Olá ${successData.name}, seu agendamento na BrilhoCar foi confirmado!%0A%0A*OS:* ${successData.os}%0A*Serviço:* ${successData.service}%0A*Data:* ${successData.date} às ${successData.time}%0A%0AApresente o QR Code na entrada.`;
    window.open(`https://wa.me/55${phoneNum}?text=${msg}`, '_blank');
  };

  if (successData) {
    const qrData = JSON.stringify({ os: successData.os, id: successData.id });
    return (
      <div className="max-w-md mx-auto text-center space-y-6 animate-fade-in-up mt-8">
        <div className="bg-surface border border-green-500/30 p-8 rounded-3xl shadow-[0_0_30px_rgba(34,197,94,0.1)]">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2">Agendamento Confirmado!</h2>
          <p className="text-gray-400 mb-8">OS: <strong className="text-white">{successData.os}</strong></p>
          
          <div className="bg-white p-4 rounded-2xl inline-block mb-8">
            <QRCode value={qrData} size={200} />
          </div>
          
          <p className="text-sm text-gray-400 mb-6">Apresente este QR Code na recepção para iniciar seu atendimento.</p>
          
          <button onClick={handleWhatsapp} className="w-full bg-[#25D366] text-black font-bold py-4 rounded-xl hover:bg-[#20b858] transition-colors flex items-center justify-center gap-2">
            Enviar para meu WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 animate-fade-in-up">
      <h2 className="text-3xl font-black mb-8">Agende seu <span className="text-primary">Serviço</span></h2>
      
      <form onSubmit={handleSubmit} className="bg-surface border border-gray-800 p-8 rounded-3xl space-y-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold flex items-center gap-2"><User size={16}/> Nome Completo</label>
            <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors" placeholder="João Silva" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold flex items-center gap-2"><Phone size={16}/> WhatsApp</label>
            <input required type="tel" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors" placeholder="(11) 99999-9999" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold flex items-center gap-2"><Car size={16}/> Veículo (Modelo)</label>
            <input required type="text" value={formData.car} onChange={e=>setFormData({...formData, car: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors" placeholder="Ex: Honda Civic" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold flex items-center gap-2"><Car size={16}/> Placa</label>
            <input required type="text" value={formData.plate} onChange={e=>setFormData({...formData, plate: e.target.value.toUpperCase()})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors uppercase" placeholder="ABC-1234" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-gray-400 font-semibold">Serviço Desejado</label>
            <select required value={formData.service} onChange={e=>setFormData({...formData, service: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors">
              <option value="" disabled>Selecione um serviço</option>
              {servicesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold flex items-center gap-2"><Calendar size={16}/> Data</label>
            <input required type="date" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold flex items-center gap-2"><Clock size={16}/> Horário</label>
            <input required type="time" value={formData.time} onChange={e=>setFormData({...formData, time: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors" />
          </div>

        </div>

        <button disabled={loading} type="submit" className="w-full bg-primary text-white font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(238,34,34,0.2)] hover:bg-red-600 hover:scale-[1.02] transition-all disabled:opacity-50">
          {loading ? 'Processando...' : 'Confirmar Agendamento'}
        </button>
      </form>
    </div>
  );
}
