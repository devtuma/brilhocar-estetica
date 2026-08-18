import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Settings, Save, Loader2, Clock, Percent, CheckCircle, AlertCircle } from 'lucide-react';

export default function Configuracoes() {
  const [config, setConfig] = useState({
    hoursWindow: 24,
    retentionPercent: 50,
    autoApproveBeforeWindow: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists() && snap.data().rescheduleConfig) {
        setConfig(prev => ({ ...prev, ...snap.data().rescheduleConfig }));
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (config.retentionPercent < 0 || config.retentionPercent > 100) {
      setMessage({ type: 'error', text: 'A retenção deve ser entre 0% e 100%' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const ref = doc(db, 'config', 'main');
      await updateDoc(ref, {
        rescheduleConfig: {
          hoursWindow: parseInt(config.hoursWindow) || 24,
          retentionPercent: parseFloat(config.retentionPercent) || 0,
          autoApproveBeforeWindow: !!config.autoApproveBeforeWindow,
        },
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erro ao salvar: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <Settings className="text-primary" size={28} />
          Configurações
        </h1>
        <p className="text-gray-400 mt-1">Regras gerais de reagendamento e cancelamento</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold">{message.text}</span>
        </div>
      )}

      {/* Card de Reagendamento */}
      <div className="bg-surface border border-gray-800 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
            <Clock size={20} className="text-primary" />
            Política de Reagendamento
          </h2>
          <p className="text-sm text-gray-400">
            Define as regras para quando o cliente pode reagendar com ou sem custo.
          </p>
        </div>

        {/* Janela de antecedência */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Janela mínima de antecedência (horas)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="168"
              value={config.hoursWindow}
              onChange={(e) => setConfig(prev => ({ ...prev, hoursWindow: e.target.value }))}
              className="w-32 bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-primary"
            />
            <span className="text-gray-400 text-sm">horas antes do horário</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Se o cliente pedir reagendamento com pelo menos essa antecedência, é livre (sem cobrança).
            Abaixo disso, é necessário aprovação do admin e há retenção.
          </p>
        </div>

        {/* Percentual de retenção */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
            <Percent size={14} />
            Percentual retido em reagendamento fora da janela (0-100%)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={config.retentionPercent}
              onChange={(e) => setConfig(prev => ({ ...prev, retentionPercent: parseInt(e.target.value) }))}
              className="flex-1 accent-primary"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={config.retentionPercent}
              onChange={(e) => setConfig(prev => ({ ...prev, retentionPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
              className="w-24 bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-center focus:outline-none focus:border-primary"
            />
            <span className="text-gray-400 text-lg font-bold">%</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>Exemplo: se cliente pagou R$ 100 de sinal e reagendar fora da janela, será retido:</span>
            <span className="bg-primary/20 text-primary font-bold px-2 py-1 rounded-lg">
              R$ {Math.min(100, (100 * config.retentionPercent / 100)).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Auto-aprovação dentro da janela */}
        <div className="flex items-start gap-3 p-4 bg-gray-900 rounded-xl border border-gray-700">
          <input
            type="checkbox"
            id="autoApprove"
            checked={config.autoApproveBeforeWindow}
            onChange={(e) => setConfig(prev => ({ ...prev, autoApproveBeforeWindow: e.target.checked }))}
            className="w-5 h-5 mt-0.5 rounded accent-primary"
          />
          <label htmlFor="autoApprove" className="flex-1 cursor-pointer">
            <p className="font-bold text-white text-sm">Aprovar automaticamente dentro da janela</p>
            <p className="text-xs text-gray-400 mt-1">
              Se marcado, reagendamentos feitos dentro da janela de antecedência serão aprovados automaticamente,
              sem precisar de revisão do admin.
            </p>
          </label>
        </div>

        {/* Botão Salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full md:w-auto bg-primary text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00c853] transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save size={18} />
              Salvar configurações
            </>
          )}
        </button>
      </div>

      {/* Resumo das regras atuais */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
        <h3 className="font-bold text-blue-300 text-sm mb-2">📋 Resumo das regras</h3>
        <ul className="text-blue-200/80 text-sm space-y-1">
          <li>✓ Cliente pode reagendar com <b>{config.hoursWindow}h</b> ou mais de antecedência → <b>sem custo, livre</b></li>
          <li>⚠️ Menos de {config.hoursWindow}h de antecedência → <b>aprovação do admin + retenção de {config.retentionPercent}%</b></li>
          <li>{config.autoApproveBeforeWindow ? '✅' : '❌'} Aprovação automática dentro da janela: <b>{config.autoApproveBeforeWindow ? 'SIM' : 'NÃO'}</b></li>
        </ul>
      </div>
    </div>
  );
}
