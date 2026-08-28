import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  themeMode: 'dark',
  textColor: '#FFFFFF',
  onPrimaryColor: '#000000',
  contact: {
    email: 'contato@brilhocar.com',
    phone: '(11) 98131-2143',
    whatsapp: '5511981312143',
    address: 'Mauá, SP',
    instagram: '@brilhocar',
  },
};

const TenantContext = createContext({
  tenant: DEFAULT_TENANT,
  loading: true,
  effectiveTheme: 'dark',
  setCurrentTenant: () => {},
  updateTenant: () => {},
  setUserThemeMode: () => {},
});

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    console.warn('useTenant usado fora do TenantProvider, usando tenant padrão');
    return { tenant: DEFAULT_TENANT, loading: false, effectiveTheme: 'dark' };
  }
  return context;
};

// ============================================================
// Funções auxiliares de cor (puras, executam em qualquer momento)
// ============================================================

function getLuminance(hex) {
  const cleanHex = (hex || '#000000').replace('#', '');
  const num = parseInt(cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;
  const linearize = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * linearize(rsRGB) + 0.7152 * linearize(gsRGB) + 0.0722 * linearize(bsRGB);
}

function autoSelectTheme(primaryColor) {
  return getLuminance(primaryColor) > 0.5 ? 'dark' : 'light';
}

function getContrastTextColor(bgColor) {
  return getLuminance(bgColor) > 0.5 ? '#000000' : '#FFFFFF';
}

function darkenColor(hex, percent) {
  const num = parseInt((hex || '#000000').replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max(((num >> 8) & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function lightenColor(hex, percent) {
  const num = parseInt((hex || '#000000').replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min((num >> 16) + amt, 255);
  const G = Math.min(((num >> 8) & 0x00FF) + amt, 255);
  const B = Math.min((num & 0x0000FF) + amt, 255);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ============================================================
// Aplica o tema calculando CSS variables a partir de tenant + modo
// Esta função é PURA e pode ser chamada a qualquer momento
// ============================================================
function applyThemeVars(tenantData, theme) {
  const root = document.documentElement;
  const primaryColor = tenantData.primaryColor || DEFAULT_TENANT.primaryColor;
  const accentColor = tenantData.accentColor || DEFAULT_TENANT.accentColor;

  // Cores de fundo e texto baseadas no tema
  const colors = theme === 'light'
    ? {
        background: tenantData.backgroundColorLight || '#FFFFFF',
        surface: tenantData.surfaceColorLight || '#F5F5F7',
        'surface-elevated': '#FFFFFF',
        text: tenantData.textColorLight || '#1d1d1f',
        textSecondary: '#424245',
        textTertiary: '#6e6e73',
        textMuted: '#86868b',
        border: 'rgba(0, 0, 0, 0.08)',
        'border-strong': 'rgba(0, 0, 0, 0.18)',
        onPrimary: '#FFFFFF',
        success: '#1a7f37',
        danger: '#c5221f',
        warning: '#b45309',
        info: '#007AFF',
        'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.02)',
        'shadow-md': '0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06)',
        'shadow-lg': '0 4px 8px rgba(0, 0, 0, 0.04), 0 12px 24px rgba(0, 0, 0, 0.08)',
        'shadow-xl': '0 8px 16px rgba(0, 0, 0, 0.06), 0 24px 48px rgba(0, 0, 0, 0.1)',
      }
    : {
        background: tenantData.backgroundColor || DEFAULT_TENANT.backgroundColor,
        surface: tenantData.surfaceColor || DEFAULT_TENANT.surfaceColor,
        'surface-elevated': '#1c1c22',
        text: tenantData.textColor || '#FFFFFF',
        textSecondary: 'rgba(255, 255, 255, 0.75)',
        textTertiary: 'rgba(255, 255, 255, 0.55)',
        textMuted: '#9ca3af',
        border: 'rgba(255, 255, 255, 0.1)',
        'border-strong': 'rgba(255, 255, 255, 0.18)',
        onPrimary: tenantData.onPrimaryColor || '#000000',
        success: '#34c759',
        danger: '#ff3b30',
        warning: '#ff9500',
        info: '#5ac8fa',
        'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.5)',
        'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.5)',
        'shadow-xl': '0 16px 48px rgba(0, 0, 0, 0.6)',
      };

  // Hover da cor primária baseado no tema
  const primaryHover = theme === 'light'
    ? darkenColor(primaryColor, 10)  // darken com percent positivo ESCURECE
    : lightenColor(primaryColor, 10); // no dark, hover é um pouco mais claro

  // Cor de texto em botões da cor primária (contraste automático)
  const onPrimary = colors.onPrimary || getContrastTextColor(primaryColor);

  // Aplicar todas as CSS variables
  root.style.setProperty('--color-primary', primaryColor);
  root.style.setProperty('--color-primary-hover', primaryHover);
  root.style.setProperty('--color-on-primary', onPrimary);
  root.style.setProperty('--color-accent', accentColor);
  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-surface-elevated', colors['surface-elevated']);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-secondary', colors.textSecondary);
  root.style.setProperty('--color-text-tertiary', colors.textTertiary);
  root.style.setProperty('--color-text-muted', colors.textMuted);
  root.style.setProperty('--color-border', colors.border);
  root.style.setProperty('--color-border-strong', colors['border-strong']);
  root.style.setProperty('--color-success', colors.success);
  root.style.setProperty('--color-danger', colors.danger);
  root.style.setProperty('--color-warning', colors.warning);
  root.style.setProperty('--color-info', colors.info);
  root.style.setProperty('--shadow-sm', colors['shadow-sm']);
  root.style.setProperty('--shadow-md', colors['shadow-md']);
  root.style.setProperty('--shadow-lg', colors['shadow-lg']);
  root.style.setProperty('--shadow-xl', colors['shadow-xl']);
  root.style.setProperty('--color-mode', theme);

  // Atributo data-theme para CSS condicional
  root.setAttribute('data-theme', theme);

  // Meta theme-color do navegador
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.content = theme === 'light' ? '#FFFFFF' : '#0a0a0f';
  }
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT);
  const [effectiveTheme, setEffectiveTheme] = useState('dark');
  const [loading, setLoading] = useState(true);

  // Calcular tema efetivo com base em tenant + override do usuário
  // Modos do usuário:
  //   'light' / 'dark' → força esse
  //   'auto' → segue prefers-color-scheme do SO; se não tiver, usa tenant.themeMode
  const computeEffectiveTheme = useCallback((tenantData) => {
    const userOverride = localStorage.getItem('user-theme-mode');
    if (userOverride === 'light' || userOverride === 'dark') {
      return userOverride;
    }
    // Auto: preferir esquema do sistema operacional
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      if (prefersLight) return 'light';
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) return 'dark';
    }
    // Fallback: tenant.themeMode → dark/light ou auto via luminance
    const themeMode = tenantData.themeMode || 'auto';
    const primaryColor = tenantData.primaryColor || DEFAULT_TENANT.primaryColor;
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return autoSelectTheme(primaryColor);
  }, []);

  // Ouvir mudanças no esquema de cores do SO (quando user escolhe 'auto')
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Só reaplica se o usuário está em modo 'auto'
      const userOverride = localStorage.getItem('user-theme-mode');
      if (!userOverride || userOverride === 'auto') {
        const theme = computeEffectiveTheme(tenant);
        setEffectiveTheme(theme);
        applyThemeVars(tenant, theme);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [tenant, computeEffectiveTheme]);

  // Detectar tenant via env, query ou subdomínio
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

        let merged;
        if (tenantDoc.exists()) {
          merged = { id: tenantId, ...DEFAULT_TENANT, ...tenantDoc.data() };
        } else if (tenantId === 'brilhocar') {
          await setDoc(doc(db, 'tenants', 'brilhocar'), {
            ...DEFAULT_TENANT,
            createdAt: new Date().toISOString(),
            autoCreated: true,
          });
          merged = { ...DEFAULT_TENANT };
        } else {
          merged = { ...DEFAULT_TENANT };
        }

        setTenant(merged);
        const theme = computeEffectiveTheme(merged);
        setEffectiveTheme(theme);
        applyThemeVars(merged, theme);
        updateMetaTags(merged);
      } catch (err) {
        console.warn('Erro ao carregar tenant, usando padrão:', err);
        const theme = computeEffectiveTheme(DEFAULT_TENANT);
        setEffectiveTheme(theme);
        applyThemeVars(DEFAULT_TENANT, theme);
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, [computeEffectiveTheme]);

  // Função pública para o ThemeToggle chamar
  // Reaplica o tema com base no novo modo do usuário
  const setUserThemeMode = useCallback((mode) => {
    if (mode === 'auto') {
      localStorage.removeItem('user-theme-mode');
    } else {
      localStorage.setItem('user-theme-mode', mode);
    }
    const theme = computeEffectiveTheme(tenant);
    setEffectiveTheme(theme);
    applyThemeVars(tenant, theme);
  }, [tenant, computeEffectiveTheme]);

  const updateMetaTags = (tenantData) => {
    const displayName = tenantData.displayName || DEFAULT_TENANT.displayName;
    document.title = displayName;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = displayName;
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = `${displayName} - Estética Automotiva Premium`;
  };

  const updateTenant = async (newData) => {
    try {
      const updatedTenant = { ...tenant, ...newData };
      setTenant(updatedTenant);
      const theme = computeEffectiveTheme(updatedTenant);
      setEffectiveTheme(theme);
      applyThemeVars(updatedTenant, theme);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar tenant:', err);
      return { success: false, error: err.message };
    }
  };

  const saveTenant = async (data) => {
    try {
      try {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../firebase');
        const saveFn = httpsCallable(functions, 'saveTenantConfig');
        const result = await saveFn({
          tenantId: tenant.id,
          config: { ...DEFAULT_TENANT, ...data },
        });
        if (result.data?.success) {
          const merged = { ...tenant, ...result.data.config };
          setTenant(merged);
          const theme = computeEffectiveTheme(merged);
          setEffectiveTheme(theme);
          applyThemeVars(merged, theme);
          return { success: true };
        }
      } catch (fnErr) {
        console.warn('Cloud Function falhou, salvando direto:', fnErr.message);
      }
      const { serverTimestamp } = await import('firebase/firestore');
      await setDoc(doc(db, 'tenants', tenant.id), {
        ...DEFAULT_TENANT,
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const merged = { ...tenant, ...data };
      setTenant(merged);
      const theme = computeEffectiveTheme(merged);
      setEffectiveTheme(theme);
      applyThemeVars(merged, theme);
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
      setUserThemeMode,
      DEFAULT_TENANT
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export default TenantContext;