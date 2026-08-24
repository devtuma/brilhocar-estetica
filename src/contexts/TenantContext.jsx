import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  // Modo do tema: 'dark' | 'light' | 'auto'
  // auto = escolhe baseado na luminância da cor primária
  themeMode: 'dark',
  // Cor de texto (calculada automaticamente se auto)
  textColor: '#FFFFFF',
  // Contraste de texto em botões da cor primária
  onPrimaryColor: '#000000',
  contact: {
    email: 'contato@brilhocar.com',
    phone: '(11) 98131-2143',
    whatsapp: '5511981312143',
    address: 'Mauá, SP',
    instagram: '@brilhocar',
  },
};

// Criar contexto
const TenantContext = createContext({
  tenant: DEFAULT_TENANT,
  loading: true,
  effectiveTheme: 'dark', // tema efetivo sendo usado após cálculo
  setCurrentTenant: () => {},
  updateTenant: () => {},
});

// Hook para usar o tenant
export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    console.warn('useTenant usado fora do TenantProvider, usando tenant padrão');
    return { tenant: DEFAULT_TENANT, loading: false, effectiveTheme: 'dark' };
  }
  return context;
};

/**
 * Calcula luminância de uma cor hex (0 = preto, 1 = branco)
 * Fórmula WCAG: https://www.w3.org/TR/WCAG20-TECHS/G18.html
 */
function getLuminance(hex) {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  // Converter para sRGB
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  // Aplicar gamma
  const linearize = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rLin = linearize(rsRGB);
  const gLin = linearize(gsRGB);
  const bLin = linearize(bsRGB);

  // Luminância relativa
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Decide se deve usar tema dark ou light baseado na luminância da cor primária
 * - Cor primária clara → tema dark (fundo escuro destaca a cor)
 * - Cor primária escura → tema light (fundo claro destaca a cor)
 */
function autoSelectTheme(primaryColor) {
  const luminance = getLuminance(primaryColor);
  return luminance > 0.5 ? 'dark' : 'light';
}

function getContrastTextColor(bgColor) {
  const luminance = getLuminance(bgColor);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Provider do tenant
export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT);
  const [effectiveTheme, setEffectiveTheme] = useState('dark');
  const [loading, setLoading] = useState(true);

  // Detectar tenant via:
  // 1. VITE_TENANT_ID do .env
  // 2. Parâmetro de query ?tenant=X
  // 3. Subdomínio
  useEffect(() => {
    const loadTenant = async () => {
      try {
        let tenantId = import.meta.env.VITE_TENANT_ID;

        if (!tenantId) {
          const urlParams = new URLSearchParams(window.location.search);
          tenantId = urlParams.get('tenant');
        }

        if (!tenantId) {
          const hostname = window.location.hostname;
          const parts = hostname.split('.');
          if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'brilhocar') {
            tenantId = parts[0];
          }
        }

        tenantId = tenantId || 'brilhocar';

        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));

        if (tenantDoc.exists()) {
          const tenantData = tenantDoc.data();
          const merged = {
            id: tenantId,
            ...DEFAULT_TENANT,
            ...tenantData,
          };
          setTenant(merged);
          applyTheme(merged);
        } else {
          if (tenantId === 'brilhocar') {
            await setDoc(doc(db, 'tenants', 'brilhocar'), {
              ...DEFAULT_TENANT,
              createdAt: new Date().toISOString(),
              autoCreated: true,
            });
            console.log('Tenant padrão brilhocar criado automaticamente');
            setTenant(DEFAULT_TENANT);
            applyTheme(DEFAULT_TENANT);
          } else {
            console.log(`Tenant "${tenantId}" não encontrado, usando padrão (BrilhoCar)`);
            setTenant(DEFAULT_TENANT);
            applyTheme(DEFAULT_TENANT);
          }
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
    const themeMode = tenantData.themeMode || 'auto';

    // Determinar tema efetivo
    let theme;
    if (themeMode === 'auto') {
      theme = autoSelectTheme(primaryColor);
    } else {
      theme = themeMode;
    }

    setEffectiveTheme(theme);

    // Cores de fundo e texto baseadas no tema
    const colors = theme === 'light'
      ? {
          background: tenantData.backgroundColorLight || '#FFFFFF',
          surface: tenantData.surfaceColorLight || '#F5F5F5',
          text: tenantData.textColorLight || '#0a0a0f',
          textMuted: '#666666',
          border: '#E5E5E5',
        }
      : {
          background: tenantData.backgroundColor || DEFAULT_TENANT.backgroundColor,
          surface: tenantData.surfaceColor || DEFAULT_TENANT.surfaceColor,
          text: tenantData.textColor || '#FFFFFF',
          textMuted: '#999999',
          border: '#333333',
        };

    // Calcular hover (escurecer/clarear 10% baseado no tema)
    const primaryHover = theme === 'light'
      ? lightenColor(primaryColor, -10)
      : darkenColor(primaryColor, 10);

    // Cor de texto em botões da cor primária (contraste automático)
    const onPrimary = getContrastTextColor(primaryColor);

    // Aplicar CSS variables
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-hover', primaryHover);
    root.style.setProperty('--color-on-primary', onPrimary);
    root.style.setProperty('--color-accent', accentColor);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-mode', theme);

    // Atualizar atributo data-theme para CSS condicional
    root.setAttribute('data-theme', theme);

    // Atualizar meta tags
    updateMetaTags(tenantData, theme);
  };

  // Atualizar meta tags com dados do tenant
  const updateMetaTags = (tenantData, theme) => {
    const displayName = tenantData.displayName || DEFAULT_TENANT.displayName;

    document.title = displayName;

    // Atualizar cor do tema do navegador
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      const bg = theme === 'light' ? '#FFFFFF' : '#0a0a0f';
      themeColorMeta.content = bg;
    }

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

  // Salvar tenant no Firestore (será criptografado pela Cloud Function)
  const saveTenant = async (data) => {
    try {
      // Sempre tenta via Cloud Function (criptografa campos sensíveis)
      // Fallback para save direto se Cloud Function falhar
      try {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../firebase');
        const saveFn = httpsCallable(functions, 'saveTenantConfig');
        const result = await saveFn({
          tenantId: tenant.id,
          config: { ...DEFAULT_TENANT, ...data },
        });
        if (result.data?.success) {
          setTenant({ ...tenant, ...result.data.config });
          applyTheme({ ...DEFAULT_TENANT, ...result.data.config });
          return { success: true };
        }
      } catch (fnErr) {
        console.warn('Cloud Function falhou, salvando direto:', fnErr.message);
      }

      // Fallback: salvar direto (não criptografa)
      const { serverTimestamp } = await import('firebase/firestore');
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
      effectiveTheme,
      updateTenant,
      saveTenant,
      setTenant,
      DEFAULT_TENANT
    }}>
      {children}
    </TenantContext.Provider>
  );
}

// Helpers de cor
function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min((num >> 16) + amt, 255);
  const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
  const B = Math.min((num & 0x0000FF) + amt, 255);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default TenantContext;
