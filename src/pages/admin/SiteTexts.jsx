import { useState } from 'react';
import TextEditor from './TextEditor';
import { Globe, Type, Image, Palette } from 'lucide-react';

const TEXT_SECTIONS = [
  {
    key: 'homeHero',
    label: 'Hero (Página Inicial)',
    icon: '🏠',
    description: 'Título principal e subtítulo da página inicial',
    fields: [
      { key: 'title', label: 'Título Principal', type: 'text' },
      { key: 'subtitle', label: 'Subtítulo', type: 'textarea', rows: 2 },
      { key: 'ctaText', label: 'Texto do Botão', type: 'text' }
    ]
  },
  {
    key: 'homeAbout',
    label: 'Sobre Nós',
    icon: '📖',
    description: 'Seção "Sobre" da página inicial',
    fields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'description', label: 'Descrição', type: 'textarea', rows: 4 }
    ]
  },
  {
    key: 'bookingTitle',
    label: 'Página de Agendamento',
    icon: '📅',
    fields: [
      { key: 'bookingTitle', label: 'Título', type: 'text' },
      { key: 'bookingSubtitle', label: 'Subtítulo', type: 'textarea', rows: 2 }
    ]
  },
  {
    key: 'footer',
    label: 'Footer (Rodapé)',
    icon: '📍',
    description: 'Informações de contato no rodapé',
    fields: [
      { key: 'address', label: 'Endereço', type: 'text' },
      { key: 'phone', label: 'Telefone', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp (somente números)', type: 'text' },
      { key: 'instagram', label: 'Instagram (@)', type: 'text' },
      { key: 'facebook', label: 'Facebook', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' }
    ]
  }
];

export default function SiteTexts() {
  const [activeSection, setActiveSection] = useState(TEXT_SECTIONS[0]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Globe size={28} className="text-primary" />
            Textos do Site
          </h1>
          <p className="text-gray-400 mt-1">
            Edite todos os textos visíveis para seus clientes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar de navegação */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-gray-800 rounded-2xl p-4 sticky top-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Seções</h3>
            <div className="space-y-2">
              {TEXT_SECTIONS.map(section => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    activeSection.key === section.key
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'bg-gray-900/50 border border-transparent text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.icon}</span>
                    <span className="font-semibold text-sm">{section.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Área de edição */}
        <div className="lg:col-span-3">
          <div className="bg-surface border border-gray-800 rounded-2xl p-6">
            <div className="mb-6 pb-4 border-b border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{activeSection.icon}</span>
                <h2 className="text-xl font-bold text-white">{activeSection.label}</h2>
              </div>
              {activeSection.description && (
                <p className="text-gray-400 text-sm">{activeSection.description}</p>
              )}
            </div>

            <TextEditor
              sectionKey={activeSection.key}
              fields={activeSection.fields}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
