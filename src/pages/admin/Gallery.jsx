import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { Upload, Trash2, Edit3, X, ImageIcon, Loader2, CheckCircle, AlertCircle, Save } from 'lucide-react';

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    car: '',
    beforeFile: null,
    afterFile: null,
    beforeUrl: '',
    afterUrl: '',
    order: 0,
    active: true,
  });

  const beforeInputRef = useRef(null);
  const afterInputRef = useRef(null);

  useEffect(() => {
    const q = collection(db, 'gallery');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      car: '',
      beforeFile: null,
      afterFile: null,
      beforeUrl: '',
      afterUrl: '',
      order: 0,
      active: true,
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({
      title: item.title || '',
      car: item.car || '',
      beforeFile: null,
      afterFile: null,
      beforeUrl: item.beforeUrl || '',
      afterUrl: item.afterUrl || '',
      order: item.order || 0,
      active: item.active !== false,
    });
    setEditing(item);
    setShowForm(true);
  };

  // Upload de arquivo via input (câmera ou galeria do dispositivo)
  const handleFileChange = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  // Drag and drop
  const handleDrop = (e, field) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  // Upload para Firebase Storage via Cloud Function (evita CORS)
  const uploadImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const uploadFn = httpsCallable(functions, 'uploadGalleryImage');
          const result = await uploadFn({
            imageData: base64Data,
            fileName: file.name,
          });
          if (result.data.success) {
            resolve(result.data.url);
          } else {
            reject(new Error(result.data.error || 'Erro no upload'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setUploading(true);
    setMessage(null);

    try {
      let beforeUrl = formData.beforeUrl;
      let afterUrl = formData.afterUrl;

      // Upload before image se um novo arquivo foi selecionado
      if (formData.beforeFile) {
        beforeUrl = await uploadImage(formData.beforeFile);
      }

      // Upload after image se um novo arquivo foi selecionado
      if (formData.afterFile) {
        afterUrl = await uploadImage(formData.afterFile);
      }

      if (!beforeUrl || !afterUrl) {
        throw new Error('É necessário enviar as duas imagens (antes e depois)');
      }

      const dataToSave = {
        title: formData.title,
        car: formData.car,
        beforeUrl,
        afterUrl,
        order: Number(formData.order) || 0,
        active: formData.active,
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, 'gallery', editing.id), dataToSave);
        setMessage({ type: 'success', text: 'Item atualizado com sucesso!' });
      } else {
        await addDoc(collection(db, 'gallery'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        setMessage({ type: 'success', text: 'Item criado com sucesso!' });
      }

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Erro: ' + err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Excluir "${item.title || 'este item'}"?`)) return;

    try {
      await deleteDoc(doc(db, 'gallery', item.id));
      setMessage({ type: 'success', text: 'Item excluído!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao excluir: ' + err.message });
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateDoc(doc(db, 'gallery', item.id), { active: !item.active });
    } catch (err) {
      console.error(err);
    }
  };

  // Preview de imagem
  const getPreviewUrl = (fileOrUrl) => {
    if (!fileOrUrl) return null;
    if (typeof fileOrUrl === 'string') return fileOrUrl;
    return URL.createObjectURL(fileOrUrl);
  };

  return (
    <div className="pt-4 md:pt-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Galeria Antes & Depois</h2>
          <p className="text-gray-400 mt-1">{items.length} itens na galeria</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00c853] transition-colors flex items-center gap-2"
        >
          <Upload size={18} />
          Novo Item
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

      {/* Lista de itens */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-gray-800 rounded-2xl">
          <ImageIcon size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-lg font-bold text-gray-400">Nenhum item na galeria</p>
          <p className="text-sm text-gray-500 mt-1">Clique em "Novo Item" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div
              key={item.id}
              className={`bg-surface border rounded-2xl overflow-hidden ${
                item.active === false ? 'border-gray-800 opacity-60' : 'border-gray-700'
              }`}
            >
              <div className="grid grid-cols-2">
                <div className="relative aspect-square">
                  <img src={item.beforeUrl} alt="Antes" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] uppercase font-black px-2 py-1 rounded">
                    Antes
                  </div>
                </div>
                <div className="relative aspect-square">
                  <img src={item.afterUrl} alt="Depois" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] uppercase font-black px-2 py-1 rounded">
                    Depois
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="font-bold text-white text-sm">{item.title || 'Sem título'}</p>
                {item.car && <p className="text-xs text-gray-400 mt-1">{item.car}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openEdit(item)}
                    className="flex-1 px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 text-xs flex items-center justify-center gap-1"
                  >
                    <Edit3 size={14} /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                      item.active === false
                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {item.active === false ? 'Ativar' : 'Desativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Formulário */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !uploading && setShowForm(false)}
        >
          <div
            className="bg-surface border border-gray-700 rounded-2xl p-6 max-w-2xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                {editing ? 'Editar Item' : 'Novo Item da Galeria'}
              </h3>
              <button
                onClick={() => !uploading && setShowForm(false)}
                className="p-2 hover:bg-gray-800 rounded-lg"
                disabled={uploading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Upload Antes */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  📷 Imagem ANTES
                </label>
                <div
                  onDrop={(e) => handleDrop(e, 'beforeFile')}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => beforeInputRef.current?.click()}
                >
                  {formData.beforeFile || formData.beforeUrl ? (
                    <div className="relative">
                      <img
                        src={getPreviewUrl(formData.beforeFile || formData.beforeUrl)}
                        alt="Preview Antes"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <p className="text-xs text-green-400 mt-2">
                        ✓ {formData.beforeFile ? formData.beforeFile.name : 'Imagem atual'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto text-gray-500 mb-2" size={32} />
                      <p className="text-sm text-gray-400">
                        Clique ou arraste uma imagem
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Pode ser da câmera ou galeria do dispositivo
                      </p>
                    </>
                  )}
                  <input
                    ref={beforeInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileChange(e, 'beforeFile')}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Upload Depois */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  ✨ Imagem DEPOIS
                </label>
                <div
                  onDrop={(e) => handleDrop(e, 'afterFile')}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => afterInputRef.current?.click()}
                >
                  {formData.afterFile || formData.afterUrl ? (
                    <div className="relative">
                      <img
                        src={getPreviewUrl(formData.afterFile || formData.afterUrl)}
                        alt="Preview Depois"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <p className="text-xs text-green-400 mt-2">
                        ✓ {formData.afterFile ? formData.afterFile.name : 'Imagem atual'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto text-gray-500 mb-2" size={32} />
                      <p className="text-sm text-gray-400">
                        Clique ou arraste uma imagem
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Pode ser da câmera ou galeria do dispositivo
                      </p>
                    </>
                  )}
                  <input
                    ref={afterInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileChange(e, 'afterFile')}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Campos de texto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Título</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="Ex: Polimento Técnico"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Veículo</label>
                  <input
                    type="text"
                    value={formData.car}
                    onChange={(e) => setFormData(prev => ({ ...prev, car: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="Ex: Honda Civic 2020"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">
                    Ordem de Exibição
                    <span className="ml-1 text-xs text-gray-500">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData(prev => ({ ...prev, order: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Menor número aparece primeiro. 0 = ordem padrão.
                  </p>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                      className="w-5 h-5 accent-primary"
                    />
                    <span className="text-sm font-semibold text-gray-300">Ativo (visível no site)</span>
                  </label>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={uploading}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {editing ? 'Atualizar' : 'Criar Item'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}