import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Tenant padrão (BrilhoCar) - usado quando não há configuração de tenant
const DEFAULT_TENANT = {
  id: 'brilhocar',
  displayName: 'BrilhoCar Estética Automotiva',
  logoText: 'BrilhoCar',
  primaryColor: '#00e676',
  primaryHover: '#00c853',
  accentColor: '#D4AF37',
  backgroundColor: '#0a0a0f',
  surfaceColor: '#151515',
  contact: {
    email: 'contato@brilhocar.com',
    phone: '(11) 98131-2143',
    whatsapp: '5511981312143',
    address: 'Mauá, SP',
    instagram: '@brilhocar',
  },
  pix: {
    AsaasAPIKey: '',
    walletId: '',
    environment: 'production'
  }
};

// Criar contexto
const TenantContext = createContext({
  tenant: DEFAULT_TENANT,
  loading: true,
  setCurrentTenant: () => {},
  updateTenant: () => {},
});

// Hook para usar o tenant
export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    console.warn('useTenant usado fora do TenantProvider, usando tenant padrão');
    return { tenant: DEFAULT_TENANT, loading: false };
  }
  return context;
};

// Provider do tenant
export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT);
  const [loading, setLoading] = useState(true);

  // Detectar tenant via:
  // 1. VITE_TENANT_ID do .env
  // 2. Subdomínio da URL
  // 3. Parâmetro de query ?tenant=X
  useEffect(() => {
    const loadTenant = async () => {
      try {
        // Tentar detectar tenant ID
        let tenantId = import.meta.env.VITE_TENANT_ID;

        // Se não tiver no env, detectar via subdomínio ou query
        if (!tenantId) {
          const urlParams = new URLSearchParams(window.location.search);
          tenantId = urlParams.get('tenant');
        }

        if (!tenantId) {
          // Tentar extrair do hostname (ex: client.brilhocar.com -> client)
          const hostname = window.location.hostname;
          const parts = hostname.split('.');
          if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'brilhocar') {
            tenantId = parts[0];
          }
        }

        // Se não detectar nenhum, usar padrão (brilhocar)
        tenantId = tenantId || 'brilhocar';

        // Buscar configuração do tenant no Firestore
        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));

        if (tenantDoc.exists()) {
          const tenantData = tenantDoc.data();
          setTenant({
            id: tenantId,
            ...DEFAULT_TENANT,
            ...tenantData,
          });
          // Aplicar tema CSS
          applyTheme(tenantData);
        } else {
          console.log(`Tenant "${tenantId}" não encontrado, usando padrão (BrilhoCar)`);
          setTenant(DEFAULT_TENANT);
          applyTheme(DEFAULT_TENANT);
        }
      } catch (err) {
        console.warn('Erro ao carregar tenant, usando padrão:', err);
        setTenant(DEFAULT_TENANT);
        applyTheme(DEFAULT_TENANT);
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, []);

  // Aplicar tema via CSS variables
  const applyTheme = (tenantData) => {
    const root = document.documentElement;

    const primaryColor = tenantData.primaryColor || DEFAULT_TENANT.primaryColor;
    const accentColor = tenantData.accentColor || DEFAULT_TENANT.accentColor;

    // Calcular hover color (escurecer 10%)
    const primaryHover = darkenColor(primaryColor, 10);

    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-hover', primaryHover);
    root.style.setProperty('--color-accent', accentColor);
    root.style.setProperty('--color-background', tenantData.backgroundColor || DEFAULT_TENANT.backgroundColor);
    root.style.setProperty('--color-surface', tenantData.surfaceColor || DEFAULT_TENANT.surfaceColor);

    // Atualizar meta tags
    updateMetaTags(tenantData);
  };

  // Atualizar meta tags com dados do tenant
  const updateMetaTags = (tenantData) => {
    const displayName = tenantData.displayName || DEFAULT_TENANT.displayName;

    document.title = displayName;

    // Atualizar OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = displayName;

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = `${displayName} - Estética Automotiva Premium`;
  };

  // Atualizar dados do tenant (para o painel admin)
  const updateTenant = async (newData) => {
    try {
      const updatedTenant = { ...tenant, ...newData };
      setTenant(updatedTenant);
      applyTheme(updatedTenant);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar tenant:', err);
      return { success: false, error: err.message };
    }
  };

  // Salvar tenant no Firestore
  const saveTenant = async (data) => {
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      await setDoc(doc(db, 'tenants', tenant.id), {
        ...DEFAULT_TENANT,
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setTenant({ ...tenant, ...data });
      applyTheme({ ...DEFAULT_TENANT, ...data });
      return { success: true };
    } catch (err) {
      console.error('Erro ao salvar tenant:', err);
      return { success: false, error: err.message };
    }
  };

  return (
    <TenantContext.Provider value={{
      tenant,
      loading,
      updateTenant,
      saveTenant,
      setTenant,
      DEFAULT_TENANT
    }}>
      {children}
    </TenantContext.Provider>
  );
}

// Helper para escurecer cor hex
function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default TenantContext;
