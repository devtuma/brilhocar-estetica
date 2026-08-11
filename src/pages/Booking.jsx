import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import QRCode from 'react-qr-code';
import { CheckCircle, Plus, Car, AlertCircle } from 'lucide-react';
import VehiclePicker from '../components/VehiclePicker';

const servicesList = [
  { id: 'lavagem-tecnica', name: 'Lavagem Técnica', price: 80 },
  { id: 'lavagem-detalhada', name: 'Lavagem Detalhada', price: 150 },
  { id: 'polimento-tecnico', name: 'Polimento Técnico', price: 350 },
  { id: 'vitrificacao', name: 'Vitrificação', price: 800 },
  { id: 'higienizacao-interna', name: 'Higienização Interna', price: 250 },
  { id: 'tratamento-vidros', name: 'Tratamento de Vidros', price: 120 },
];

export default function Booking() {
  const [searchParams] = useSearchParams();
  const initialService = searchParams.get('service') || '';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', car: '', plate: '', date: '', time: '', obs: ''
  });

  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [carroError, setCarroError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (initialService) {
      const found = servicesList.find(s => s.name === initialService);
      if (found && !selectedServices.find(s => s.id === found.id)) {
        setSelectedServices([found]);
      }
    }
  }, [initialService]);

  // Auto-fill de nome via Firebase Auth + perfil no Firestore
  useEffect(() => {
    const loadUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setFormData(prev => ({
            ...prev,
            name: data.name || prev.name,
          }));
        } else {
          // Sem perfil salvo ainda — usar displayName se houver
          if (user.displayName) {
            setFormData(prev => ({ ...prev, name: user.displayName }));
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar perfil:', err);
      }
    };

    loadUserProfile();
  }, []);

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.length * 60;

  const handleSelectCar = (car) => {
    setSelectedCar(car);
    setFormData(prev => ({ ...prev, car: car.modelo, plate: car.placa }));
    setCarroError(false);
    setShowVehiclePicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedServices.length === 0) {
      alert('Selecione pelo menos um serviço');
      return;
    }

    if (!selectedCar) {
      setCarroError(true);
      setShowVehiclePicker(true);
      return;
    }

    setLoading(true);

    const user = auth.currentUser;
    const year = new Date().getFullYear();
    const osNumber = `BC-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    const appointment = {
      ...formData,
      car: selectedCar.modelo,
      plate: selectedCar.placa,
      carId: selectedCar.id,
      services: selectedServices.map(s => ({ id: s.id, name: s.name, price: s.price })),
      serviceNames: selectedServices.map(s => s.name).join(' + '),
      totalPrice,
      totalDuration,
      os: osNumber,
      userId: user ? user.uid : null,
      phone: user ? user.phoneNumber : '',
      status: 'Agendado',
      createdAt: serverTimestamp(),
      timeline: [{ status: 'Agendado', date: new Date().toISOString() }]
    };

    try {
      const docRef = await addDoc(collection(db, 'appointments'), appointment);

      // Atualiza lastAccess do user
      if (user) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: formData.name,
            phone: user.phoneNumber || '',
            lastAccess: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.warn('Não foi possível atualizar perfil:', e);
        }
      }

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
    const phoneNum = (successData.phone || '').replace(/\D/g, '');
    const servicesText = (successData.services || []).map(s => `• ${s.name} - R$ ${s.price.toFixed(2)}`).join('%0A');
    const msg = `Olá ${successData.name}, seu agendamento na BrilhoCar foi confirmado!%0A%0A*OS:* ${successData.os}%0A*Serviços:*%0A${servicesText}%0A*Total:* R$ ${successData.totalPrice.toFixed(2)}%0A*Data:* ${successData.date} às ${successData.time}%0A%0AApresente o QR Code na entrada.`;
    const targetPhone = phoneNum || '11999999999';
    window.open(`https://wa.me/55${targetPhone}?text=${msg}`, '_blank');
  };

  const qrData = successData ? JSON.stringify({ os: successData.os, id: successData.id }) : '';

  if (successData) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 animate-fade-in-up mt-8">
        <div className="bg-surface border border-green-500/30 p-8 rounded-3xl shadow-[0_0_30px_rgba(34,197,94,0.1)]">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2">Agendamento Confirmado!</h2>
          <p className="text-gray-400 mb-2">OS: <strong className="text-white">{successData.os}</strong></p>
          <p className="text-sm text-gray-500 mb-6">
            {successData.services.length} {successData.services.length === 1 ? 'serviço' : 'serviços'} · Total: R$ {successData.totalPrice.toFixed(2)}
          </p>

          <div className="bg-white p-4 rounded-2xl inline-block mb-8">
            <QRCode value={qrData} size={200} />
          </div>

          <p className="text-sm text-gray-400 mb-6">Apresente este QR Code na recepção para iniciar seu atendimento.</p>

          <button onClick={handleWhatsapp} className="w-full bg-[#25D366] text-black font-bold py-4 rounded-xl hover:bg-[#20b858] transition-colors flex items-center justify-center gap-2">
            Enviar para meu WhatsApp
          </button>

          <button onClick={() => navigate('/track')} className="w-full mt-3 bg-transparent border border-gray-700 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">
            Acompanhar meus agendamentos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Novo Agendamento</h2>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">Selecione os serviços desejados e confirme os dados do seu veículo.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seleção de Serviços */}
        <div>
          <label className="block text-sm font-bold text-white mb-3">
            Serviços <span className="text-gray-500 font-normal">({selectedServices.length} selecionado{selectedServices.length !== 1 ? 's' : ''})</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {servicesList.map(service => {
              const isSelected = selectedServices.find(s => s.id === service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service)}
                  className={`text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div>
                    <p className={`font-bold ${isSelected ? 'text-primary' : 'text-white'}`}>
                      {service.name}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">R$ {service.price.toFixed(2)} · ~60min</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary' : 'bg-gray-800 border border-gray-700'
                  }`}>
                    {isSelected && <Plus className="text-black" size={16} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedServices.length > 0 && (
            <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300 font-semibold">Total estimado:</span>
                <span className="text-2xl font-black text-primary">R$ {totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Duração estimada: ~{totalDuration} minutos ({Math.floor(totalDuration / 60)}h{totalDuration % 60 > 0 ? `${totalDuration % 60}min` : ''})
              </p>
            </div>
          )}
        </div>

        {/* Dados pessoais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="Seu Nome" />
          </div>

          <div className="space-y-4">
            {/* Combo de Carro */}
            <div>
              <button
                type="button"
                onClick={() => setShowVehiclePicker(true)}
                className={`w-full text-left bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between transition-all ${
                  carroError ? 'animate-pulse-red' : ''
                }`}
              >
                <span className={selectedCar ? 'text-black' : 'text-gray-500'}>
                  {selectedCar ? `${selectedCar.modelo} - ${selectedCar.placa}` : 'Selecione o carro'}
                </span>
                <Car size={18} className="text-gray-500" />
              </button>
              {carroError && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle size={12} /> Selecione um carro para continuar
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <input required type="text" value={formData.car} onChange={e=>setFormData({...formData, car: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" placeholder="Modelo do veículo" />
            <input required type="time" value={formData.time} onChange={e=>setFormData({...formData, time: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" />
          </div>

          <div className="space-y-4">
            <input required type="text" value={formData.plate} onChange={e=>setFormData({...formData, plate: e.target.value.toUpperCase()})} maxLength={8} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary uppercase placeholder-gray-500" placeholder="Placa do Carro (ex: ABC1D23)" />
            <input required type="date" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} min={new Date().toISOString().split('T')[0]} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500" />
          </div>
        </div>

        <div className="space-y-4">
          <textarea value={formData.obs} onChange={e=>setFormData({...formData, obs: e.target.value})} className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 h-[8rem] resize-none" placeholder="Observações (opcional)"></textarea>
        </div>

        <div className="mt-8">
          <button
            disabled={loading || selectedServices.length === 0}
            type="submit"
            className="bg-primary text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#00c853] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : 'Confirmar e gerar QR Code'}
          </button>
        </div>
      </form>

      <VehiclePicker
        isOpen={showVehiclePicker}
        onClose={() => setShowVehiclePicker(false)}
        onSelect={handleSelectCar}
        selectedCarId={selectedCar?.id}
      />
    </div>
  );
}
