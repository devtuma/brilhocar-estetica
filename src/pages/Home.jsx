import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, Clock, MapPin, Droplet, Star } from 'lucide-react';

const services = [
  { name: 'Lavagem Técnica', price: 'R$ 80', desc: 'Limpeza minuciosa detalhada.' },
  { name: 'Lavagem Detalhada', price: 'R$ 150', desc: 'Lavagem + cera e plásticos.' },
  { name: 'Polimento Técnico', price: 'R$ 250', desc: 'Remoção de riscos e marcas.' },
  { name: 'Vitrificação', price: 'R$ 800', desc: 'Proteção cerâmica 9H.' },
  { name: 'Higienização Interna', price: 'R$ 200', desc: 'Bancos e painel renovados.' },
  { name: 'Tratamento de Vidros', price: 'R$ 100', desc: 'Remoção de chuva ácida.' },
];

export default function Home() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="text-center mt-12 space-y-8 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-gray-800 text-accent font-semibold text-sm mb-4">
          <Star size={16} /> Estética Automotiva Premium
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
          O Quartel-General pra<br className="hidden md:block"/> quem é chato com o carro.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
          Resultados com qualidade e agilidade. Profissionais especializados e equipamentos de alta tecnologia.
        </p>
        <div className="pt-8">
          <Link to="/booking" className="inline-flex items-center gap-2 bg-primary text-white font-bold text-lg px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(238,34,34,0.3)] hover:bg-red-600 hover:scale-105 transition-all">
            Agende Já <CalendarPlus className="ml-2" />
          </Link>
        </div>
      </section>

      {/* Services Section */}
      <section>
        <h2 className="text-3xl font-black mb-12 text-center">
          <span className="text-accent border-b-2 border-accent pb-2">Catálogo de Serviços</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, i) => (
            <div key={i} className="bg-surface border border-gray-800 p-6 rounded-2xl hover:border-gray-600 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{svc.name}</h3>
                <span className="text-accent font-black">{svc.price}</span>
              </div>
              <p className="text-gray-400 mb-6">{svc.desc}</p>
              <Link to={`/booking?service=${svc.name}`} className="text-sm font-bold text-white bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 w-full block text-center transition-colors">
                Selecionar
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Differentials */}
      <section className="bg-surface border border-gray-800 rounded-3xl p-8 md:p-12">
        <h2 className="text-2xl font-black mb-8 text-center">Nossos Diferenciais</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-gray-900 p-4 rounded-full text-accent"><ShieldCheck size={32}/></div>
            <h4 className="font-bold">Produtos Premium</h4>
            <p className="text-sm text-gray-400">Trabalhamos com linhas de certificação Vonixx e alta tecnologia.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-gray-900 p-4 rounded-full text-accent"><Clock size={32}/></div>
            <h4 className="font-bold">Qualidade & Agilidade</h4>
            <p className="text-sm text-gray-400">Atendimento personalizado focado no melhor resultado no menor tempo.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-gray-900 p-4 rounded-full text-accent"><MapPin size={32}/></div>
            <h4 className="font-bold">Atendimento Delivery</h4>
            <p className="text-sm text-gray-400">Em alguns serviços, atendemos diretamente no local do cliente.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Dummy Icon Component Since it's not imported at top
function CalendarPlus({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/></svg>
}
