import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col max-w-4xl pt-8">
      <h1 className="text-4xl font-bold mb-2">BrilhoCar</h1>
      <p className="text-gray-400 mb-12">
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

      <div>
        <Link to="/booking" className="inline-block bg-primary hover:bg-[#00c853] text-black font-semibold px-6 py-3 rounded-md transition-colors">
          Agendar serviço
        </Link>
      </div>
    </div>
  );
}
