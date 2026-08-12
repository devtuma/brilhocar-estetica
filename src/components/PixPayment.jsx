import { useState, useEffect, useCallback } from 'react';
import { Copy, CheckCircle, Clock, AlertCircle, QrCode, X } from 'lucide-react';
import { functions } from '../firebase';

export default function PixPayment({ appointmentId, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');

  // Criar pagamento PIX
  const createPayment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const createPixPayment = functions.httpsCallable('createPixPaymentForAppointment');
      const result = await createPixPayment({ appointmentId });

      if (result.data.success) {
        setPaymentData(result.data);

        // Calcular tempo restante
        if (result.data.expiresAt) {
          const expiresAt = new Date(result.data.expiresAt).getTime();
          setTimeLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
        }
      } else {
        setError('Erro ao criar pagamento');
      }
    } catch (err) {
      console.error('Erro ao criar PIX:', err);
      setError(err.message || 'Erro ao criar pagamento PIX');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  // Verificar status do pagamento
  const checkStatus = useCallback(async () => {
    if (!paymentData?.paymentId) return;

    try {
      const checkStatusFn = functions.httpsCallable('checkPixPaymentStatus');
      const result = await checkStatusFn({ paymentId: paymentData.paymentId });

      if (result.data.status === 'paid') {
        setPaymentStatus('paid');
        if (onSuccess) onSuccess();
        return true;
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
    return false;
  }, [paymentData, onSuccess]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setError('Tempo de pagamento expirado');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Polling de status
  useEffect(() => {
    if (paymentStatus === 'paid' || !paymentData?.paymentId) return;

    const interval = setInterval(async () => {
      const isPaid = await checkStatus();
      if (!isPaid) {
        setPaymentStatus('pending');
      }
    }, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [paymentData, paymentStatus, checkStatus]);

  // Criar pagamento ao montar
  useEffect(() => {
    createPayment();
  }, [createPayment]);

  // Copiar código PIX
  const copyPixCode = () => {
    if (paymentData?.payload) {
      navigator.clipboard.writeText(paymentData.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Formatar tempo
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-gray-400 text-lg font-medium">Gerando QR Code PIX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
        <p className="text-red-500 text-lg font-medium mb-4">{error}</p>
        <button
          onClick={createPayment}
          className="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (paymentStatus === 'paid') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-green-500 mb-2">Pagamento Confirmado!</h3>
        <p className="text-gray-400 mb-6">Seu agendamento foi confirmado com sucesso.</p>
        <p className="text-sm text-gray-500">Você será redirecionado em instantes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Timer */}
      {timeLeft !== null && (
        <div className={`flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-xl ${
          timeLeft < 300 ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'
        }`}>
          <Clock size={20} />
          <span className="font-bold text-lg">
            {timeLeft > 0 ? `Expira em ${formatTime(timeLeft)}` : 'Expirado'}
          </span>
        </div>
      )}

      {/* QR Code */}
      {paymentData?.qrCode && (
        <div className="bg-white rounded-3xl p-6 mb-6 flex justify-center">
          <img
            src={`data:image/png;base64,${paymentData.qrCode}`}
            alt="QR Code PIX"
            className="w-64 h-64"
          />
        </div>
      )}

      {/* Valor */}
      <div className="bg-surface border border-gray-800 rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-400 text-sm mb-1">Valor do sinal</p>
        <p className="text-4xl font-black text-primary">
          {formatCurrency(paymentData?.pixAmount)}
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Pague o valor exato acima para confirmar seu agendamento
        </p>
      </div>

      {/* Código PIX */}
      {paymentData?.payload && (
        <div className="bg-surface border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-primary" />
              <span className="font-bold text-sm">Código PIX</span>
            </div>
            <button
              onClick={copyPixCode}
              className={`flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle size={16} />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copiar
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl p-3 font-mono text-xs text-gray-400 break-all select-all">
            {paymentData.payload}
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="bg-surface/50 border border-gray-800/50 rounded-2xl p-5 mb-6">
        <h4 className="font-bold text-sm mb-3">Como pagar:</h4>
        <ol className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <span>Abra o app do seu banco</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span>Escolha pagar via PIX</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span>Escaneie o QR Code ou cole o código</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>Confirme o pagamento</span>
          </li>
        </ol>
      </div>

      {/* Botões */}
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-4 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <X size={20} />
          Cancelar
        </button>

        <button
          onClick={checkStatus}
          className="flex-1 px-6 py-4 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle size={20} />
          Já paguei
        </button>
      </div>
    </div>
  );
}
