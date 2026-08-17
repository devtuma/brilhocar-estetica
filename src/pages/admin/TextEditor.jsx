import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, Save, Eye, Edit3 } from 'lucide-react';

/**
 * Editor de texto modular para o CMS Admin
 *
 * @param {string} sectionKey - Chave da seção em config.texts (ex: 'homeHero')
 * @param {Array} fields - Array de campos [{key: 'title', label: 'Título', type: 'text'|'textarea'}]
 * @param {boolean} showPreview - Se deve mostrar preview
 */
export default function TextEditor({ sectionKey, fields, showPreview = true }) {
  const [values, setValues] = useState({});
  const [originalValues, setOriginalValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [loadingSection, setLoadingSection] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Referência para evitar carregar 2x
  const loadedSectionRef = useRef(null);

  // Carregar valores quando mudar a seção
  useEffect(() => {
    // Evitar carregar a mesma seção várias vezes
    if (loadedSectionRef.current === sectionKey) return;

    const loadConfig = async () => {
      setLoadingSection(true);
      try {
        const configRef = doc(db, 'config', 'main');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const texts = configSnap.data().texts || {};
          const section = texts[sectionKey] || {};

          const initialValues = {};
          fields.forEach(field => {
            // Mostrar valor atual OU placeholder se vazio
            initialValues[field.key] = section[field.key] !== undefined ? section[field.key] : '';
          });

          setValues(initialValues);
          setOriginalValues(initialValues);

          if (configSnap.data().updatedAt) {
            setLastSaved(configSnap.data().updatedAt);
          }
        } else {
          // Se não existe config, criar com valores vazios
          const initialValues = {};
          fields.forEach(field => {
            initialValues[field.key] = '';
          });
          setValues(initialValues);
          setOriginalValues(initialValues);
        }
        loadedSectionRef.current = sectionKey;
      } catch (err) {
        console.error('Erro ao carregar config:', err);
      } finally {
        setLoadingSection(false);
      }
    };

    loadConfig();
  }, [sectionKey]); // Apenas sectionKey nas deps

  const hasChanges = JSON.stringify(values) !== JSON.stringify(originalValues);

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      const configRef = doc(db, 'config', 'main');

      // Buscar config atual
      const configSnap = await getDoc(configRef);
      const currentData = configSnap.exists() ? configSnap.data() : {};
      const currentTexts = currentData.texts || {};

      // Atualizar apenas a seção
      await updateDoc(configRef, {
        [`texts.${sectionKey}`]: {
          ...currentTexts[sectionKey],
          ...values
        },
        updatedAt: serverTimestamp(),
        updatedBy: 'admin'
      });

      setOriginalValues(values);
      setLastSaved(new Date());
      showToast('Texto salvo com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showToast('Erro ao salvar texto', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date.seconds * 1000);
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
        <div className={`p-3 rounded-lg text-sm font-semibold ${
          toast.type === 'success'
            ? 'bg-green-500/20 text-green-500 border border-green-500/30'
            : 'bg-red-500/20 text-red-500 border border-red-500/30'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Campos de edição */}
      {!preview && (
        <div className="space-y-4">
          {loadingSection && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Carregando textos salvos...
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
