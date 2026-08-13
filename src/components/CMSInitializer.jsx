import { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getDefaultConfig } from '../hooks/useConfig';

const DEFAULT_BUSINESS_HOURS = {
  monday: { open: '08:00', close: '18:00', active: true },
  tuesday: { open: '08:00', close: '18:00', active: true },
  wednesday: { open: '08:00', close: '18:00', active: true },
  thursday: { open: '08:00', close: '18:00', active: true },
  friday: { open: '08:00', close: '18:00', active: true },
  saturday: { open: '08:00', close: '14:00', active: true },
  sunday: { open: '08:00', close: '18:00', active: false },
};

/**
 * Hook para inicializar configuração do CMS
 * Chama automaticamente quando necessário
 */
export function useInitConfig() {
  const [initializing, setInitializing] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initConfig = async () => {
      try {
        const configRef = doc(db, 'config', 'main');
        const configSnap = await getDoc(configRef);

        if (!configSnap.exists()) {
          // Criar config inicial com valores padrão
          const defaultConfig = getDefaultConfig();
          defaultConfig.updatedAt = serverTimestamp();
          defaultConfig.updatedBy = 'system';

          await setDoc(configRef, defaultConfig);
          console.log('✅ Configuração inicial do CMS criada');
        } else {
          // Verificar se businessHours já existe, se não, criar
          const data = configSnap.data();
          if (!data.businessHours) {
            await updateDoc(configRef, {
              businessHours: DEFAULT_BUSINESS_HOURS,
              updatedAt: serverTimestamp(),
              updatedBy: 'system'
            });
            console.log('✅ businessHours adicionados à config existente');
          }
        }

        setInitialized(true);
      } catch (err) {
        console.error('Erro ao inicializar config:', err);
        setError(err);
      } finally {
        setInitializing(false);
      }
    };

    initConfig();
  }, []);

  return { initializing, initialized, error };
}

/**
 * Componente que inicializa o CMS silenciosamente
 * Usar uma vez no App.jsx
 */
export default function CMSInitializer({ children }) {
  const { initializing } = useInitConfig();

  if (initializing) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Inicializando...</p>
        </div>
      </div>
    );
  }

  return children;
}
