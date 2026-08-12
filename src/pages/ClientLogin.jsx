import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, celularToEmail } from '../firebase';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Phone, Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import GoogleButton from '../components/GoogleButton';

const formatPhone = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const getErrorMessage = (code) => {
  const errors = {
    'auth/invalid-credential': 'Email ou senha incorretos.',
    'auth/user-not-found': 'Usuário não encontrado. Cadastre-se primeiro.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'Email inválido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/internal-error': 'Erro no servidor. Tente novamente.',
  };
  return errors[code] || 'Erro ao fazer login. Tente novamente.';
};

export default function ClientLogin() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const navigate = useNavigate();

  const [loginType, setLoginType] = useState('celular'); // 'celular' | 'email'
  const [celular, setCelular] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState('');

  const isCelularValid = celular.replace(/\D/g, '').length >= 10;
  const isEmailValid = email.includes('@') && email.includes('.');
  const isPasswordValid = password.length >= 6;

  const handleCelularLogin = async (e) => {
    e.preventDefault();
    setError('');
    setGoogleError('');

    if (!isCelularValid || !isPasswordValid) {
      setError('Preencha todos os campos corretamente.');
      return;
    }

    setLoading(true);

    const cleanedCelular = celular.replace(/\D/g, '');
    const authEmail = celularToEmail(cleanedCelular);

    try {
      await signInWithEmailAndPassword(auth, authEmail, password);
      navigate(returnTo);
    } catch (err) {
      console.error('Erro login celular:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setGoogleError('');

    if (!isEmailValid || !isPasswordValid) {
      setError('Preencha todos os campos corretamente.');
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      navigate(returnTo);
    } catch (err) {
      console.error('Erro login email:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = () => {
    navigate(returnTo);
  };

  const handleGoogleError = (message) => {
    setGoogleError(message);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
            {loginType === 'celular' ? <Phone size={32} /> : <Mail size={32} />}
          </div>
          <h2 className="text-2xl font-black text-white">Fazer Login</h2>
          <p className="text-gray-400 mt-2 text-sm font-medium">
            Acesse sua conta BrilhoCar
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm font-semibold text-center">
            {error}
          </div>
        )}

        {googleError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm font-semibold text-center">
            {googleError}
          </div>
        )}

        {/* Google Button */}
        <div className="mb-6 relative z-10">
          <GoogleButton
            returnTo={returnTo}
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
          />
        </div>

        {/* Divisor */}
        <div className="relative z-10 mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-surface text-gray-500">ou continue com</span>
          </div>
        </div>

        {/* Toggle Celular / Email */}
        <div className="flex gap-2 mb-6 relative z-10">
          <button
            type="button"
            onClick={() => { setLoginType('celular'); setError(''); }}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              loginType === 'celular'
                ? 'bg-primary text-black'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Phone size={16} className="inline mr-2" />
            Celular
          </button>
          <button
            type="button"
            onClick={() => { setLoginType('email'); setError(''); }}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              loginType === 'email'
                ? 'bg-primary text-black'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Mail size={16} className="inline mr-2" />
            Email
          </button>
        </div>

        {/* Formulário */}
        <form
          onSubmit={loginType === 'celular' ? handleCelularLogin : handleEmailLogin}
          className="space-y-4 relative z-10"
        >
          {loginType === 'celular' ? (
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2">Celular com DDD</label>
              <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
                <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                  +55
                </span>
                <input
                  type="tel"
                  required
                  value={celular}
                  onChange={(e) => setCelular(formatPhone(e.target.value))}
                  className="flex-1 bg-transparent px-4 py-4 text-white font-bold text-lg focus:outline-none"
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2">Email</label>
              <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
                <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-4 text-white font-bold focus:outline-none"
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Senha</label>
            <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
              <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent px-4 py-4 text-white font-bold focus:outline-none"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid || (loginType === 'celular' ? !isCelularValid : !isEmailValid)}
            className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.4)] hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Entrar'}
            {!loading && <ArrowRight size={20} />}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-semibold mt-4">
            <ShieldCheck size={14} className="text-primary" />
            Seus dados estão 100% seguros conosco.
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Não tem conta?{' '}
            <Link to="/signup" className="text-primary font-bold hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
