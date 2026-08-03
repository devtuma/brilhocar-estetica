import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function Checkin() {
  const [scanResult, setScanResult] = useState(null);
  const [manualOs, setManualOs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Prevent multiple initializations in React strict mode
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    
    scanner.render((decodedText) => {
      try {
        const data = JSON.parse(decodedText);
        if (data.id) {
          scanner.clear();
          fetchAppointment(data.id);
        }
      } catch (err) {
        // Se não for JSON, tentamos buscar a OS direto (caso usem outro formato legado)
        scanner.clear();
        searchByOs(decodedText);
      }
    }, (error) => {
      // ignore scanning errors
    });

    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);

  const fetchAppointment = async (id) => {
    setLoading(true);
    setError('');
    try {
      const docRef = doc(db, 'appointments', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setScanResult({ id: docSnap.id, ...docSnap.data() });
      } else {
        setError('Agendamento não encontrado no banco de dados.');
      }
    } catch (err) {
      setError('Erro ao buscar dados do Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const searchByOs = async (osNumber) => {
    // Em um cenário real com muitos dados, usariamos uma query(collection(db, 'appointments'), where('os', '==', osNumber))
    // Aqui faremos simples para o MVP
    setError('Busca manual ainda requer adaptação no backend.');
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualOs.trim()) return;
    searchByOs(manualOs.trim());
  };

  const updateStatus = async (newStatus) => {
    if (!scanResult) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'appointments', scanResult.id);
      await updateDoc(docRef, {
        status: newStatus,
        timeline: arrayUnion({ status: newStatus, date: new Date().toISOString() })
      });
      setScanResult({ ...scanResult, status: newStatus });
    } catch (err) {
      setError('Erro ao atualizar status.');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsapp = (type) => {
    if (!scanResult) return;
    const p = scanResult.phone.replace(/\D/g, '');
    let msg = '';
    if (type === 'recebido') msg = `Olá ${scanResult.name}, seu veículo foi recebido pela equipe BrilhoCar. OS: ${scanResult.os}.`;
    if (type === 'iniciado') msg = `Olá ${scanResult.name}, o serviço ${scanResult.service} foi iniciado.`;
    window.open(`https://wa.me/55${p}?text=${msg}`, '_blank');
  };

  return (
    <div className="max-w-6xl pt-4 md:pt-8 pb-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Check-in por QR Code</h2>
      <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">Escaneie o QR do cliente para dar entrada no veículo.</p>

      {!scanResult ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Scanner column */}
          <div className="border border-gray-800 bg-[#0b0b0f] rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
            <div id="reader" className="w-full text-black bg-white rounded-lg z-10"></div>
            {/* Fallback mock UI underneath just to match design while loading/idle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-primary w-48 h-48 flex items-center justify-center opacity-30">
                <span className="text-white font-bold opacity-100">Leitor QR Code</span>
              </div>
            </div>
          </div>
          
          {/* Search column */}
          <div className="flex flex-col gap-6">
            <form onSubmit={handleManualSearch} className="space-y-4">
              <input 
                type="text" 
                placeholder="Ex: CC-2026-000001" 
                value={manualOs}
                onChange={e=>setManualOs(e.target.value)}
                className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500"
              />
              <button type="submit" className="bg-primary text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#00c853] transition-colors inline-block">
                Buscar OS
              </button>
            </form>
            {error && <div className="text-red-500 flex items-center gap-2 bg-red-500/10 p-4 rounded-xl border border-red-500/20"><AlertCircle/> {error}</div>}

            <div className="border border-gray-800 rounded-xl p-6 bg-[#0b0b0f] mt-auto">
              <h3 className="text-xl font-bold mb-2">Dar entrada no veículo</h3>
              <p className="text-sm font-semibold text-primary">Status: Aguardando OS</p>
            </div>
          </div>

        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl p-8 bg-[#0b0b0f] space-y-6 max-w-2xl">
          <div className="flex justify-between items-start border-b border-gray-800 pb-6">
            <div>
              <h3 className="text-2xl font-black text-white">{scanResult.os}</h3>
              <p className="text-gray-400 mt-1">{scanResult.name}</p>
              <p className="text-sm font-bold text-gray-300 mt-2">{scanResult.car} • {scanResult.plate}</p>
            </div>
            <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
              <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Status Atual</span>
              <span className={`font-bold ${scanResult.status === 'Agendado' ? 'text-yellow-500' : 'text-primary'}`}>
                {scanResult.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong className="text-gray-500 block">Serviço</strong> {scanResult.service}</div>
            <div><strong className="text-gray-500 block">Agendado para</strong> {scanResult.date} às {scanResult.time}</div>
          </div>

          <div className="pt-6 border-t border-gray-800 flex flex-col gap-4">
            {scanResult.status === 'Agendado' && (
              <button 
                onClick={() => { updateStatus('Veículo Recebido'); handleWhatsapp('recebido'); }}
                disabled={loading}
                className="bg-primary text-black font-bold py-4 rounded-xl hover:bg-[#00c853] transition-colors flex justify-center items-center gap-2"
              >
                <CheckCircle size={20}/> Confirmar Entrada do Veículo
              </button>
            )}
            
            {scanResult.status === 'Veículo Recebido' && (
              <button 
                onClick={() => { updateStatus('Serviço Iniciado'); handleWhatsapp('iniciado'); }}
                disabled={loading}
                className="bg-yellow-500 text-black font-bold py-4 rounded-xl hover:bg-yellow-400 transition-colors"
              >
                Iniciar Serviço
              </button>
            )}

            <button 
              onClick={() => setScanResult(null)}
              className="bg-transparent border border-gray-600 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              Voltar / Escanear Outro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
