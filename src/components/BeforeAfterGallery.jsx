import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';

export default function BeforeAfterGallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    const q = collection(db, 'gallery');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => item.active !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setItems(data);
      setLoading(false);
    }, (err) => {
      console.warn('Erro ao carregar galeria:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const next = () => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex + 1) % items.length);
  };

  const prev = () => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex - 1 + items.length) % items.length);
  };

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null; // Não mostra a seção se não houver itens
  }

  return (
    <section className="py-20 px-4 bg-[#08080b] border-y border-gray-800/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Antes & <span className="text-primary">Depois</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Veja a transformação dos veículos que passaram pelas nossas mãos.
            Clique para ver o detalhe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => setActiveIndex(idx)}
              className="group cursor-pointer bg-surface border border-gray-800 rounded-3xl overflow-hidden hover:border-primary/50 transition-all"
            >
              <div className="grid grid-cols-2">
                <div className="relative aspect-square">
                  <img
                    src={item.beforeUrl}
                    alt="Antes"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded">
                    Antes
                  </div>
                </div>
                <div className="relative aspect-square">
                  <img
                    src={item.afterUrl}
                    alt="Depois"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded">
                    Depois
                  </div>
                </div>
              </div>
              {item.title && (
                <div className="p-4">
                  <p className="font-bold text-white text-sm">{item.title}</p>
                  {item.car && (
                    <p className="text-xs text-gray-400 mt-1">{item.car}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Modal Lightbox */}
        {activeIndex !== null && items[activeIndex] && (
          <div
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
            onClick={() => setActiveIndex(null)}
          >
            <button
              onClick={() => setActiveIndex(null)}
              className="absolute top-4 right-4 text-white hover:text-primary p-2"
            >
              <X size={32} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
            >
              <ChevronLeft size={32} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
            >
              <ChevronRight size={32} />
            </button>

            <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="relative">
                  <img
                    src={items[activeIndex].beforeUrl}
                    alt="Antes"
                    className="w-full rounded-2xl"
                  />
                  <div className="absolute top-4 left-4 bg-red-500/90 text-white text-sm uppercase tracking-wider font-black px-4 py-2 rounded">
                    Antes
                  </div>
                </div>
                <div className="relative">
                  <img
                    src={items[activeIndex].afterUrl}
                    alt="Depois"
                    className="w-full rounded-2xl"
                  />
                  <div className="absolute top-4 right-4 bg-green-500/90 text-white text-sm uppercase tracking-wider font-black px-4 py-2 rounded">
                    Depois
                  </div>
                </div>
              </div>
              {items[activeIndex].title && (
                <p className="text-center text-white font-bold text-xl mt-6">
                  {items[activeIndex].title}
                </p>
              )}
              {items[activeIndex].car && (
                <p className="text-center text-gray-400 mt-2">
                  {items[activeIndex].car}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}