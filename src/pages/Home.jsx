import { Link } from 'react-router-dom';
import { Sparkles, Shield, Clock, Star, ArrowRight, Droplets, CarFront, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      
      {/* HERO SECTION */}
      <section className="relative pt-12 pb-16 md:pt-24 md:pb-24 overflow-hidden">
        {/* Abstract background effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-gray-800 text-accent text-xs md:text-sm font-bold mb-8 shadow-lg">
            <Star size={16} fill="currentColor" className="pb-0.5" />
            <span className="tracking-wide uppercase">Estética Automotiva Premium em Mauá</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 tracking-tight leading-tight">
            Devolva o <span className="text-primary">Brilho Original</span> ao seu Veículo.
          </h1>
          
          <p className="text-base md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-medium">
            Tratamento vip para o seu carro com produtos de alta performance. 
            Do polimento à vitrificação, cuidamos de cada detalhe para um resultado impecável.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/booking" className="group flex items-center justify-center gap-2 bg-primary hover:bg-[#00c853] text-black font-bold text-lg px-8 py-4 rounded-2xl transition-all duration-300 w-full sm:w-auto shadow-[0_0_30px_rgba(0,230,118,0.3)] hover:shadow-[0_0_40px_rgba(0,230,118,0.5)] hover:-translate-y-1">
              Agendar Meu Horário
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-surface hover:bg-gray-800 border border-gray-700 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all duration-300 w-full sm:w-auto hover:-translate-y-1">
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

      {/* SERVICES SECTION */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Nossos <span className="text-primary">Serviços</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto font-medium">Tudo que seu carro precisa para se destacar nas ruas, com a máxima qualidade e cuidado que ele merece.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Service 1 */}
            <div className="group bg-surface border border-gray-800 hover:border-primary/50 rounded-3xl p-8 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(0,230,118,0.1)] hover:-translate-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Droplets className="text-primary" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Lavagem Técnica</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">Limpeza detalhada e segura, removendo sujeiras profundas sem agredir a pintura. Inclui aspiração e acabamento premium.</p>
              <div className="font-bold text-lg text-white">a partir de R$ 80</div>
            </div>

            {/* Service 2 */}
            <div className="group bg-surface border border-gray-800 hover:border-primary/50 rounded-3xl p-8 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(0,230,118,0.1)] hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accent text-black text-[10px] uppercase tracking-wider font-black px-4 py-1.5 rounded-bl-xl">Mais Popular</div>
              <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="text-primary" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Polimento Técnico</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">Correção de verniz, remoção de micro-riscos e hologramas. Traz de volta o brilho espelhado que seu carro tinha na loja.</p>
              <div className="font-bold text-lg text-white">a partir de R$ 250</div>
            </div>

            {/* Service 3 */}
            <div className="group bg-surface border border-accent/30 hover:border-accent rounded-3xl p-8 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(212,175,55,0.15)] hover:-translate-y-2">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="text-accent" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Vitrificação Cerâmica</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">A proteção máxima para a pintura. Cria uma camada ultra resistente contra riscos, raios UV e sujeira, durando até 3 anos.</p>
              <div className="font-bold text-accent text-lg">a partir de R$ 800</div>
            </div>
            
            {/* Service 4 */}
            <div className="group bg-surface border border-gray-800 hover:border-primary/50 rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 lg:col-start-2">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CarFront className="text-primary" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Higienização Interna</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">Limpeza profunda de bancos, teto, carpetes e painel. Eliminação de odores, ácaros e bactérias para respirar ar puro.</p>
              <div className="font-bold text-lg text-white">a partir de R$ 200</div>
            </div>

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

