import { useState, useEffect } from 'react';
import { Save, Palette, Image, Globe, CreditCard, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useTenant } from '../../contexts/TenantContext';

export default function Branding() {
  const { tenant, saveTenant, DEFAULT_TENANT } = useTenant();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
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
    logoUrl: '',

    // Contato
    contact: {
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      instagram: '',
      facebook: '',
    },

    // PIX
    pix: {
      AsaasAPIKey: '',
      walletId: '',
      environment: 'production',
    },

    // Firebase (para novos tenants)
    firebase: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
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
        logoUrl: tenant.logoUrl || '',
        contact: {
          email: tenant.contact?.email || '',
          phone: tenant.contact?.phone || '',
          whatsapp: tenant.contact?.whatsapp || '',
          address: tenant.contact?.address || '',
          instagram: tenant.contact?.instagram || '',
          facebook: tenant.contact?.facebook || '',
        },
        pix: {
          AsaasAPIKey: tenant.pix?.AsaasAPIKey || '',
          walletId: tenant.pix?.walletId || '',
          environment: tenant.pix?.environment || 'production',
        },
        firebase: {
          apiKey: tenant.firebaseConfig?.apiKey || '',
          authDomain: tenant.firebaseConfig?.authDomain || '',
          projectId: tenant.firebaseConfig?.projectId || '',
          storageBucket: tenant.firebaseConfig?.storageBucket || '',
          messagingSenderId: tenant.firebaseConfig?.messagingSenderId || '',
          appId: tenant.firebaseConfig?.appId || '',
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

  // Salvar tudo
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
        logoUrl: formData.logoUrl,
        contact: formData.contact,
        pix: formData.pix,
        firebaseConfig: formData.firebase,
        updatedAt: new Date().toISOString(),
      };

      // Salvar no Firestore
      await setDoc(doc(db, 'tenants', tenant.id), dataToSave, { merge: true });

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });

      // Recarregar página após 2 segundos para aplicar tema
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Preview das cores
  const previewStyles = {
    backgroundColor: formData.backgroundColor,
    color: '#fff',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '16px',
  };

  const previewButtonStyle = {
    backgroundColor: formData.primaryColor,
    color: '#000',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 'bold',
    marginRight: '8px',
  };

  const previewAccentStyle = {
    backgroundColor: formData.accentColor,
    color: '#000',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 'bold',
  };

  return (
    <div className="pt-4 md:pt-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Branding & Configurações</h2>
          <p className="text-gray-400 mt-1">Personalize a aparência e configurações do tenant</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-primary text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00c853] transition-colors flex items-center gap-2 disabled:opacity-50"
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
            : 'bg-red-500/20 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-4">
        {[
          { key: 'branding', label: '🎨 Branding', icon: Palette },
          { key: 'contact', label: '📞 Contato', icon: Globe },
          { key: 'pix', label: '💳 PIX', icon: CreditCard },
          { key: 'firebase', label: '🔥 Firebase', icon: Image },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              activeTab === tab.key
                ? 'bg-primary text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
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
            <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-4">
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

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Cor Primária</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Cor de Destaque</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.accentColor}
                      onChange={(e) => handleChange('accentColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={formData.accentColor}
                      onChange={(e) => handleChange('accentColor', e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Cor de Fundo</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.backgroundColor}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={formData.backgroundColor}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Cor da Superfície</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.surfaceColor}
                      onChange={(e) => handleChange('surfaceColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={formData.surfaceColor}
                      onChange={(e) => handleChange('surfaceColor', e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">URL do Logo (opcional)</label>
                <input
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="https://exemplo.com/logo.png"
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
                  <label className="block text-sm font-semibold text-gray-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.contact.email}
                    onChange={(e) => handleNestedChange('contact', 'email', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="contato@empresa.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.contact.phone}
                    onChange={(e) => handleNestedChange('contact', 'phone', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="11999999999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">WhatsApp (somente números)</label>
                  <input
                    type="text"
                    value={formData.contact.whatsapp}
                    onChange={(e) => handleNestedChange('contact', 'whatsapp', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="5511999999999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Endereço</label>
                  <input
                    type="text"
                    value={formData.contact.address}
                    onChange={(e) => handleNestedChange('contact', 'address', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="Cidade, Estado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={formData.contact.instagram}
                    onChange={(e) => handleNestedChange('contact', 'instagram', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="@empresa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Facebook</label>
                  <input
                    type="text"
                    value={formData.contact.facebook}
                    onChange={(e) => handleNestedChange('contact', 'facebook', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="Empresa"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PIX */}
          {activeTab === 'pix' && (
            <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CreditCard size={20} className="text-primary" />
                Configurações PIX (Asaas)
              </h3>

              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
                <p className="text-yellow-400 text-sm">
                  <strong>Importante:</strong> A API Key do Asaas é sensível. Mantenha-a segura e nunca compartilhe publicamente.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">API Key do Asaas</label>
                <input
                  type="password"
                  value={formData.pix.AsaasAPIKey}
                  onChange={(e) => handleNestedChange('pix', 'AsaasAPIKey', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="Sua API Key do Asaas"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">Wallet ID (ID da Carteira)</label>
                <input
                  type="text"
                  value={formData.pix.walletId}
                  onChange={(e) => handleNestedChange('pix', 'walletId', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  placeholder="wallet_XXXXXXXXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-1">Ambiente</label>
                <select
                  value={formData.pix.environment}
                  onChange={(e) => handleNestedChange('pix', 'environment', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                >
                  <option value="production">Produção</option>
                  <option value="sandbox">Sandbox (Teste)</option>
                </select>
              </div>
            </div>
          )}

          {/* Firebase */}
          {activeTab === 'firebase' && (
            <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Image size={20} className="text-primary" />
                Configurações Firebase
              </h3>

              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                <p className="text-blue-400 text-sm">
                  <strong>Para multi-tenant:</strong> Cada cliente pode ter seu próprio projeto Firebase.
                  Configure aqui as credenciais do projeto específico.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Project ID</label>
                  <input
                    type="text"
                    value={formData.firebase.projectId}
                    onChange={(e) => handleNestedChange('firebase', 'projectId', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="meu-projeto-firebase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">API Key</label>
                  <input
                    type="text"
                    value={formData.firebase.apiKey}
                    onChange={(e) => handleNestedChange('firebase', 'apiKey', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="AIzaSy..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Auth Domain</label>
                  <input
                    type="text"
                    value={formData.firebase.authDomain}
                    onChange={(e) => handleNestedChange('firebase', 'authDomain', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="meu-projeto.firebaseapp.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Storage Bucket</label>
                  <input
                    type="text"
                    value={formData.firebase.storageBucket}
                    onChange={(e) => handleNestedChange('firebase', 'storageBucket', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="meu-projeto.appspot.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Messaging Sender ID</label>
                  <input
                    type="text"
                    value={formData.firebase.messagingSenderId}
                    onChange={(e) => handleNestedChange('firebase', 'messagingSenderId', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="123456789"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-400 mb-1">App ID</label>
                  <input
                    type="text"
                    value={formData.firebase.appId}
                    onChange={(e) => handleNestedChange('firebase', 'appId', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="1:123456789:web:abcdef"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-gray-800 rounded-2xl p-6 sticky top-4">
            <h3 className="text-lg font-bold mb-4">Preview</h3>

            <div style={previewStyles}>
              <h4 className="text-xl font-black mb-2">
                <span style={{ color: formData.primaryColor }}>{formData.logoText || 'Logo'}</span>
              </h4>
              <p className="text-sm text-gray-400 mb-4">{formData.displayName || 'Nome da Empresa'}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                <button style={previewButtonStyle}>Primária</button>
                <button style={previewAccentStyle}>Destaque</button>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: formData.surfaceColor }}>
                <p className="text-xs text-gray-400">Superfície</p>
                <p className="text-sm">Card de exemplo</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-900/50 rounded-xl">
              <p className="text-xs text-gray-500 mb-2">Cores selecionadas:</p>
              <div className="flex gap-2">
                <div
                  className="w-8 h-8 rounded-lg border border-gray-700"
                  style={{ backgroundColor: formData.primaryColor }}
                  title="Primária"
                />
                <div
                  className="w-8 h-8 rounded-lg border border-gray-700"
                  style={{ backgroundColor: formData.accentColor }}
                  title="Destaque"
                />
                <div
                  className="w-8 h-8 rounded-lg border border-gray-700"
                  style={{ backgroundColor: formData.backgroundColor }}
                  title="Fundo"
                />
                <div
                  className="w-8 h-8 rounded-lg border border-gray-700"
                  style={{ backgroundColor: formData.surfaceColor }}
                  title="Superfície"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
