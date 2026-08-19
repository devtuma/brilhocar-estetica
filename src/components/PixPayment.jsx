import { useState, useEffect, useCallback } from 'react';
import { Copy, CheckCircle, Clock, AlertCircle, QrCode, X, RefreshCw, Download } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export default function PixPayment({ appointmentId, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [manualMode, setManualMode] = useState(false);

  // Criar pagamento PIX
  const createPayment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const createPixPayment = httpsCallable(functions, 'createPixPaymentForAppointment');
      const result = await createPixPayment({ appointmentId });

      if (result.data.success) {
        setPaymentData(result.data);
        setManualMode(false);

        // Calcular tempo restante
        if (result.data.expiresAt) {
          const expiresAt = new Date(result.data.expiresAt).getTime();
          const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
          setTimeLeft(remaining);
        }
      } else {
        setError(result.data.error || 'Erro ao criar pagamento');
      }
    } catch (err) {
      console.error('Erro ao criar PIX:', err);
      let errorMsg = err.message || 'Erro ao criar pagamento PIX';
      if (errorMsg.includes('CPF')) {
        errorMsg = 'Dados do cliente incompletos. CPF necessario para pagamento PIX.';
      } else if (errorMsg.includes('API')) {
        errorMsg = 'Erro de comunicacao com o gateway de pagamento. Tente novamente.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  // Verificar status do pagamento
  const checkStatus = useCallback(async () => {
    if (!paymentData?.paymentId) return;

    try {
      const checkStatusFn = httpsCallable(functions, 'checkPixPaymentStatus');
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
          setError('Tempo de pagamento expirado. Clique em Gerar Novamente abaixo.');
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
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentData, paymentStatus, checkStatus]);

  // Criar pagamento ao montar
  useEffect(() => {
    createPayment();
  }, [createPayment]);

  // Copiar codigo PIX
  const copyPixCode = () => {
    if (paymentData?.payload) {
      navigator.clipboard.writeText(paymentData.payload).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Erro ao copiar:', err);
        const textArea = document.createElement('textarea');
        textArea.value = paymentData.payload;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
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

  // Baixar QR Code PIX como imagem PNG
  const downloadPixQrCode = async () => {
    if (!paymentData?.qrCode) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 700;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 50, 500, 500);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAGAMENTO PIX', 300, 595);
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`R$ ${formatCurrency(paymentData.pixAmount || paymentData.amount)}`, 300, 630);
        ctx.font = 'italic 14px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('BrilhoCar Estética Automotiva', 300, 665);
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `PIX-BrilhoCar-${formatCurrency(paymentData.pixAmount || paymentData.amount)}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      img.src = paymentData.qrCode.startsWith('data:')
        ? paymentData.qrCode
        : `data:image/png;base64,${paymentData.qrCode}`;
    } catch (err) {
      console.error('Erro ao baixar QR:', err);
    }
  };

  // Verificar se esta usando sandbox
  const isSandbox = window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('vercel');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-gray-400 text-lg font-medium">Gerando QR Code PIX...</p>
        <p className="text-gray-500 text-sm mt-2">Aguarde um momento</p>
      </div>
    );
  }

  if (error && !paymentData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
        <p className="text-red-500 text-lg font-medium mb-2 text-center">{error}</p>
        <p className="text-gray-400 text-sm mb-6 text-center">
          Se o problema persistir, entre em contato pelo WhatsApp.
        </p>
        <div className="flex gap-3">
          <button
            onClick={createPayment}
            className="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Tentar Novamente
          </button>
          <a
            href="https://wa.me/5511981312143"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            Falar no WhatsApp
          </a>
        </div>
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
        <p className="text-sm text-gray-500">Voce sera redirecionado em instantes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Aviso de sandbox */}
      {isSandbox && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm font-semibold flex items-center gap-2">
            <AlertCircle size={18} />
            Modo de Teste (Sandbox)
          </p>
          <p className="text-yellow-300/80 text-xs mt-1">
            Este e um ambiente de testes. Pagamentos nao sao reais.
          </p>
        </div>
      )}

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
      {paymentData?.qrCode && !manualMode && (
        <div className="bg-white rounded-3xl p-6 mb-4 flex justify-center">
          <div className="relative">
            <img
              src={paymentData.qrCode.startsWith('data:')
                ? paymentData.qrCode
                : `data:image/png;base64,${paymentData.qrCode}`}
              alt="QR Code PIX"
              className="w-64 h-64"
              onError={() => {
                console.error('Erro ao carregar QR code');
                setManualMode(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Botao de Download do QR Code PIX */}
      {paymentData?.qrCode && !manualMode && (
        <button
          onClick={downloadPixQrCode}
          className="w-full mb-6 px-6 py-3 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Download size={16} />
          Baixar QR Code PIX (imagem)
        </button>
      )}

      {/* Modo manual (se QR code falhar) */}
      {manualMode && paymentData?.payload && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm font-semibold mb-2">QR Code nao carregou</p>
          <p className="text-yellow-300/80 text-xs mb-3">
            Copie o codigo abaixo e cole no app do banco:
          </p>
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 break-all">
            {paymentData.payload}
          </div>
        </div>
      )}

      {/* Valor */}
      <div className="bg-surface border border-gray-800 rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-400 text-sm mb-1">Valor do sinal</p>
        <p className="text-4xl font-black text-primary">
          {formatCurrency(paymentData?.pixAmount || paymentData?.amount)}
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Pague o valor exato acima para confirmar seu agendamento
        </p>
      </div>

      {/* Codigo PIX (copiar e colar) */}
      {paymentData?.payload && (
        <div className="bg-surface border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-primary" />
              <span className="font-bold text-sm">Codigo PIX (copia e cola)</span>
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

          <div className="bg-gray-900 rounded-xl p-3 font-mono text-xs text-gray-400 break-all select-all max-h-24 overflow-y-auto">
            {paymentData.payload}
          </div>

          <p className="text-gray-500 text-xs mt-3">
            - Abra o app do banco<br/>
            - Escolha "Pix" e depois "Pagar com Pix copia e cola"<br/>
            - Cole o codigo acima e confirme
          </p>
        </div>
      )}

      {/* Instrucoes */}
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
            <span>Escaneie o QR Code ou cole o codigo</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>Confirme o pagamento de <strong className="text-white">{formatCurrency(paymentData?.pixAmount || paymentData?.amount)}</strong></span>
          </li>
        </ol>
      </div>

      {/* Botoes */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <X size={20} />
            Cancelar
          </button>

          <button
            onClick={checkStatus}
            disabled={!paymentData?.paymentId}
            className="flex-1 px-6 py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle size={20} />
            Ja paguei
          </button>
        </div>

        <button
          onClick={createPayment}
          className="w-full px-6 py-3 bg-gray-800 text-gray-400 font-semibold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw size={16} />
          Gerar novo QR Code
        </button>

        {/* BOTAO DE TESTE - REMOVER EM PRODUCAO */}
        <button
          onClick={async () => {
            if (!paymentData?.paymentId) return;
            if (!confirm('Simular pagamento confirmado via webhook?')) return;
            try {
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('../firebase');
              const simulateWebhook = httpsCallable(functions, 'simulatePaymentConfirmed');
              await simulateWebhook({ paymentId: paymentData.paymentId, appointmentId });
              alert('Simulação enviada! Verifique se o redirecionamento funcionou.');
            } catch (err) {
              console.error('Erro na simulação:', err);
              alert('Erro ao simular: ' + err.message);
            }
          }}
          className="w-full px-6 py-3 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-semibold rounded-xl hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          🧪 SIMULAR PAGAMENTO (TESTE)
        </button>
      </div>

      {/* Ajuda */}
      <div className="mt-6 pt-6 border-t border-gray-800 text-center">
        <p className="text-sm text-gray-500 mb-3">Problemas com o pagamento?</p>
        <a
          href="https://wa.me/5511981312143"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-semibold"
        >
          Falar com a BrilhoCar via WhatsApp
        </a>
      </div>
    </div>
  );
}
