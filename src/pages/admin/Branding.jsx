import { useState, useEffect } from 'react';
import {
  Save, Palette, Image, Globe, CreditCard,
  AlertCircle, CheckCircle, Loader2,
  Sun, Moon, Monitor, Zap, Eye, EyeOff, Activity
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useTenant } from '../../contexts/TenantContext';

export default function Branding() {
  const { tenant, saveTenant, effectiveTheme, DEFAULT_TENANT } = useTenant();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');

  // Estados do formulário
  const [formData, setFormData] = useState({
    // Branding
    displayName: '',
    logoText: '',
    primaryColor: '#00e676',
    accentColor: '#D4AF37',
    backgroundColor: '#0a0a0f',
    surfaceColor: '#151515',
    backgroundColorLight: '#FFFFFF',
    surfaceColorLight: '#F5F5F5',
    logoUrl: '',
    themeMode: 'auto', // 'auto' | 'dark' | 'light'

    // Contato
    contact: {
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      instagram: '',
      facebook: '',
    },

    // PIX (sensível - criptografado ao salvar)
    pix: {
      AsaasAPIKey: '',
      walletId: '',
      pixKey: '',
      environment: 'production',
    },
  });

  // Carregar dados atuais
  useEffect(() => {
    if (tenant) {
      setFormData({
        displayName: tenant.displayName || '',
        logoText: tenant.logoText || '',
        primaryColor: tenant.primaryColor || '#00e676',
        accentColor: tenant.accentColor || '#D4AF37',
        backgroundColor: tenant.backgroundColor || '#0a0a0f',
        surfaceColor: tenant.surfaceColor || '#151515',
        backgroundColorLight: tenant.backgroundColorLight || '#FFFFFF',
        surfaceColorLight: tenant.surfaceColorLight || '#F5F5F5',
        logoUrl: tenant.logoUrl || '',
        themeMode: tenant.themeMode || 'auto',
        contact: {
          email: tenant.contact?.email || '',
          phone: tenant.contact?.phone || '',
          whatsapp: tenant.contact?.whatsapp || '',
          address: tenant.contact?.address || '',
          instagram: tenant.contact?.instagram || '',
          facebook: tenant.contact?.facebook || '',
        },
        pix: {
          // API Key nunca vem do Firestore em plaintext (criptografada)
          AsaasAPIKey: '',
          walletId: tenant.pix?.walletId || '',
          pixKey: tenant.pix?.pixKey || '',
          environment: tenant.pix?.environment || 'production',
        },
      });
    }
  }, [tenant]);

  // Atualizar campo simples
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Atualizar campo aninhado
  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value },
    }));
  };

  // Salvar configurações (API keys vão criptografadas via Cloud Function)
  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const dataToSave = {
        displayName: formData.displayName,
        logoText: formData.logoText,
        primaryColor: formData.primaryColor,
        accentColor: formData.accentColor,
        backgroundColor: formData.backgroundColor,
        surfaceColor: formData.surfaceColor,
        backgroundColorLight: formData.backgroundColorLight,
        surfaceColorLight: formData.surfaceColorLight,
        logoUrl: formData.logoUrl,
        themeMode: formData.themeMode,
        contact: formData.contact,
        pix: {
          walletId: formData.pix.walletId,
          pixKey: formData.pix.pixKey,
          environment: formData.pix.environment,
        },
        // Se tiver API key nova, incluir (será criptografada)
        ...(formData.pix.AsaasAPIKey ? { AsaasAPIKey: formData.pix.AsaasAPIKey } : {}),
        updatedAt: new Date().toISOString(),
      };

      // Usar saveTenant do TenantContext (que chama Cloud Function)
      const result = await saveTenant(dataToSave);

      if (result.success) {
        setMessage({
          type: 'success',
          text: '✅ Configurações salvas com sucesso! Recarregando...'
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Erro: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Testar conexão Asaas (sem expor a key)
  const handleTestAsaas = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Se tiver key no formulário, primeiro salvar para testar
      if (formData.pix.AsaasAPIKey) {
        setMessage({ type: 'info', text: 'Salvando key temporariamente para teste...' });
        await saveTenant({
          pix: {
            AsaasAPIKey: formData.pix.AsaasAPIKey,
            walletId: formData.pix.walletId,
            pixKey: formData.pix.pixKey,
            environment: formData.pix.environment,
          },
        });
      }

      const testFn = httpsCallable(functions, 'testAsaasConnectionFn');
      const result = await testFn({ tenantId: tenant.id || 'brilhocar' });

      if (result.data.success) {
        setTestResult({
          success: true,
          account: result.data.account,
          environment: result.data.environment,
        });
      } else {
        setTestResult({
          success: false,
          error: result.data.error,
        });
      }
    } catch (err) {
      console.error('Erro ao testar Asaas:', err);
      setTestResult({
        success: false,
        error: err.message || 'Erro desconhecido',
      });
    } finally {
      setTesting(false);
    }
  };

  // Determinar tema efetivo para preview
  const getPreviewTheme = () => {
    if (formData.themeMode === 'auto') {
      // Simular luminância: verde claro = auto dark, cor escura = auto light
      const r = parseInt(formData.primaryColor.slice(1, 3), 16);
      const g = parseInt(formData.primaryColor.slice(3, 5), 16);
      const b = parseInt(formData.primaryColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? 'dark' : 'light';
    }
    return formData.themeMode;
  };

  const previewTheme = getPreviewTheme();
  const previewBg = previewTheme === 'light'
    ? formData.backgroundColorLight
    : formData.backgroundColor;
  const previewText = previewTheme === 'light' ? '#0a0a0f' : '#FFFFFF';

  // Calcular cor de texto em botão primário (contraste)
  const getOnPrimaryColor = (bgColor) => {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  const previewButtonStyle = {
    backgroundColor: formData.primaryColor,
    color: getOnPrimaryColor(formData.primaryColor),
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 'bold',
    marginRight: '8px',
  };

  return (
    <div className="pt-4 md:pt-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Branding & Configurações</h2>
          <p className="text-gray-400 mt-1">
            Personalize o tenant
            <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              Tema efetivo: {effectiveTheme}
            </span>
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-primary text-black font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
          style={{ color: getOnPrimaryColor(formData.primaryColor) }}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </div>

      {/* Mensagem */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-500/20 border border-green-500/30 text-green-400'
            : message.type === 'info'
            ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
            : 'bg-red-500/20 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> :
           message.type === 'info' ? <Activity size={20} /> :
           <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-4">
        {[
          { key: 'branding', label: 'Branding', icon: Palette },
          { key: 'contact', label: 'Contato', icon: Globe },
          { key: 'pix', label: 'PIX', icon: CreditCard },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === tab.key
                ? 'bg-primary text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            style={activeTab === tab.key ? { color: getOnPrimaryColor(formData.primaryColor) } : {}}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="lg:col-span-2 space-y-6">

          {/* Branding */}
          {activeTab === 'branding' && (
            <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Palette size={20} className="text-primary" />
                Identidade Visual
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => handleChange('displayName', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="BrilhoCar Estética Automotiva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Texto do Logo</label>
                  <input
                    type="text"
                    value={formData.logoText}
                    onChange={(e) => handleChange('logoText', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="BrilhoCar"
                  />
                </div>
              </div>

              {/* Modo do Tema */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  Modo do Tema
                  <span className="ml-2 text-xs text-gray-500">
                    (Auto = escolhe baseado na cor primária)
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'auto', label: 'Automático', icon: Zap, desc: 'Calcula pela cor primária' },
                    { key: 'dark', label: 'Escuro', icon: Moon, desc: 'Sempre dark mode' },
                    { key: 'light', label: 'Claro', icon: Sun, desc: 'Sempre light mode' },
                  ].map(mode => (
                    <button
                      key={mode.key}
                      onClick={() => handleChange('themeMode', mode.key)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                        formData.themeMode === mode.key
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                      }`}
                    >
                      <mode.icon size={20} className={formData.themeMode === mode.key ? 'text-primary' : 'text-gray-400'} />
                      <span className="text-sm font-semibold">{mode.label}</span>
                      <span className="text-xs text-gray-500 text-center">{mode.desc}</span>
                    </button>
                  ))}
                </div>
                {formData.themeMode === 'auto' && (
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tema efetivo atual: <span className="text-primary font-bold">{previewTheme}</span>
                    {' '}(baseado na luminância da cor primária)
                  </p>
                )}
              </div>

              {/* Cores Primárias (comuns a ambos temas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">
                    Cor Primária
                    <span className="ml-2 text-xs text-gray-500">(botões, destaques)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      className="w-16 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Texto do botão: <span style={{ color: getOnPrimaryColor(formData.primaryColor) === '#FFFFFF' ? '#fff' : '#000', backgroundColor: formData.primaryColor, padding: '2px 6px', borderRadius: '4px' }}>{getOnPrimaryColor(formData.primaryColor) === '#FFFFFF' ? 'Branco' : 'Preto'}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Cor de Destaque (Accent)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.accentColor}
                      onChange={(e) => handleChange('accentColor', e.target.value)}
                      className="w-16 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                    />
                    <input
                      type="text"
                      value={formData.accentColor}
                      onChange={(e) => handleChange('accentColor', e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Cores de Fundo - Tema Dark */}
              <details className="bg-gray-900/50 rounded-xl p-4 border border-gray-800" open={previewTheme === 'dark'}>
                <summary className="cursor-pointer font-semibold text-gray-300 flex items-center gap-2">
                  <Moon size={16} />
                  Cores do Tema Escuro
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1">Background</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.backgroundColor}
                        onChange={(e) => handleChange('backgroundColor', e.target.value)}
                        className="w-16 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.backgroundColor}
                        onChange={(e) => handleChange('backgroundColor', e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1">Superfície (cards)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.surfaceColor}
                        onChange={(e) => handleChange('surfaceColor', e.target.value)}
                        className="w-16 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.surfaceColor}
                        onChange={(e) => handleChange('surfaceColor', e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </details>

              {/* Cores de Fundo - Tema Light */}
              <details className="bg-gray-900/50 rounded-xl p-4 border border-gray-800" open={previewTheme === 'light'}>
                <summary className="cursor-pointer font-semibold text-gray-300 flex items-center gap-2">
                  <Sun size={16} />
                  Cores do Tema Claro
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1">Background (claro)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.backgroundColorLight}
                        onChange={(e) => handleChange('backgroundColorLight', e.target.value)}
                        className="w-16 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.backgroundColorLight}
                        onChange={(e) => handleChange('backgroundColorLight', e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1">Superfície (cards)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.surfaceColorLight}
                        onChange={(e) => handleChange('surfaceColorLight', e.target.value)}
                        className="w-16 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                      />
                      <input
                        type="text"
                        value={formData.surfaceColorLight}
                        onChange={(e) => handleChange('surfaceColorLight', e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </details>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">URL do Logo (opcional)</label>
                <input
                  type="text"
                  value={formData.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {/* Contato */}
          {activeTab === 'contact' && (
            <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Globe size={20} className="text-primary" />
                Informações de Contato
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.contact.email}
                    onChange={(e) => handleNestedChange('contact', 'email', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.contact.phone}
                    onChange={(e) => handleNestedChange('contact', 'phone', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="(11) 98131-2143"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">WhatsApp (só números com DDI)</label>
                  <input
                    type="text"
                    value={formData.contact.whatsapp}
                    onChange={(e) => handleNestedChange('contact', 'whatsapp', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="5511981312143"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Endereço</label>
                  <input
                    type="text"
                    value={formData.contact.address}
                    onChange={(e) => handleNestedChange('contact', 'address', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={formData.contact.instagram}
                    onChange={(e) => handleNestedChange('contact', 'instagram', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="@seuarroba"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Facebook</label>
                  <input
                    type="text"
                    value={formData.contact.facebook}
                    onChange={(e) => handleNestedChange('contact', 'facebook', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PIX */}
          {activeTab === 'pix' && (
            <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <AlertCircle size={20} className="text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-sm text-yellow-300">
                  <strong>Segurança:</strong> A API Key do Asaas é criptografada com AES-256 antes de ser salva.
                  Apenas Cloud Functions descriptografam para uso. Você pode testar a conexão abaixo sem expor a key.
                </div>
              </div>

              <h3 className="text-lg font-bold flex items-center gap-2">
                <CreditCard size={20} className="text-primary" />
                Configurações PIX (Asaas)
              </h3>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">API Key do Asaas</label>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.pix.AsaasAPIKey}
                    onChange={(e) => handleNestedChange('pix', 'AsaasAPIKey', e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                    placeholder={tenant?.pix?.AsaasAPIKey ? "•••••••••••• (key salva - cole nova para alterar)" : "Cole sua API Key aqui"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700"
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  🔒 Será criptografada antes de salvar. Nunca exibida novamente após salvar.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">Chave PIX (opcional)</label>
                <input
                  type="text"
                  value={formData.pix.pixKey}
                  onChange={(e) => handleNestedChange('pix', 'pixKey', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="email@dominio.com, CPF, celular ou chave aleatória"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se vazio, usa a chave PIX padrão cadastrada na sua conta Asaas.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">Wallet ID (ID da Carteira)</label>
                <input
                  type="text"
                  value={formData.pix.walletId}
                  onChange={(e) => handleNestedChange('pix', 'walletId', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-mono text-sm"
                  placeholder="wallet_xxxxxxxxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">Ambiente</label>
                <select
                  value={formData.pix.environment}
                  onChange={(e) => handleNestedChange('pix', 'environment', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                >
                  <option value="production">Produção (real)</option>
                  <option value="sandbox">Sandbox (testes)</option>
                </select>
              </div>

              {/* Botão de Testar Conexão */}
              <div className="pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleTestAsaas}
                  disabled={testing || loading}
                  className="w-full px-6 py-3 bg-accent/20 text-accent border border-accent/40 rounded-xl hover:bg-accent/30 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50"
                  style={{ color: formData.accentColor, borderColor: formData.accentColor }}
                >
                  {testing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Testando conexão...
                    </>
                  ) : (
                    <>
                      <Activity size={18} />
                      Testar Conexão Asaas
                    </>
                  )}
                </button>

                {testResult && (
                  <div className={`mt-4 p-4 rounded-xl ${
                    testResult.success
                      ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                      : 'bg-red-500/20 border border-red-500/30 text-red-300'
                  }`}>
                    {testResult.success ? (
                      <div className="space-y-1">
                        <p className="font-bold flex items-center gap-2">
                          <CheckCircle size={18} />
                          Conexão bem-sucedida!
                        </p>
                        {testResult.account && (
                          <div className="text-sm ml-7 space-y-0.5">
                            <p>Conta: <span className="font-semibold">{testResult.account.name || testResult.account.companyName}</span></p>
                            <p>Email: {testResult.account.email}</p>
                            {testResult.account.walletId && <p>Wallet: <code className="text-xs">{testResult.account.walletId}</code></p>}
                          </div>
                        )}
                        <p className="text-xs ml-7 opacity-75">Ambiente: {testResult.environment}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          <AlertCircle size={18} />
                          Falha na conexão
                        </p>
                        <p className="text-sm ml-7 mt-1">{testResult.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview ao vivo */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 bg-surface border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Monitor size={20} className="text-primary" />
              Preview ao Vivo
            </h3>
            <p className="text-xs text-gray-500 -mt-2">
              {formData.themeMode === 'auto' ? (
                <>Auto: {previewTheme === 'dark' ? <Moon size={12} className="inline" /> : <Sun size={12} className="inline" />} {previewTheme}</>
              ) : (
                <>Modo: {previewTheme === 'dark' ? 'Escuro' : 'Claro'}</>
              )}
            </p>

            <div
              className="rounded-xl p-4 space-y-3 border-2 border-dashed border-gray-700"
              style={{ backgroundColor: previewBg, color: previewText }}
            >
              <h4 className="font-bold text-lg" style={{ color: formData.primaryColor }}>
                {formData.logoText || formData.displayName || 'BrilhoCar'}
              </h4>
              <p className="text-sm opacity-80">
                {formData.displayName || 'BrilhoCar Estética Automotiva'}
              </p>
              <div>
                <button style={previewButtonStyle}>
                  Primária
                </button>
                <button style={{
                  backgroundColor: formData.accentColor,
                  color: getOnPrimaryColor(formData.accentColor),
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                }}>
                  Destaque
                </button>
              </div>
              <div className="text-xs opacity-60 p-2 rounded" style={{
                backgroundColor: previewTheme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
              }}>
                Card de exemplo
              </div>
              <p className="text-xs opacity-50">
                Auto-contraste: texto branco se cor primária escura, texto preto se cor primária clara
              </p>
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Primária:</span>
                <span className="font-mono">{formData.primaryColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Accent:</span>
                <span className="font-mono">{formData.accentColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Background:</span>
                <span className="font-mono">{previewBg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tema:</span>
                <span className="font-bold text-primary">{previewTheme}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
