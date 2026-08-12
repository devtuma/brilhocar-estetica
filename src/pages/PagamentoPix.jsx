import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import PixPayment from '../components/PixPayment';
import { ArrowLeft, Calendar, Clock, Car, DollarSign } from 'lucide-react';

export default function PagamentoPix() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setError('ID do agendamento não fornecido');
      setLoading(false);
      return;
    }

    // Buscar agendamento
    const appointmentRef = doc(db, 'appointments', id);
    const unsubscribe = onSnapshot(appointmentRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };

        // Verificar se o usuário tem permissão
        if (data.userId !== auth.currentUser?.uid) {
          setError('Você não tem permissão para ver este agendamento');
          setLoading(false);
          return;
        }

        setAppointment(data);

        // Se já tem QR code válido, mostrar diretamente
        if (data.pixQrCodeImage && data.pixStatus === 'pending') {
          // Verificar se ainda não expirou
          const expiresAt = data.pixExpiresAt?.toDate?.() || new Date();
          if (expiresAt > new Date()) {
            // Manter o que já existe
          }
        }
      } else {
        setError('Agendamento não encontrado');
      }
      setLoading(false);
    }, (err) => {
      console.error('Erro ao buscar agendamento:', err);
      setError('Erro ao carregar agendamento');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleSuccess = () => {
    // Redirecionar para acompanhamento após 2 segundos
    setTimeout(() => {
      navigate('/track');
    }, 2000);
  };

  const handleCancel = () => {
    navigate('/booking');
  };

  // Formatar data
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  // Formatar valor
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-500 text-lg font-medium mb-6">{error}</p>
        <Link
          to="/booking"
          className="px-6 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-colors"
        >
          Voltar ao Agendamento
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="bg-surface border-b border-gray-800 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Pagamento PIX</h1>
            <p className="text-sm text-gray-400">#{appointment?.os || id}</p>
          </div>
        </div>
      </div>

      {/* Resumo do Agendamento */}
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="bg-surface/50 border border-gray-800/50 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-sm mb-4 text-gray-400">Resumo do Agendamento</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-primary" />
              <span className="text-sm">{formatDate(appointment?.date)}</span>
            </div>

            <div className="flex items-center gap-3">
              <Clock size={18} className="text-primary" />
              <span className="text-sm">{appointment?.time || '-'}</span>
            </div>

            <div className="flex items-center gap-3">
              <Car size={18} className="text-primary" />
              <span className="text-sm">
                {appointment?.car || 'Veículo'} - {appointment?.plate || ''}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <DollarSign size={18} className="text-primary" />
              <span className="text-sm">
                Valor total: <span className="font-bold">{formatCurrency(appointment?.totalPrice)}</span>
              </span>
            </div>
          </div>

          {appointment?.services?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Serviços:</p>
              <ul className="space-y-1">
                {appointment.services.map((service, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex justify-between">
                    <span>{service.name}</span>
                    <span className="font-bold">{formatCurrency(service.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Componente de Pagamento PIX */}
        <PixPayment
          appointmentId={id}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />

        {/* Ajuda */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Problemas com o pagamento?
          </p>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline text-sm font-semibold"
          >
            Fale com a gente via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
