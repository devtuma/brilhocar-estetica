import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Car, Plus, X, Loader2 } from 'lucide-react';

export default function VehiclePicker({ isOpen, onClose, onSelect, selectedCarId }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCar, setNewCar] = useState({ modelo: '', placa: '', cor: '', ano: '', apelido: '' });

  useEffect(() => {
    if (!isOpen) return;
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const carsRef = collection(db, 'users', user.uid, 'cars');
    const q = query(carsRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCars(docs);
      setLoading(false);
    }, (err) => {
      console.error('Erro ao buscar carros:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setShowForm(false);
      setNewCar({ modelo: '', placa: '', cor: '', ano: '', apelido: '' });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveNew = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    if (!newCar.modelo.trim() || !newCar.placa.trim()) {
      alert('Modelo e Placa são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const carsRef = collection(db, 'users', user.uid, 'cars');
      const docRef = await addDoc(carsRef, {
        modelo: newCar.modelo.trim(),
        placa: newCar.placa.trim().toUpperCase(),
        cor: newCar.cor.trim() || null,
        ano: newCar.ano ? parseInt(newCar.ano) : null,
        apelido: newCar.apelido.trim() || null,
        isPrimary: cars.length === 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const newCarData = {
        id: docRef.id,
        modelo: newCar.modelo.trim(),
        placa: newCar.placa.trim().toUpperCase(),
        cor: newCar.cor.trim() || null,
        ano: newCar.ano ? parseInt(newCar.ano) : null,
        apelido: newCar.apelido.trim() || null,
      };

      setNewCar({ modelo: '', placa: '', cor: '', ano: '', apelido: '' });
      setShowForm(false);
      onSelect(newCarData);
    } catch (err) {
      console.error('Erro ao salvar carro:', err);
      alert('Erro ao cadastrar carro. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-surface border border-gray-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-full p-2 transition-colors"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-3">
            <Car className="text-primary" size={24} />
          </div>
          <h3 className="text-xl font-black text-white">Qual carro?</h3>
          <p className="text-sm text-gray-400 mt-1">Selecione um carro salvo ou cadastre um novo</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="animate-spin text-primary mb-3" size={32} />
            <p className="text-gray-400 text-sm">Carregando seus carros...</p>
          </div>
        ) : showForm ? (
          <form onSubmit={handleSaveNew} className="space-y-3">
            <div className="text-left">
              <label className="block text-xs font-bold text-gray-400 mb-1">Modelo *</label>
              <input
                required
                type="text"
                value={newCar.modelo}
                onChange={e => setNewCar({ ...newCar, modelo: e.target.value })}
                className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500"
                placeholder="Ex: HB20"
                autoFocus
              />
            </div>
            <div className="text-left">
              <label className="block text-xs font-bold text-gray-400 mb-1">Placa *</label>
              <input
                required
                type="text"
                value={newCar.placa}
                onChange={e => setNewCar({ ...newCar, placa: e.target.value.toUpperCase() })}
                maxLength={8}
                className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary uppercase placeholder-gray-500"
                placeholder="ABC1D23"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-400 mb-1">Cor</label>
                <input
                  type="text"
                  value={newCar.cor}
                  onChange={e => setNewCar({ ...newCar, cor: e.target.value })}
                  className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500"
                  placeholder="Prata"
                />
              </div>
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-400 mb-1">Ano</label>
                <input
                  type="number"
                  min="1900"
                  max="2099"
                  value={newCar.ano}
                  onChange={e => setNewCar({ ...newCar, ano: e.target.value })}
                  className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500"
                  placeholder="2022"
                />
              </div>
            </div>
            <div className="text-left">
              <label className="block text-xs font-bold text-gray-400 mb-1">Apelido (opcional)</label>
              <input
                type="text"
                value={newCar.apelido}
                onChange={e => setNewCar({ ...newCar, apelido: e.target.value })}
                className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500"
                placeholder="Carro do dia"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-transparent border border-gray-700 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary text-black font-bold py-3 rounded-xl hover:bg-[#00c853] transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {cars.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">Você ainda não tem carros cadastrados.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {cars.map(car => (
                  <button
                    key={car.id}
                    onClick={() => onSelect(car)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                      selectedCarId === car.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div>
                      <p className={`font-bold ${selectedCarId === car.id ? 'text-primary' : 'text-white'}`}>
                        {car.modelo} {car.apelido && <span className="text-gray-400 text-sm font-normal">({car.apelido})</span>}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {car.placa} {car.cor && `· ${car.cor}`} {car.ano && `· ${car.ano}`}
                      </p>
                    </div>
                    {car.isPrimary && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">
                        Principal
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-gradient-to-r from-primary to-[#00c853] text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Plus size={20} strokeWidth={3} /> Cadastrar novo carro
            </button>
          </>
        )}
      </div>
    </div>
  );
}
