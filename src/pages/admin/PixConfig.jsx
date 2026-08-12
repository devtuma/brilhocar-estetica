import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Save, CreditCard, Lock, AlertCircle, CheckCircle } from 'lucide-react';

export default function PixConfig() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    guaranteePercentage: 30,
    minGuaranteeAmount: 20,
    pixKey: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'guaranteePercentage' || name === 'minGuaranteeAmount'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const configRef = doc(db, 'config', 'main');
      await updateDoc(configRef, {
        pixConfig: {
          guaranteePercentage: formData.guaranteePercentage,
          minGuaranteeAmount: formData.minGuaranteeAmount,
          pixKey: formData.pixKey,
          pixRecipientName: 'BrilhoCar Estética',
        },
        updatedAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f8f9fa] rounded-xl p-6 shadow-lg border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="text-primary" size={20} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-800">Configurações PIX</h3>
          <p className="text-sm text-gray-500">Configure o pagamento via PIX</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Valor do Sinal */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Percentual do Sinal (%)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              name="guaranteePercentage"
              value={formData.guaranteePercentage}
              onChange={handleChange}
              min="0"
              max="100"
              className="w-24 bg-white border border-gray-300 rounded-lg px-4 py-2 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-gray-600 text-sm">
              do valor total (ex: 30% de R$ 350 = R$ 105)
            </span>
          </div>
        </div>

        {/* Valor Mínimo */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Valor Mínimo do Sinal (R$)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              name="minGuaranteeAmount"
              value={formData.minGuaranteeAmount}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-32 bg-white border border-gray-300 rounded-lg px-4 py-2 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-gray-600 text-sm">
              valor mínimo independente do percentual
            </span>
          </div>
        </div>

        {/* Chave PIX */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Lock size={16} />
            Chave PIX
          </label>
          <input
            type="text"
            name="pixKey"
            value={formData.pixKey}
            onChange={handleChange}
            placeholder="Telefone, email, CPF/CNPJ ou chave aleatória"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-gray-500 mt-2">
            Configure a chave PIX no painel do Asaas primeiro
          </p>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-bold text-blue-800 text-sm mb-2">ℹ️ Como funciona:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Cliente agenda e vai para página de pagamento</li>
            <li>• Sistema gera QR Code PIX com valor do sinal</li>
            <li>• Cliente paga via app do banco</li>
            <li>• Asaas notifica via webhook quando confirmado</li>
            <li>• Restante do valor é pago presencialmente na loja</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              Salvando...
            </>
          ) : (
            <>
              <Save size={20} />
              Salvar Configurações
            </>
          )}
        </button>
      </form>
    </div>
  );
}
