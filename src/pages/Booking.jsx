import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, serverTimestamp, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Plus, Car, AlertCircle } from 'lucide-react';
import VehiclePicker from '../components/VehiclePicker';
import TimeSlotPicker from '../components/TimeSlotPicker';

// Serviços agora vêm do Firestore (collection: services)
// Default fallback caso não tenha nenhum cadastrado
const DEFAULT_SERVICES = [
  { id: 'lavagem-tecnica', name: 'Lavagem Técnica', price: 1, duration: 60 },
  { id: 'lavagem-detalhada', name: 'Lavagem Detalhada', price: 1, duration: 90 },
  { id: 'polimento-tecnico', name: 'Polimento Técnico', price: 1, duration: 180 },
  { id: 'vitrificacao', name: 'Vitrificação', price: 1, duration: 240 },
  { id: 'higienizacao-interna', name: 'Higienização Interna', price: 1, duration: 120 },
  { id: 'tratamento-vidros', name: 'Tratamento de Vidros', price: 1, duration: 60 },
];

export default function Booking() {
  const [searchParams] = useSearchParams();
  const initialService = searchParams.get('service') || '';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', celular: '', car: '', plate: '', date: '', time: '', obs: ''
  });

  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showTimeSlotPicker, setShowTimeSlotPicker] = useState(false);
  const [carroError, setCarroError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [servicesList, setServicesList] = useState(DEFAULT_SERVICES);

  // Carregar serviços do Firestore em tempo real
  useEffect(() => {
    const servicesRef = collection(db, 'services');
    const unsubscribe = onSnapshot(servicesRef, (snap) => {
      if (!snap.empty) {
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          price: doc.data().basePrice || 0,
          duration: doc.data().duration || 60
        })).filter(s => s.active !== false);
        setServicesList(data);
      } else {
        setServicesList(DEFAULT_SERVICES);
      }
    }, (err) => {
      console.warn('Erro ao carregar serviços, usando defaults:', err);
      setServicesList(DEFAULT_SERVICES);
    });
    return () => unsubscribe();
  }, []);

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
            celular: data.celular || prev.celular,
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

  const handleSelectTime = (time) => {
    setFormData(prev => ({ ...prev, time }));
    setShowTimeSlotPicker(false);
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, date, time: '' }));
    setShowTimeSlotPicker(true);
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
      userCelular: formData.celular || '',
      // IMPORTANTE: status inicia como 'Aguardando Pagamento'
      // Só vira 'Agendado' quando o PIX é confirmado via webhook do Asaas
      status: 'Aguardando Pagamento',
      pixStatus: 'pending',
      createdAt: serverTimestamp(),
      timeline: [{ status: 'Aguardando Pagamento', date: new Date().toISOString(), note: 'Aguardando pagamento do sinal PIX' }]
    };

    try {
      // USAR CLOUD FUNCTION COM TRANSACTION ATOMICA
      // Evita race condition entre multiplos usuarios reservando mesmo horario
      const createFn = httpsCallable(functions, 'createAppointmentWithSlotLock');
      const result = await createFn({
        appointmentData: {
          ...appointment,
          // Nao enviar createdAt/updatedAt - a Cloud Function gera
        }
      });

      const docRef = { id: result.data.appointmentId };

      // Atualiza lastAccess do user
      if (user) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: formData.name,
            lastAccess: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.warn('Não foi possível atualizar perfil:', e);
        }
      }

      // Redirecionar para página de pagamento PIX
      navigate(`/pagamento/${docRef.id}`);

    } catch (err) {
      console.error(err);
      // Mensagem amigavel para conflito de horario
      const msg = err.message || '';
      if (msg.includes('já está reservado') || msg.includes('já está ocupado')) {
        alert(`⚠️ ${msg}\n\nPor favor, escolha outro horário.`);
        // Forcar recarregar slots
        setShowTimeSlotPicker(false);
        setTimeout(() => setShowTimeSlotPicker(true), 100);
      } else {
        alert('Erro ao agendar: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2 text-text">Novo Agendamento</h2>
      <p className="text-sm md:text-base text-text-secondary mb-8 md:mb-12">Selecione os serviços desejados e confirme os dados do seu veículo.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seleção de Serviços */}
        <div>
          <label className="block text-sm font-bold text-text mb-3">
            Serviços <span className="text-text-muted font-normal">({selectedServices.length} selecionado{selectedServices.length !== 1 ? 's' : ''})</span>
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
                      : 'bg-surface border-border hover:border-border-strong'
                  }`}
                >
                  <div>
                    <p className={`font-bold ${isSelected ? 'text-primary' : 'text-text'}`}>
                      {service.name}
                    </p>
                    <p className="text-sm text-text-secondary mt-1">R$ {service.price.toFixed(2)} · ~60min</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary' : 'bg-surface-elevated border border-border-strong'
                  }`}>
                    {isSelected && <Plus className="text-on-primary" size={16} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedServices.length > 0 && (
            <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text font-semibold">Total estimado:</span>
                <span className="text-2xl font-black text-primary">R$ {totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Duração estimada: ~{totalDuration} minutos ({Math.floor(totalDuration / 60)}h{totalDuration % 60 > 0 ? `${totalDuration % 60}min` : ''})
              </p>
            </div>
          )}
        </div>

        {/* Dados pessoais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary placeholder-text-muted" placeholder="Seu Nome" />
          </div>

          <div className="space-y-4">
            {/* Combo de Carro */}
            <div>
              <button
                type="button"
                onClick={() => setShowVehiclePicker(true)}
                className={`w-full text-left bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary flex items-center justify-between transition-all ${
                  carroError ? 'animate-pulse-red' : ''
                }`}
              >
                <span className={selectedCar ? 'text-text' : 'text-text-muted'}>
                  {selectedCar ? `${selectedCar.modelo} - ${selectedCar.placa}` : 'Selecione o carro'}
                </span>
                <Car size={18} className="text-text-muted" />
              </button>
              {carroError && (
                <p className="text-danger text-xs mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle size={12} /> Selecione um carro para continuar
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <input required type="text" value={formData.car} onChange={e=>setFormData({...formData, car: e.target.value})} className="w-full bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary placeholder-text-muted" placeholder="Modelo do veículo" />
          </div>

          <div className="space-y-4">
            <input required type="text" value={formData.plate} onChange={e=>setFormData({...formData, plate: e.target.value.toUpperCase()})} maxLength={8} className="w-full bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary uppercase placeholder-text-muted" placeholder="Placa do Carro (ex: ABC1D23)" />
          </div>
        </div>

        {/* Data e Horário com TimeSlotPicker */}
        <div className="space-y-4">
          <label className="block text-sm font-bold text-text">
            Data e Horário <span className="text-text-muted font-normal">(obrigatório)</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              type="date"
              value={formData.date}
              onChange={(e) => handleDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowTimeSlotPicker(true)}
              disabled={!formData.date}
              className={`w-full text-left bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary flex items-center justify-between transition-all ${
                !formData.date ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span className={formData.time ? 'text-text' : 'text-text-muted'}>
                {formData.time || 'Selecione o horário'}
              </span>
              <span className="text-text-muted text-sm">
                {formData.time && '✓'}
              </span>
            </button>
          </div>

          {showTimeSlotPicker && formData.date && (
            <TimeSlotPicker
              selectedDate={formData.date}
              onSelectTime={handleSelectTime}
              appointmentDuration={totalDuration}
              onClose={() => setShowTimeSlotPicker(false)}
            />
          )}
        </div>

        <div className="space-y-4">
          <textarea value={formData.obs} onChange={e=>setFormData({...formData, obs: e.target.value})} className="w-full bg-surface text-text border border-border font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary placeholder-text-muted h-[8rem] resize-none" placeholder="Observações (opcional)"></textarea>
        </div>

        <div className="mt-8">
          <button
            disabled={loading || selectedServices.length === 0 || !formData.time}
            type="submit"
            className="bg-primary text-on-primary font-semibold px-6 py-3 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : 'Confirmar e Ir para Pagamento'}
          </button>
          {!formData.time && formData.date && (
            <p className="text-xs text-text-muted mt-2">Selecione um horário disponível acima</p>
          )}
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
