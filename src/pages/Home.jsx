import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Sparkles, Shield, Clock, Star, ArrowRight, Droplets, CarFront, CheckCircle2, Sun, Wrench, Crown } from 'lucide-react';
import { useTexts } from '../hooks/useConfig';
import PromotionBanner from '../components/PromotionBanner';

// Mapa de ícones disponíveis
const ICON_MAP = {
  Sparkles, Shield, Clock, Star, Droplets, CarFront, Sun, Wrench, Crown,
};

export default function Home() {
  const { texts } = useTexts();
  const [services, setServices] = useState([]);

  // Defaults baseados no que está online agora
  const hero = {
    title: texts?.homeHero?.title || 'Devolva o Brilho Original ao seu Veículo.',
    subtitle: texts?.homeHero?.subtitle || 'Tratamento vip para o seu carro com produtos de alta performance.',
    ctaText: texts?.homeHero?.ctaText || 'Agendar Meu Horário',
  };

  // Carregar TODOS os serviços ativos do Firestore em real-time
  useEffect(() => {
    const q = collection(db, 'services');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.active !== false); // só mostra serviços ativos
      // Ordenar: destacados primeiro, depois por ordem, depois alfabético
      data.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
        return (a.name || '').localeCompare(b.name || '');
      });
      setServices(data);
    }, (err) => {
      console.warn('Erro ao carregar serviços:', err);
    });
    return () => unsub();
  }, []);

  const formatDuration = (mins) => {
    if (!mins) return '';
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  };

  return (
    <div className="flex flex-col min-h-screen">

      {/* Banner de Promoção */}
      <PromotionBanner />

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-16 md:pt-24 md:pb-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-gray-800 text-accent text-xs md:text-sm font-bold mb-8 shadow-lg">
            <Star size={16} fill="currentColor" className="pb-0.5" />
            <span className="tracking-wide uppercase">Estética Automotiva Premium em Mauá</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 tracking-tight leading-tight">
            {hero.title.split(' ').slice(0, 3).join(' ')}{' '}
            <span className="text-primary">
              {hero.title.split(' ').slice(3).join(' ') || 'ao seu Veículo.'}
            </span>
          </h1>

          <p className="text-base md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-medium">
            {hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/booking" className="group flex items-center justify-center gap-2 bg-primary hover:bg-[#00c853] text-black font-bold text-lg px-8 py-4 rounded-2xl transition-all duration-300 w-full sm:w-auto shadow-[0_0_30px_rgba(0,230,118,0.3)] hover:shadow-[0_0_40px_rgba(0,230,118,0.5)] hover:-translate-y-1">
              {hero.ctaText}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="https://wa.me/5511981312143" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-surface hover:bg-gray-800 border border-gray-700 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all duration-300 w-full sm:w-auto hover:-translate-y-1">
              Falar no WhatsApp
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-gray-400">
            <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-primary"/> Produtos Premium</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-primary"/> Acompanhamento Online</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-primary"/> Equipe Especializada</div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION - DINÂMICO */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Nossos <span className="text-primary">Serviços</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto font-medium">Tudo que seu carro precisa para se destacar nas ruas, com a máxima qualidade e cuidado que ele merece.</p>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Sparkles size={48} className="mx-auto mb-3 text-gray-600" />
              <p>Em breve os serviços disponíveis serão listados aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map(service => {
                const IconComp = ICON_MAP[service.icon] || Sparkles;
                const isHighlight = service.featured;
                const isAccent = service.highlightColor === 'accent';

                return (
                  <div
                    key={service.id}
                    className={`group bg-surface border rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 ${
                      isHighlight
                        ? 'border-accent/30 hover:border-accent hover:shadow-[0_10px_40px_rgba(212,175,55,0.15)]'
                        : 'border-gray-800 hover:border-primary/50 hover:shadow-[0_10px_40px_rgba(0,230,118,0.1)]'
                    }`}
                  >
                    {isHighlight && (
                      <div className="absolute" />
                    )}
                    {service.featured && (
                      <div className="absolute top-0 right-0 bg-accent text-black text-[10px] uppercase tracking-wider font-black px-4 py-1.5 rounded-bl-xl">
                        ⭐ Destaque
                      </div>
                    )}

                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${
                      isAccent || service.featured ? 'bg-accent/10' : 'bg-gray-900'
                    }`}>
                      <IconComp
                        size={28}
                        className={isAccent || service.featured ? 'text-accent' : 'text-primary'}
                      />
                    </div>

                    <h3 className="text-xl font-bold mb-3 text-white">{service.name}</h3>
                    {service.description && (
                      <p className="text-gray-400 text-sm mb-6 leading-relaxed line-clamp-3">
                        {service.description}
                      </p>
                    )}

                    <div className="flex items-end justify-between mt-auto pt-2">
                      <div>
                        <p className={`font-bold text-lg ${isAccent || service.featured ? 'text-accent' : 'text-white'}`}>
                          a partir de R$ {(service.basePrice || 0).toFixed(2)}
                        </p>
                        {service.duration && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Clock size={12} /> {formatDuration(service.duration)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Ver todos e agendar <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY US SECTION */}
      <section className="py-20 px-4 bg-[#08080b] border-y border-gray-800/50 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 lg:gap-20 items-center">
          <div className="flex-1 space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold leading-tight">Por que escolher a <br/><span className="text-primary">BrilhoCar</span>?</h2>

            <div className="space-y-8">
              <div className="flex gap-5">
                <div className="mt-1 w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Star size={26}/></div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Qualidade Obsessiva</h4>
                  <p className="text-gray-400 text-sm md:text-base leading-relaxed">Não pulamos etapas. Utilizamos iluminação especial e técnicas avançadas para garantir que cada centímetro da pintura esteja perfeito.</p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="mt-1 w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Clock size={26}/></div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Acompanhamento em Tempo Real</h4>
                  <p className="text-gray-400 text-sm md:text-base leading-relaxed">Pelo nosso sistema exclusivo de QR Code, você acompanha o status do seu carro do momento que ele entra até a entrega.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-full pointer-events-none"></div>
            <div className="bg-surface rounded-3xl p-8 border border-gray-800 shadow-2xl relative z-10">
              <div className="absolute -top-5 -right-4 bg-accent text-black font-black px-6 py-2 rounded-xl rotate-3 shadow-xl">
                4.9/5 no Google ★
              </div>
              <h3 className="text-2xl font-bold mb-8 border-b border-gray-800 pb-4">O que dizem os clientes</h3>
              <div className="space-y-6">
                <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-gray-800/50">
                  <div className="flex text-accent mb-3 gap-1">
                    <Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/>
                  </div>
                  <p className="text-sm md:text-base italic text-gray-300 mb-3 leading-relaxed">"Levei meu Civic para polimento e fiquei impressionado. A pintura ficou como saída de fábrica. Profissionalismo total."</p>
                  <p className="text-xs md:text-sm font-bold text-primary">— Marcos A.</p>
                </div>
                <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-gray-800/50">
                  <div className="flex text-accent mb-3 gap-1">
                    <Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/>
                  </div>
                  <p className="text-sm md:text-base italic text-gray-300 mb-3 leading-relaxed">"Fiz a vitrificação e 8 meses depois o carro continua com brilho incrível. Serviço de altíssima qualidade!"</p>
                  <p className="text-xs md:text-sm font-bold text-primary">— Rodrigo S.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-5xl font-black mb-6">Pronto para transformar seu carro?</h2>
          <p className="text-gray-400 text-lg mb-10">Agende seu horário online agora mesmo e garanta o melhor tratamento. As vagas da semana são limitadas.</p>
          <Link to="/booking" className="inline-flex items-center justify-center gap-3 bg-primary hover:bg-[#00c853] text-black font-black text-lg md:text-xl px-12 py-5 rounded-2xl transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(0,230,118,0.4)] hover:shadow-[0_0_60px_rgba(0,230,118,0.6)]">
            Agendar Serviço Agora
            <ArrowRight size={24} />
          </Link>
        </div>
      </section>

    </div>
  );
}
