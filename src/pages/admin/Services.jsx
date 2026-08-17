import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { Save, Sparkles, Clock, DollarSign, Edit3, Trash2, Plus, CheckCircle, AlertCircle, Loader2, Tag, Database } from 'lucide-react';

const ICONES_DISPONIVEIS = ['Car', 'Sparkles', 'Droplet', 'Sun', 'Shield', 'Star', 'Wrench', 'Crown'];
const DURACAO_PREDEFINIDA = [30, 45, 60, 90, 120, 150, 180, 240];

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newService, setNewService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: 0,
    duration: 60,
    icon: 'Sparkles',
    active: true,
    featured: false
  });

  // Carregar serviços
  useEffect(() => {
    const servicesRef = collection(db, 'services');
    const unsubscribe = onSnapshot(servicesRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setLoading(false);
    }, (err) => {
      console.error('Erro ao carregar serviços:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (service) => {
    setEditingId(service.id);
    setFormData({
      name: service.name || '',
      description: service.description || '',
      basePrice: service.basePrice || 0,
      duration: service.duration || 60,
      icon: service.icon || 'Sparkles',
      active: service.active !== false,
      featured: service.featured || false
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewService(null);
    setFormData({
      name: '', description: '', basePrice: 0, duration: 60,
      icon: 'Sparkles', active: true, featured: false
    });
  };

  const handleSave = async (id, data) => {
    setSaving(true);
    setMessage(null);
    try {
      const serviceRef = doc(db, 'services', id);
      await setDoc(serviceRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setMessage({ type: 'success', text: 'Serviço salvo com sucesso!' });
      handleCancel();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar. Verifique se tem permissão admin.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja remover este serviço?')) return;
    try {
      await deleteDoc(doc(db, 'services', id));
      setMessage({ type: 'success', text: 'Serviço removido!' });
    } catch (err) {
      console.error('Erro ao deletar:', err);
      setMessage({ type: 'error', text: 'Erro ao remover' });
    }
  };

  const handleAddNew = () => {
    const newId = `service-${Date.now()}`;
    setNewService(newId);
    setEditingId(newId);
    setFormData({
      name: '',
      description: '',
      basePrice: 0,
      duration: 60,
      icon: 'Sparkles',
      active: true,
      featured: false
    });
  };

  const handleSeedServices = async () => {
    if (!confirm('Criar serviços padrão? Isso só funciona se não existir nenhum serviço cadastrado.')) return;
    setSeeding(true);
    try {
      const fn = httpsCallable(functions, 'seedServices');
      const result = await fn({});
      setMessage({ type: result.data.success ? 'success' : 'error', text: result.data.message });
    } catch (err) {
      console.error('Erro no seed:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao criar serviços padrão' });
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <Sparkles className="text-primary" size={28} />
            Serviços
          </h1>
          <p className="text-gray-400 mt-1">
            Gerencie os serviços oferecidos, preços e tempo de execução
          </p>
        </div>
        <button
          onClick={handleSeedServices}
          disabled={seeding}
          className="bg-gray-800 text-white font-bold px-4 py-3 rounded-xl hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          title="Criar serviços padrão (só funciona se não houver nenhum)"
        >
          {seeding ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
          <span className="hidden md:inline">Popular Padrão</span>
        </button>
        <button
          onClick={handleAddNew}
          className="bg-primary text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00c853] transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Serviço
        </button>
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

      {/* Formulário de Edição/Criação */}
      {editingId && (
        <div className="bg-surface border border-gray-800 rounded-2xl p-6">
          <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
            <Edit3 size={20} className="text-primary" />
            {newService === editingId ? 'Criar Novo Serviço' : 'Editar Serviço'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-400 mb-2">
                Nome do Serviço
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Lavagem Técnica Premium"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-400 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o que está incluso neste serviço..."
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                <DollarSign size={14} />
                Preço Base (R$)
              </label>
              <input
                type="number"
                value={formData.basePrice}
                onChange={(e) => setFormData(prev => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.01"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                <Clock size={14} />
                Duração (minutos)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                  min="15"
                  step="15"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
                />
                <select
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 text-white focus:outline-none focus:border-primary"
                  value=""
                >
                  <option value="">Rápido</option>
                  {DURACAO_PREDEFINIDA.map(d => (
                    <option key={d} value={d}>{d}min</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Tempo necessário para executar o serviço. Usado para bloquear slots na agenda.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-2">
                Ícone
              </label>
              <select
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary"
              >
                {ICONES_DISPONIVEIS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <label className="block text-sm font-bold text-gray-400">
                Configurações
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 rounded-xl border border-gray-700">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-white text-sm font-semibold">Ativo (visível para clientes)</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 rounded-xl border border-gray-700">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-white text-sm font-semibold">Destaque (aparece em destaque)</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => handleSave(editingId, formData)}
              disabled={saving || !formData.name}
              className="flex-1 bg-primary text-black font-bold py-3 rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  {newService === editingId ? 'Criar Serviço' : 'Salvar Alterações'}
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => (
          <div
            key={service.id}
            className={`bg-surface border rounded-2xl p-5 ${
              service.active === false ? 'border-gray-800 opacity-60' : 'border-gray-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-white text-lg">{service.name}</h3>
                  {service.featured && (
                    <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                      ⭐ Destaque
                    </span>
                  )}
                  {service.active === false && (
                    <span className="bg-gray-700 text-gray-400 text-xs font-bold px-2 py-0.5 rounded-full">
                      Inativo
                    </span>
                  )}
                </div>
                {service.description && (
                  <p className="text-gray-400 text-sm">{service.description}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2 text-gray-400">
                <DollarSign size={16} className="text-primary" />
                <div>
                  <p className="text-xs text-gray-500">Preço</p>
                  <p className="font-bold text-white">
                    R$ {(service.basePrice || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock size={16} className="text-primary" />
                <div>
                  <p className="text-xs text-gray-500">Duração</p>
                  <p className="font-bold text-white">
                    {service.duration || 60} min
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({((service.duration || 60) / 60).toFixed(1)}h)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleEdit(service)}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <Edit3 size={16} />
                Editar
              </button>
              <button
                onClick={() => handleDelete(service.id)}
                className="px-4 py-2 bg-red-500/20 text-red-400 font-semibold rounded-xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {services.length === 0 && (
          <div className="md:col-span-2 bg-surface border border-gray-800 rounded-2xl p-12 text-center">
            <Tag size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-semibold mb-2">Nenhum serviço cadastrado</p>
            <p className="text-gray-500 text-sm mb-4">Clique em "Novo Serviço" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
