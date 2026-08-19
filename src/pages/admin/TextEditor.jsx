import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, Save, Eye, Edit3, CheckCircle, AlertCircle } from 'lucide-react';

// Defaults baseados nos textos hardcoded que estão no site online agora.
// Quando o admin abrir o TextEditor sem nada salvo, ele vê ISTO.
export const TEXT_DEFAULTS = {
  homeHero: {
    title: 'Devolva o Brilho Original ao seu Veículo.',
    subtitle: 'Tratamento vip para o seu carro com produtos de alta performance.',
    ctaText: 'Agendar Meu Horário',
  },
  homeAbout: {
    title: 'Por que escolher a BrilhoCar?',
    description: 'Não pulamos etapas. Utilizamos iluminação especial e técnicas avançadas para garantir que cada centímetro da pintura esteja perfeito. Acompanhamento em tempo real via QR Code exclusivo.',
  },
  bookingTitle: 'Novo Agendamento',
  bookingSubtitle: 'Selecione os serviços desejados e confirme os dados do seu veículo.',
  footer: {
    address: 'R. Pindamonhangaba, 178',
    phone: '11981312143',
    whatsapp: '5511981312143',
    instagram: '@brilhocar',
    facebook: 'BrilhoCar',
    email: 'contato@brilhocar.com',
  },
};

/**
 * Editor de texto modular para o CMS Admin - VERSÃO ROBUSTA
 * Usa onSnapshot para sempre refletir o que está salvo no Firestore.
 */
export default function TextEditor({ sectionKey, fields, showPreview = true }) {
  const [values, setValues] = useState({});
  const [originalValues, setOriginalValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [loadingSection, setLoadingSection] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Carregar valores em real-time sempre que sectionKey mudar
  useEffect(() => {
    setLoadingSection(true);
    setValues({});
    setOriginalValues({});

    const unsub = onSnapshot(
      doc(db, 'config', 'main'),
      async (docSnap) => {
        let texts = {};
        const data = docSnap.exists() ? docSnap.data() : {};
        texts = data.texts || {};

        // Pegar defaults baseados no que está online AGORA
        const defaults = TEXT_DEFAULTS[sectionKey] || {};

        // Se a seção não existir no Firestore, CRIAR automaticamente com defaults
        if (!texts[sectionKey] || Object.keys(texts[sectionKey]).length === 0) {
          try {
            await setDoc(
              doc(db, 'config', 'main'),
              {
                texts: {
                  ...texts,
                  [sectionKey]: defaults,
                },
                updatedAt: serverTimestamp(),
                updatedBy: 'system-auto-init',
              },
              { merge: true }
            );
            console.log(`✅ Seção '${sectionKey}' inicializada no Firestore`);
          } catch (e) {
            console.warn('Não foi possível auto-inicializar:', e);
          }
        }

        // SEMPRE mostrar valores - Firestore tem prioridade, defaults se vazio
        const section = texts[sectionKey] || defaults || {};
        const initialValues = {};
        fields.forEach(field => {
          initialValues[field.key] = section[field.key] !== undefined && section[field.key] !== ''
            ? section[field.key]
            : (defaults[field.key] !== undefined ? defaults[field.key] : '');
        });

        setValues(initialValues);
        setOriginalValues(initialValues);

        if (data.updatedAt) {
          setLastSaved(data.updatedAt);
        }
        setLoadingSection(false);
      },
      (err) => {
        console.error('Erro ao carregar config:', err);
        setLoadingSection(false);
      }
    );

    return () => unsub();
  }, [sectionKey, fields]);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(originalValues);

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setToast({ show: false, message: '', type: 'success' });
    try {
      const configRef = doc(db, 'config', 'main');

      // updateDoc com merge - preserva outros textos
      await updateDoc(configRef, {
        [`texts.${sectionKey}`]: values,
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      });

      setOriginalValues(values);
      setLastSaved(new Date());
      setToast({ show: true, message: 'Texto salvo com sucesso!', type: 'success' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setToast({ show: true, message: 'Erro ao salvar texto', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date.seconds * 1000));
    return d.toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white capitalize">
            {sectionKey.replace(/([A-Z])/g, ' $1').trim()}
          </h3>
          {lastSaved && (
            <p className="text-xs text-gray-500 mt-1">
              Última edição: {formatDate(lastSaved)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showPreview && (
            <button
              onClick={() => setPreview(!preview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                preview
                  ? 'bg-primary text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {preview ? <Edit3 size={16} /> : <Eye size={16} />}
              {preview ? 'Editar' : 'Preview'}
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              saving || !hasChanges
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-black hover:bg-[#00c853]'
            }`}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={16} />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`p-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-green-500/20 text-green-500 border border-green-500/30'
            : 'bg-red-500/20 text-red-500 border border-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Campos de edição */}
      {!preview && (
        <div className="space-y-4">
          {loadingSection && (
            <div className="flex items-center gap-2 text-gray-400 text-sm p-3 bg-gray-900/50 rounded-lg">
              <Loader2 size={16} className="animate-spin" />
              Carregando textos salvos do Firestore...
            </div>
          )}
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-bold text-gray-400 mb-2">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary transition-colors resize-none"
                  rows={field.rows || 4}
                  placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                />
              ) : field.type === 'image' ? (
                <div>
                  <input
                    type="text"
                    value={values[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary transition-colors"
                    placeholder="URL da imagem"
                  />
                  {values[field.key] && (
                    <img
                      src={values[field.key]}
                      alt="Preview"
                      className="mt-2 rounded-lg max-h-40 object-cover"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {preview && showPreview && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <p className="text-xs text-gray-500 mb-4 font-semibold">📖 PREVIEW</p>
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.key}>
                <p className="text-xs text-gray-500 mb-1">{field.label}:</p>
                {field.type === 'textarea' ? (
                  <p className="text-gray-300 whitespace-pre-wrap">{values[field.key] || '(vazio)'}</p>
                ) : (
                  <p className="text-gray-300">{values[field.key] || '(vazio)'}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
