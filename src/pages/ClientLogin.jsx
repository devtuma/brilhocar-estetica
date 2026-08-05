import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

export default function ClientLogin() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    // Inicializa o reCAPTCHA invisível
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
          // reCAPTCHA solved
        }
      });
    }
  }, []);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Formata o número para o padrão E.164 (Brasil +55)
    // Remove tudo que não for número
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      setError('Digite um número válido com DDD.');
      setLoading(false);
      return;
    }

    const formattedNumber = `+55${cleanNumber}`;

    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep(2);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-phone-number') {
        setError('Número de telefone inválido.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Erro ao enviar SMS. Tente novamente.');
      }
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
      // Login com sucesso!
      navigate(returnTo);
    } catch (err) {
      console.error(err);
      setError('Código inválido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
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
              ? 'Agendamento super rápido em menos de 1 minuto! Sem necessidade de criar senhas difíceis.' 
              : 'Enviamos um SMS com 6 dígitos para o seu celular.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm font-semibold text-center">
            {error}
          </div>
        )}

        <div id="recaptcha-container"></div>

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-6 relative z-10">
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2">WhatsApp com DDD</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-[#0b0b0f] border border-gray-800 rounded-xl px-4 py-4 text-white font-bold text-lg focus:outline-none focus:border-primary transition-colors text-center"
                placeholder="(11) 99999-9999"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.4)] hover:-translate-y-1"
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
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#0b0b0f] border border-gray-800 rounded-xl px-4 py-4 text-white font-black text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-primary transition-colors"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Confirmar e Acessar'}
            </button>
            
            <button 
              type="button" 
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-gray-400 font-semibold hover:text-white transition-colors mt-2"
            >
              Voltar e corrigir número
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
