import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, celularToEmail } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, User, Lock, Loader2, ArrowRight, ShieldCheck, Check, X } from 'lucide-react';

// Regex de validação de senha forte
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{6}$/;

const formatPhone = (value) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, color: 'bg-gray-600', label: '' };

  let score = 0;
  if (password.length >= 6) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score++;

  const levels = [
    { color: 'bg-red-500', label: 'Muito fraca' },
    { color: 'bg-red-500', label: 'Fraca' },
    { color: 'bg-yellow-500', label: 'Regular' },
    { color: 'bg-green-500', label: 'Forte' },
    { color: 'bg-green-600', label: 'Muito forte' },
  ];

  return { score, ...levels[score - 1] || levels[0] };
};

const getErrorMessage = (code) => {
  const errors = {
    'auth/email-already-in-use': 'Este número de celular já está cadastrado.',
    'auth/invalid-email': 'Formato de email inválido.',
    'auth/weak-password': 'A senha precisa ter 6 caracteres.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/internal-error': 'Erro no servidor. Tente novamente.',
  };
  return errors[code] || 'Erro ao criar conta. Tente novamente.';
};

export default function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    celular: '',
    celularConfirm: '',
    name: '',
    password: '',
    passwordConfirm: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const passwordStrength = getPasswordStrength(formData.password);

  const validateForm = () => {
    const cleanedCelular = formData.celular.replace(/\D/g, '');

    if (cleanedCelular.length < 10 || cleanedCelular.length > 11) {
      setError('Digite um número válido com DDD (10 ou 11 dígitos).');
      return false;
    }

    if (formData.celular !== formData.celularConfirm) {
      setError('Os números de celular não coincidem.');
      return false;
    }

    if (!formData.name.trim()) {
      setError('Digite seu nome.');
      return false;
    }

    if (!PASSWORD_REGEX.test(formData.password)) {
      setError('A senha deve ter 6 caracteres, incluindo: 1 maiúscula, 1 minúscula, 1 número e 1 especial (!@#$%^&*).');
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('As senhas não coincidem.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateForm()) return;

    setLoading(true);

    const cleanedCelular = formData.celular.replace(/\D/g, '');
    const email = celularToEmail(cleanedCelular);

    try {
      // 1. Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);

      // 2. Atualizar nome do usuário
      await updateProfile(userCredential.user, {
        displayName: formData.name.trim()
      });

      // 3. Salvar dados no Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        celular: `+55${cleanedCelular}`,
        celularLimpo: cleanedCelular,
        name: formData.name.trim(),
        email: null,
        passwordSet: true,
        hasGoogleAuth: false,
        createdAt: serverTimestamp(),
        lastAccess: serverTimestamp()
      });

      setSuccessMessage('Conta criada com sucesso!');
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (err) {
      console.error('Erro no cadastro:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
            <User size={32} />
          </div>
          <h2 className="text-2xl font-black text-white">Criar Conta</h2>
          <p className="text-gray-400 mt-2 text-sm font-medium">
            Cadastre-se com seu celular e senha
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

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {/* Celular */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Celular com DDD</label>
            <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
              <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                +55
              </span>
              <input
                type="tel"
                required
                value={formData.celular}
                onChange={(e) => setFormData({ ...formData, celular: formatPhone(e.target.value) })}
                className="flex-1 bg-transparent px-4 py-4 text-white font-bold text-lg focus:outline-none"
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Confirmar Celular */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Confirmar Celular</label>
            <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
              <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                +55
              </span>
              <input
                type="tel"
                required
                value={formData.celularConfirm}
                onChange={(e) => setFormData({ ...formData, celularConfirm: formatPhone(e.target.value) })}
                className="flex-1 bg-transparent px-4 py-4 text-white font-bold text-lg focus:outline-none"
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
            </div>
            {formData.celularConfirm && formData.celular !== formData.celularConfirm && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <X size={12} /> Números não coincidem
              </p>
            )}
            {formData.celularConfirm && formData.celular === formData.celularConfirm && formData.celular.length >= 10 && (
              <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                <Check size={12} /> Números coincidem
              </p>
            )}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Nome Completo</label>
            <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
              <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="flex-1 bg-transparent px-4 py-4 text-white font-bold focus:outline-none"
                placeholder="Seu nome completo"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Senha</label>
            <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
              <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="flex-1 bg-transparent px-4 py-4 text-white font-bold focus:outline-none"
                placeholder="6 caracteres"
                maxLength={6}
              />
            </div>
            {/* Indicador de força da senha */}
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= passwordStrength.score ? passwordStrength.color : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${passwordStrength.score >= 4 ? 'text-green-500' : 'text-gray-500'}`}>
                  {passwordStrength.label}
                </p>
              </div>
            )}
            {/* Requisitos */}
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <p className={/[a-z]/.test(formData.password) ? 'text-green-500' : 'text-gray-600'}>
                {/[a-z]/.test(formData.password) ? '✓' : '○'} 1 minúscula
              </p>
              <p className={/[A-Z]/.test(formData.password) ? 'text-green-500' : 'text-gray-600'}>
                {/[A-Z]/.test(formData.password) ? '✓' : '○'} 1 maiúscula
              </p>
              <p className={/\d/.test(formData.password) ? 'text-green-500' : 'text-gray-600'}>
                {/\d/.test(formData.password) ? '✓' : '○'} 1 número
              </p>
              <p className={/[!@#$%^&*]/.test(formData.password) ? 'text-green-500' : 'text-gray-600'}>
                {/[!@#$%^&*]/.test(formData.password) ? '✓' : '○'} 1 especial
              </p>
            </div>
          </div>

          {/* Confirmar Senha */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Confirmar Senha</label>
            <div className="flex items-center bg-[#0b0b0f] border border-gray-800 rounded-xl overflow-hidden focus-within:border-primary transition-colors">
              <span className="px-4 py-4 text-gray-500 font-bold border-r border-gray-800 bg-gray-900/50">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={formData.passwordConfirm}
                onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                className="flex-1 bg-transparent px-4 py-4 text-white font-bold focus:outline-none"
                placeholder="Repita a senha"
                maxLength={6}
              />
            </div>
            {formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <X size={12} /> Senhas não coincidem
              </p>
            )}
            {formData.passwordConfirm && formData.password === formData.passwordConfirm && formData.password.length >= 6 && (
              <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                <Check size={12} /> Senhas coincidem
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.4)] hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Criar Conta'}
            {!loading && <ArrowRight size={20} />}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-semibold mt-4">
            <ShieldCheck size={14} className="text-primary" />
            Seus dados estão 100% seguros conosco.
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Já tem conta?{' '}
            <Link to="/client-login" className="text-primary font-bold hover:underline">
              Fazer Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
