import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Ícone SVG do Google
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function GoogleButton({ returnTo = '/', onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);

    try {
      // 1. Sign in com Google popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 2. Verificar se já existe documento no Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // Usuário já existe - apenas atualizar lastAccess
        await setDoc(userRef, {
          lastAccess: serverTimestamp(),
          hasGoogleAuth: true
        }, { merge: true });
      } else {
        // Novo usuário Google - criar documento
        await setDoc(userRef, {
          uid: user.uid,
          celular: null,
          celularLimpo: null,
          email: user.email,
          name: user.displayName || 'Cliente',
          passwordSet: false,
          hasGoogleAuth: true,
          createdAt: serverTimestamp(),
          lastAccess: serverTimestamp()
        });
      }

      if (onSuccess) {
        onSuccess(user);
      } else {
        navigate(returnTo);
      }

    } catch (error) {
      console.error('Erro Google Sign In:', error);

      // Tratar erros específicos
      let errorMessage = 'Erro ao fazer login com Google.';

      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = '';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Já existe uma conta com este email usando outro método de login.';
      }

      if (onError && errorMessage) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
      className="w-full bg-white text-gray-800 font-bold py-4 rounded-xl hover:bg-gray-100 transition-all duration-300 flex justify-center items-center gap-3 border border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="animate-spin" size={24} />
      ) : (
        <>
          <GoogleIcon />
          <span>Entrar com Google</span>
        </>
      )}
    </button>
  );
}
