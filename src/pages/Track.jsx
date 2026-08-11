import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Search, Car, AlertCircle, Loader2, QrCode, X, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';

export default function Track() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [qrModal, setQrModal] = useState(null); // {os, id} quando aberto

  useEffect(() => {
    const fetchAppointments = async () => {
      const user = auth.currentUser;
      if (!user) {
        setError('Usuário não autenticado.');
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'appointments'),
          where('userId', '==', user.uid)
        );

        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordena no frontend caso haja problema com índice composto
        docs.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
          return bTime - aTime;
        });

        setAppointments(docs);
      } catch (err) {
        console.error(err);
        setError('Erro ao buscar seus veículos. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

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

  const getServicesText = (appointment) => {
    if (appointment.services && Array.isArray(appointment.services)) {
      return appointment.services.map(s => s.name).join(' + ');
    }
    return appointment.service || appointment.serviceNames || '—';
  };

  const getTotalPrice = (appointment) => {
    if (typeof appointment.totalPrice === 'number') return appointment.totalPrice;
    if (appointment.services && Array.isArray(appointment.services)) {
      return appointment.services.reduce((sum, s) => sum + (s.price || 0), 0);
    }
    return null;
  };

  const openQrModal = (appointment) => {
    setQrModal({ os: appointment.os, id: appointment.id, appointment });
  };

  const closeQrModal = () => setQrModal(null);

  const shareQrWhatsapp = () => {
    if (!qrModal) return;
    const { appointment } = qrModal;
    const phoneNum = (appointment.phone || '').replace(/\D/g, '');
    const servicesText = (appointment.services || []).map(s => `• ${s.name}`).join('%0A') || getServicesText(appointment);
    const totalText = getTotalPrice(appointment) ? `%0A*Total:* R$ ${getTotalPrice(appointment).toFixed(2)}` : '';
    const msg = `Olá ${appointment.name}, segue o QR Code do seu agendamento na BrilhoCar!%0A%0A*OS:* ${appointment.os}%0A*Serviços:*%0A${servicesText}${totalText}%0A*Data:* ${appointment.date} às ${appointment.time}%0A%0AApresente o QR Code na entrada.`;
    const targetPhone = phoneNum || '11999999999';
    window.open(`https://wa.me/55${targetPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="max-w-4xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Meus Veículos</h2>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">
        Acompanhe o status em tempo real dos serviços agendados no seu celular.
      </p>

      {error && (
        <div className="text-red-500 flex items-center gap-2 bg-red-500/10 p-4 rounded-xl border border-red-500/20 mb-8">
          <AlertCircle/> {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary mb-4" size={48} />
          <p className="text-gray-400 font-semibold">Buscando seus veículos...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-20 bg-surface border border-gray-800 rounded-3xl">
          <Car size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Nenhum serviço encontrado</h3>
          <p className="text-gray-400 mb-6">Você ainda não agendou nenhum serviço conosco.</p>
          <Link to="/booking" className="bg-primary text-black font-bold px-6 py-3 rounded-lg hover:bg-[#00c853] transition-colors inline-block">
            Fazer meu primeiro agendamento
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {appointments.map(appointment => {
            const currentStep = getStatusStep(appointment.status);
            const servicesText = getServicesText(appointment);
            const totalPrice = getTotalPrice(appointment);

            return (
              <div key={appointment.id} className="bg-surface border border-gray-800 rounded-3xl p-6 md:p-8 animate-fade-in-up">
                <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-gray-800 pb-6 mb-8 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">OS: {appointment.os}</p>
                    <h3 className="text-3xl font-black text-white">{appointment.car}</h3>
                    <p className="text-primary font-bold mt-1 text-lg">{appointment.plate}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-gray-400 text-sm">Serviço(s) Contratado(s)</p>
                    <p className="font-semibold text-lg">{servicesText}</p>
                    {totalPrice !== null && (
                      <p className="text-primary font-bold mt-1">R$ {totalPrice.toFixed(2)}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">Agendado para: {appointment.date} às {appointment.time}</p>
                  </div>
                </div>

                {/* Botões de ação */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={() => openQrModal(appointment)}
                    className="bg-primary/10 border border-primary/30 text-primary font-bold px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2"
                  >
                    <QrCode size={18} /> Mostrar QR Code
                  </button>
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
            );
          })}
        </div>
      )}

      {/* Modal do QR Code */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={closeQrModal}
        >
          <div
            className="relative bg-surface border border-gray-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeQrModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-full p-2 transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-3">
                <QrCode className="text-primary" size={24} />
              </div>
              <h3 className="text-xl font-black text-white mb-1">Seu QR Code</h3>
              <p className="text-sm text-gray-400 mb-6">Apresente na recepção da BrilhoCar</p>

              <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                <QRCode value={JSON.stringify({ os: qrModal.os, id: qrModal.id })} size={220} />
              </div>

              <p className="text-sm text-gray-300 mb-1">
                OS: <strong className="text-white">{qrModal.os}</strong>
              </p>
              <p className="text-xs text-gray-500 mb-6">
                {qrModal.appointment.car} · {qrModal.appointment.plate}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={shareQrWhatsapp}
                  className="w-full bg-[#25D366] text-black font-bold py-3 rounded-xl hover:bg-[#20b858] transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} /> Enviar para WhatsApp
                </button>
                <button
                  onClick={closeQrModal}
                  className="w-full bg-transparent border border-gray-700 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}