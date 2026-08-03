import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col max-w-4xl pt-4 md:pt-8">
      <h1 className="text-3xl md:text-5xl font-bold mb-2">BrilhoCar</h1>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">
        Sistema de atendimento, agendamento, QR Code, acompanhamento e WhatsApp.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="border border-gray-800 rounded-lg p-6 bg-transparent text-gray-300 font-semibold">
          Lavagem Técnica
        </div>
        <div className="border border-gray-800 rounded-lg p-6 bg-transparent text-gray-300 font-semibold">
          Polimento
        </div>
        <div className="border border-gray-800 rounded-lg p-6 bg-transparent text-gray-300 font-semibold">
          Vitrificação
        </div>
        <div className="border border-gray-800 rounded-lg p-6 bg-transparent text-gray-300 font-semibold">
          Higienização Interna
        </div>
        <div className="border border-gray-800 rounded-lg p-6 bg-transparent text-gray-300 font-semibold">
          Revitalização de Farol
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/booking" className="text-center bg-primary hover:bg-[#00c853] text-black font-semibold px-6 py-4 rounded-xl transition-colors">
          Agendar Serviço
        </Link>
        <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="text-center bg-[#25D366] hover:bg-[#1DA851] text-white font-semibold px-6 py-4 rounded-xl transition-colors">
          Falar no WhatsApp
        </a>
        <Link to="/track" className="text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-4 rounded-xl transition-colors">
          Acompanhar Veículo
        </Link>
      </div>
    </div>
  );
}
