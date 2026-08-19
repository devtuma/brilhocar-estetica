import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Shield, X, Lock, Loader2 } from 'lucide-react';

// Componente auxiliar para o Easter Egg
function EasterEggListener({ onTrigger }) {
  useEffect(() => {
    const handler = () => onTrigger();
    window.__adminEasterEgg = handler;
    return () => {
      if (window.__adminEasterEgg === handler) delete window.__adminEasterEgg;
    };
  }, [onTrigger]);
  return null;
}

export default function AdminAccess() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Detectar usuário logado e se é admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', u.uid));
          setIsAdmin(adminDoc.exists() || u.customClaims?.admin === true);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Atalho de teclado secreto: Ctrl + Shift + A
  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (user && isAdmin) {
          navigate('/admin');
        } else if (user) {
          // Usuário logado mas não admin
          setShowLogin(true);
        } else {
          // Não está logado - abre modal
          setShowLogin(true);
        }
      }
      // ESC fecha o modal
      if (e.key === 'Escape') {
        setShowLogin(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [user, isAdmin, navigate]);

  // Easter egg: clicar 5x no logo (chamado pelo App.jsx)
  useEffect(() => {
    let clicks = [];
    const handler = () => {
      if (user && isAdmin) {
        navigate('/admin');
      } else {
        setShowLogin(true);
      }
    };
    
    const handleClick = () => {
      const now = Date.now();
      clicks = clicks.filter(t => now - t < 3000);
      clicks.push(now);
      if (clicks.length >= 5) {
        clicks = [];
        handler();
      }
    };
    
    // Registrar globalmente para ser chamado pelo App.jsx
    window.__adminEasterEgg = handleClick;
    
    // Listener direto no documento para o logo
    document.addEventListener('adminEasterEgg', handleClick);
    
    return () => {
      document.removeEventListener('adminEasterEgg', handleClick);
      if (window.__adminEasterEgg === handleClick) {
        delete window.__adminEasterEgg;
      }
    };
  }, [user, isAdmin, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const adminDoc = await getDoc(doc(db, 'admins', cred.user.uid));
      if (!adminDoc.exists()) {
        await auth.signOut();
        setError('Você não tem permissão de administrador.');
        return;
      }
      setShowLogin(false);
      navigate('/admin');
    } catch (err) {
      setError('Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  // Se for admin, mostra um pequeno chip "Painel" no canto inferior
  if (isAdmin && user) {
    return (
      <Link
        to="/admin"
        className="fixed bottom-20 md:bottom-4 right-4 z-40 bg-primary text-black font-bold px-3 py-2 rounded-full hover:bg-[#00c853] transition-all flex items-center gap-2 shadow-lg text-xs opacity-80 hover:opacity-100"
        title="Painel Admin"
      >
        <Shield size={14} />
        <span className="hidden sm:inline">Painel</span>
      </Link>
    );
  }

  // Não admin: NÃO mostra nada visível (zero pista para usuários comuns)
  // Mas o Easter Egg (Ctrl+Shift+A) continua funcionando para admins
  return (
    <>
      {/* Easter Egg Listener (invisível) */}
      <EasterEggListener onTrigger={() => setShowLogin(true)} />

      {/* Modal de login discreto (só aparece se acionado pelo Easter Egg) */}
      {showLogin && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="bg-surface border border-gray-800 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Lock className="text-primary" size={18} />
                Acesso restrito
              </h3>
              <button
                onClick={() => setShowLogin(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-primary"
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-primary"
                required
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-black font-bold py-2.5 rounded-lg hover:bg-[#00c853] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
