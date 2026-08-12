import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Gift, Calendar, Percent, Eye, EyeOff, Trash2, Plus, Save, Loader2 } from 'lucide-react';

const PROMOTION_TEMPLATES = [
  {
    id: 'black-friday',
    name: 'Black Friday',
    emoji: '🔥',
    colors: { bg: '#000000', text: '#ffffff', accent: '#ff0000' },
    defaultDiscount: 30,
    description: 'Maior evento de descontos do ano'
  },
  {
    id: 'natal',
    name: 'Natal',
    emoji: '🎄',
    colors: { bg: '#c41e3a', text: '#ffffff', accent: '#ffd700' },
    defaultDiscount: 25,
    description: 'Promoção de fim de ano'
  },
  {
    id: 'ano-novo',
    name: 'Ano Novo',
    emoji: '🎉',
    colors: { bg: '#1a1a2e', text: '#ffd700', accent: '#c0c0c0' },
    defaultDiscount: 20,
    description: 'Comece o ano novo com o carro brilhando'
  },
  {
    id: 'dia-dos-pais',
    name: 'Dia dos Pais',
    emoji: '🎁',
    colors: { bg: '#2563eb', text: '#ffffff', accent: '#fbbf24' },
    defaultDiscount: 15,
    description: 'Presenteie seu pai com um carro impecável'
  },
  {
    id: 'dia-das-maes',
    name: 'Dia das Mães',
    emoji: '🌷',
    colors: { bg: '#ec4899', text: '#ffffff', accent: '#f472b6' },
    defaultDiscount: 15,
    description: 'Mães merecem o melhor'
  },
  {
    id: 'pascoa',
    name: 'Páscoa',
    emoji: '🐰',
    colors: { bg: '#fef3c7', text: '#78350f', accent: '#f59e0b' },
    defaultDiscount: 20,
    description: 'Páscoa com muito brilho'
  },
  {
    id: 'custom',
    name: 'Personalizada',
    emoji: '✨',
    colors: { bg: '#6366f1', text: '#ffffff', accent: '#a855f7' },
    defaultDiscount: 10,
    description: 'Crie sua própria promoção'
  }
];

export default function Promotions() {
  const [promotion, setPromotion] = useState({
    enabled: false,
    name: '',
    bannerText: '',
    discount: 20,
    startDate: '',
    endDate: '',
    services: 'all',
    customBg: '#6366f1',
    customText: '#ffffff'
  });
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Carregar promoção atual
  useState(() => {
    const loadPromotion = async () => {
      try {
        const { getDoc } = await import('firebase/firestore');
        const configRef = doc(db, 'config', 'main');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists() && configSnap.data().activePromotion) {
          setPromotion(configSnap.data().activePromotion);
        }
      } catch (err) {
        console.error('Erro ao carregar promoção:', err);
      }
    };
    loadPromotion();
  }, []);

  const applyTemplate = (template) => {
    setSelectedTemplate(template.id);
    setPromotion(prev => ({
      ...prev,
      name: template.name,
      discount: template.defaultDiscount,
      customBg: template.colors.bg,
      customText: template.colors.text
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configRef = doc(db, 'config', 'main');

      const promotionData = {
        ...promotion,
        startDate: promotion.startDate ? new Date(promotion.startDate).toISOString() : null,
        endDate: promotion.endDate ? new Date(promotion.endDate).toISOString() : null
      };

      await updateDoc(configRef, {
        activePromotion: promotionData,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin'
      });

      showToast('Promoção salva com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showToast('Erro ao salvar promoção', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Gift size={28} className="text-primary" />
            Promoções
          </h1>
          <p className="text-gray-400 mt-1">
            Configure promoções sazonais e banners especiais
          </p>
        </div>
      </div>

      {/* Toggle Ativar/Desativar */}
      <div className="bg-surface border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">Promoção Ativa</h3>
            <p className="text-gray-400 text-sm">
              Ative para mostrar banner no site
            </p>
          </div>
          <button
            onClick={() => setPromotion(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              promotion.enabled ? 'bg-primary' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
              promotion.enabled ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Preview do Banner */}
        {promotion.enabled && (
          <div className="mt-6">
            <p className="text-xs text-gray-500 mb-2 font-semibold">📖 PREVIEW DO BANNER</p>
            <div
              className="rounded-xl p-4 text-center"
              style={{
                backgroundColor: promotion.customBg,
                color: promotion.customText
              }}
            >
              <p className="font-black text-lg">
                {promotion.bannerText || 'Digite o texto do banner'}
              </p>
              {promotion.discount > 0 && (
                <p className="font-bold text-sm mt-1">
                  {promotion.discount}% OFF
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="bg-surface border border-gray-800 rounded-2xl p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          Templates Rápidos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROMOTION_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedTemplate === template.id
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              <span className="text-2xl">{template.emoji}</span>
              <p className="font-bold text-white mt-2">{template.name}</p>
              <p className="text-xs text-gray-500 mt-1">{template.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Configurações */}
      <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-6">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Percent size={20} className="text-primary" />
          Configurações da Promoção
        </h3>

        {/* Texto do Banner */}
        <div>
          <label className="block text-sm font-bold text-gray-400 mb-2">
            Texto do Banner
          </label>
          <input
            type="text"
            value={promotion.bannerText}
            onChange={(e) => setPromotion(prev => ({ ...prev, bannerText: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
            placeholder="Ex: 🔥 BLACK FRIDAY! 30% OFF em todos os serviços!"
          />
        </div>

        {/* Desconto */}
        <div>
          <label className="block text-sm font-bold text-gray-400 mb-2">
            Desconto (%)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="70"
              value={promotion.discount}
              onChange={(e) => setPromotion(prev => ({ ...prev, discount: parseInt(e.target.value) }))}
              className="flex-1 accent-primary"
            />
            <span className="text-2xl font-black text-primary w-16 text-center">
              {promotion.discount}%
            </span>
          </div>
        </div>

        {/* Período */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">
              Data de Início
            </label>
            <input
              type="date"
              value={promotion.startDate}
              onChange={(e) => setPromotion(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">
              Data de Término
            </label>
            <input
              type="date"
              value={promotion.endDate}
              onChange={(e) => setPromotion(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Cores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">
              Cor de Fundo
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={promotion.customBg}
                onChange={(e) => setPromotion(prev => ({ ...prev, customBg: e.target.value }))}
                className="w-12 h-12 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={promotion.customBg}
                onChange={(e) => setPromotion(prev => ({ ...prev, customBg: e.target.value }))}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 text-white focus:outline-none focus:border-primary font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">
              Cor do Texto
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={promotion.customText}
                onChange={(e) => setPromotion(prev => ({ ...prev, customText: e.target.value }))}
                className="w-12 h-12 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={promotion.customText}
                onChange={(e) => setPromotion(prev => ({ ...prev, customText: e.target.value }))}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 text-white focus:outline-none focus:border-primary font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast.show && (
          <div className={`p-3 rounded-lg text-sm font-semibold ${
            toast.type === 'success'
              ? 'bg-green-500/20 text-green-500 border border-green-500/30'
              : 'bg-red-500/20 text-red-500 border border-red-500/30'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Botão Salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-black font-black py-4 rounded-xl hover:bg-[#00c853] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save size={20} />
              Salvar Promoção
            </>
          )}
        </button>
      </div>
    </div>
  );
}
