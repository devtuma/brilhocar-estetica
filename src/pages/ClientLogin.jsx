import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Lock, Loader2, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

const formatPhone = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const getErrorMessage = (code) => {
  const errors = {
    'auth/invalid-phone-number': 'Número de telefone inválido. Verifique o DDD e o número.',
    'auth/missing-phone-number': 'Digite um número de telefone.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/captcha-check-failed': 'Verificação de segurança falhou. Recarregue a página.',
    'auth/quota-exceeded': 'Cota de SMS excedida. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/internal-error': 'Erro no servidor. Tente novamente.',
  };
  return errors[code] || 'Erro ao enviar SMS. Tente novamente.';
};

export default function ClientLogin() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [step, setStep] = useState(1);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': () => {},
          'expired-callback': () => {
            setError('Verificação expirou. Tente novamente.');
          }
        });
      } catch (err) {
        console.warn('Falha ao criar reCAPTCHA:', err);
      }
    }

    return () => {
      if (window.recaptchaVerifier && step === 1) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
      }
    };
  }, [step]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 11) {
      setError('Digite um número válido com DDD (10 ou 11 dígitos).');
      setLoading(false);
      return;
    }

    const formattedNumber = `+55${cleanNumber}`;

    try {
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) {
        setError('Sistema de verificação não carregou. Recarregue a página.');
        setLoading(false);
        return;
      }

      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep(2);
      setSuccessMessage(`SMS enviado para +55 ${cleanNumber.slice(0, 2)} ${cleanNumber.slice(2)}`);
      setResendTimer(60);
    } catch (err) {
      console.error('Erro Phone Auth:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = `+55${cleanNumber}`;

    try {
      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setResendTimer(60);
      setSuccessMessage('SMS reenviado!');
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmationResult.confirm(verificationCode);
      navigate(returnTo);
    } catch (err) {
      console.error('Erro verificação:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Código inválido. Verifique o SMS recebido.');
      } else if (err.code === 'auth/code-expired') {
        setError('Código expirado. Solicite um novo.');
      } else {
        setError('Erro ao verificar código. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep(1);
    setError('');
    setSuccessMessage('');
    setVerificationCode('');
    setConfirmationResult(null);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
            {step === 1 ? <Phone size={32} /> : <Lock size={32} />}
          </div>
          <h2 className="text-2xl font-black text-white">
            {step === 1 ? 'Acesso Rápido' : 'Confirme seu Código'}
          </h2>
          <p className="text-gray-400 mt-2 text-sm font-medium">
            {step === 1
              ? 'Agendamento super rápido em menos de 1 minuto! Sem senhas.'
              : 'Enviamos um SMS com 6 dígitos para o seu celular.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm font-semibold text-center">
            {error}
          </div>
        )}

        {successMessage && !error && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl mb-6 text-sm font-semibold text-center">
            {successMessage}
          </div>
        )}

        <div id="recaptcha-container"></div>

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-6 relative z-10">
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2">WhatsApp com DDD</label>
              <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
                <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                  +55
                </span>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                  className="flex-1 bg-transparent px-4 py-4 text-white font-bold text-lg focus:outline-none"
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Você receberá um código de 6 dígitos por SMS
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.4)] hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Receber Código SMS'}
              {!loading && <ArrowRight size={20} />}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-semibold mt-4">
              <ShieldCheck size={14} className="text-primary"/>
              Seus dados estão 100% seguros conosco.
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-6 relative z-10">
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2 text-center">Código de 6 dígitos</label>
              <input
                type="text"
                required
                maxLength="6"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-[#0b0b0f] border border-gray-800 rounded-xl px-4 py-4 text-white font-black text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-primary transition-colors"
                placeholder="000000"
                inputMode="numeric"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Olhe a mensagem de texto do número +1 415-523-8886
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Confirmar e Acessar'}
            </button>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendTimer > 0 || loading}
                className="w-full text-center text-sm text-gray-400 font-semibold hover:text-white transition-colors disabled:opacity-50 disabled:hover:text-gray-400 flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                {resendTimer > 0 ? `Reenviar em ${resendTimer}s` : 'Reenviar código'}
              </button>
              <button
                type="button"
                onClick={handleChangeNumber}
                className="w-full text-center text-sm text-gray-400 font-semibold hover:text-white transition-colors"
              >
                Trocar de número
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
