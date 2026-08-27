import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

/**
 * Toggle de tema visível para TODOS os usuários
 * 3 modos: Claro / Escuro / Auto (segue configuração do tenant)
 *
 * Auto é o padrão - segue o que o admin definiu no Branding
 * Usuário pode forçar Claro ou Escuro (salvo no localStorage)
 */
export default function ThemeToggle({ size = 'md' }) {
  // Modo do usuário: 'light' | 'dark' | 'auto'
  const [userMode, setUserMode] = useState(() => {
    return localStorage.getItem('user-theme-mode') || 'auto';
  });

  const iconSize = size === 'sm' ? 14 : 16;
  const btnSize = size === 'sm' ? 'p-1.5' : 'p-2';

  // Aplicar modo quando muda
  useEffect(() => {
    const root = document.documentElement;
    const attr = root.getAttribute('data-theme');

    if (userMode === 'auto') {
      // Deixa o TenantContext decidir
      // O tema atual já está no data-theme, não mexe
      localStorage.removeItem('user-theme-mode');
    } else {
      // Força o tema escolhido pelo usuário
      root.setAttribute('data-theme', userMode);
      localStorage.setItem('user-theme-mode', userMode);
    }
  }, [userMode]);

  const modes = [
    { key: 'light', icon: Sun, label: 'Claro' },
    { key: 'auto', icon: Monitor, label: 'Auto' },
    { key: 'dark', icon: Moon, label: 'Escuro' },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-xl p-1 border transition-colors"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {modes.map(mode => (
        <button
          key={mode.key}
          onClick={() => setUserMode(mode.key)}
          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
            userMode === mode.key
              ? 'shadow-sm'
              : 'opacity-60 hover:opacity-100'
          }`}
          style={userMode === mode.key ? {
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
          } : {
            color: 'var(--color-text)',
          }}
          title={mode.label}
          aria-label={mode.label}
        >
          <mode.icon size={iconSize} />
        </button>
      ))}
    </div>
  );
}