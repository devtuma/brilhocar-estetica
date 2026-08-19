import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle, ArrowLeft, Home } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err) {
      setError('Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Botão Voltar para Home */}
      <Link
        to="/"
        className="absolute top-4 left-4 md:top-6 md:left-6 bg-surface border border-gray-800 hover:border-primary/50 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft size={16} />
        <Home size={14} />
        <span>Voltar para Home</span>
      </Link>

      <div className="w-full max-w-md bg-surface border border-gray-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-gray-900 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-black text-white">Acesso Restrito</h2>
          <p className="text-gray-400 mt-2 text-sm">Faça login para acessar o painel BrilhoCar.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-semibold">
            <AlertCircle size={20} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0b0b0f] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="admin@brilhocar.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0b0b0f] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-black font-bold py-4 rounded-xl hover:bg-[#00c853] transition-colors mt-6 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
