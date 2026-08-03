import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import QRCode from 'react-qr-code';
import { CheckCircle } from 'lucide-react';

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
    <div className="max-w-4xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Novo Agendamento</h2>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">Cadastro do cliente, veículo e serviço.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="space-y-4">
            <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="Nome do cliente" />
            <input required type="text" value={formData.car} onChange={e=>setFormData({...formData, car: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="Modelo do veículo" />
            <select required value={formData.service} onChange={e=>setFormData({...formData, service: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="" disabled>Selecione o serviço</option>
              {servicesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input required type="time" value={formData.time} onChange={e=>setFormData({...formData, time: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="Horário" />
          </div>

          <div className="space-y-4">
            <input required type="tel" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="WhatsApp com DDD" />
            <input required type="text" value={formData.plate} onChange={e=>setFormData({...formData, plate: e.target.value.toUpperCase()})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary uppercase placeholder-gray-500" placeholder="Placa" />
            <input required type="date" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="Data" />
            <textarea className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 h-[3.25rem] resize-none" placeholder="Observações"></textarea>
          </div>
          
        </div>

        <div className="mt-8">
          <button disabled={loading} type="submit" className="bg-primary text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#00c853] transition-colors disabled:opacity-50">
            {loading ? 'Processando...' : 'Confirmar e gerar QR Code'}
          </button>
        </div>
      </form>
    </div>
  );
}
