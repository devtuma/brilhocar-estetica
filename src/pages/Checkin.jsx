import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Camera, CheckCircle, Search, AlertCircle } from 'lucide-react';

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
    if (type === 'recebido') msg = `Olá ${scanResult.name}, seu veículo foi recebido pela equipe Clean Car. OS: ${scanResult.os}.`;
    if (type === 'iniciado') msg = `Olá ${scanResult.name}, o serviço ${scanResult.service} foi iniciado.`;
    window.open(`https://wa.me/55${p}?text=${msg}`, '_blank');
  };

  return (
    <div className="max-w-2xl mx-auto mt-8 animate-fade-in-up">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black mb-2 flex justify-center items-center gap-3">
          <Camera className="text-primary" size={36}/> Scanner de Entrada
        </h2>
        <p className="text-gray-400">Escaneie o QR Code do cliente para dar entrada no veículo.</p>
      </div>

      {!scanResult ? (
        <div className="space-y-8">
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.05)] p-4">
            <div id="reader" className="text-black"></div>
          </div>
          
          <form onSubmit={handleManualSearch} className="flex gap-4">
            <input 
              type="text" 
              placeholder="Ex: CC-2026-1234" 
              value={manualOs}
              onChange={e=>setManualOs(e.target.value)}
              className="flex-1 bg-surface border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
            />
            <button type="submit" className="bg-gray-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-700 transition-colors">
              <Search size={20}/> Buscar
            </button>
          </form>
          {error && <div className="text-red-500 flex items-center gap-2 bg-red-500/10 p-4 rounded-xl border border-red-500/20"><AlertCircle/> {error}</div>}
        </div>
      ) : (
        <div className="bg-surface border border-gray-800 rounded-3xl p-8 space-y-6">
          <div className="flex justify-between items-start border-b border-gray-800 pb-6">
            <div>
              <h3 className="text-2xl font-black text-white">{scanResult.os}</h3>
              <p className="text-gray-400 mt-1">{scanResult.name}</p>
              <p className="text-sm font-bold text-accent mt-2">{scanResult.car} • {scanResult.plate}</p>
            </div>
            <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
              <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Status Atual</span>
              <span className={`font-bold ${scanResult.status === 'Agendado' ? 'text-yellow-500' : 'text-green-500'}`}>
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
                className="bg-green-500 text-black font-bold py-4 rounded-xl hover:bg-green-400 transition-colors flex justify-center items-center gap-2"
              >
                <CheckCircle size={20}/> Confirmar Entrada do Veículo
              </button>
            )}
            
            {scanResult.status === 'Veículo Recebido' && (
              <button 
                onClick={() => { updateStatus('Serviço Iniciado'); handleWhatsapp('iniciado'); }}
                disabled={loading}
                className="bg-primary text-white font-bold py-4 rounded-xl hover:bg-red-600 transition-colors"
              >
                Iniciar Serviço
              </button>
            )}

            <button 
              onClick={() => setScanResult(null)}
              className="bg-gray-800 text-white font-bold py-4 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Voltar / Escanear Outro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
