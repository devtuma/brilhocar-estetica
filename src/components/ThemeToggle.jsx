import { useState } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { Sun, Moon, Monitor } from 'lucide-react';

/**
 * Toggle de tema visível para TODOS os usuários
 * 3 modos: Claro / Escuro / Auto (segue configuração do tenant)
 *
 * Usa setUserThemeMode do TenantContext que reaplica
 * TODAS as CSS variables + meta tags + data-theme de uma vez.
 * Atualização INSTANTÂNEA sem precisar de F5.
 */
export default function ThemeToggle({ size = 'md' }) {
  const { setUserThemeMode } = useTenant();

  // Lê o estado atual do localStorage para marcar o botão certo
  const [userMode, setUserMode] = useState(() => {
    if (typeof window === 'undefined') return 'auto';
    return localStorage.getItem('user-theme-mode') || 'auto';
  });

  const iconSize = size === 'sm' ? 14 : 16;
  const btnSize = size === 'sm' ? 'p-1.5' : 'p-2';

  const handleMode = (mode) => {
    setUserMode(mode);
    setUserThemeMode(mode); // Reaplica TUDO: CSS vars + data-theme + meta
  };

  const modes = [
    { key: 'light', icon: Sun, label: 'Tema Claro' },
    { key: 'auto', icon: Monitor, label: 'Tema Automático' },
    { key: 'dark', icon: Moon, label: 'Tema Escuro' },
  ];

  return (
    <div
      className={`flex items-center gap-1 rounded-xl p-1 border transition-colors ${btnSize}`}
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
      role="group"
      aria-label="Seletor de tema"
    >
      {modes.map(mode => {
        const Icon = mode.icon;
        const isActive = userMode === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => handleMode(mode.key)}
            className={`rounded-lg transition-all flex items-center justify-center ${size === 'sm' ? 'p-1.5' : 'p-2'} ${
              isActive ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
            }`}
            style={isActive ? {
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            } : {
              color: 'var(--color-text)',
            }}
            title={mode.label}
            aria-label={mode.label}
            aria-pressed={isActive}
          >
            <Icon size={iconSize} />
          </button>
        );
      })}
    </div>
  );
}