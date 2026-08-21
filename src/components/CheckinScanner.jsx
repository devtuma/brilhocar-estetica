import { useState, useEffect, useRef } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Clock, User, Car, QrCode, Loader2, RefreshCw } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function CheckinScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Parar câmera
  const stopCamera = () => {
    console.log('[Scanner] Parando câmera...');
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Iniciar câmera
  const startCamera = async () => {
    setError(null);
    setCameraError(null);
    setScannedData(null);
    setSuccess(null);
    setDebugInfo('Solicitando acesso...');

    try {
      // Verificar suporte
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Navegador não suporta câmera. Use a entrada manual abaixo.');
        setDebugInfo('API não disponível');
        return;
      }

      setDebugInfo('Solicitando stream...');

      // Tentar primeiro com câmera traseira (mobile)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        console.warn('Falha com facingMode environment, tentando qualquer câmera:', err1);
        // Fallback para qualquer câmera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err2) {
          console.error('Falha total ao acessar câmera:', err2);
          throw err2;
        }
      }

      streamRef.current = stream;
      setDebugInfo('Stream obtido, configurando vídeo...');

      // Aguardar o próximo ciclo para garantir que o videoRef está montado
      await new Promise(resolve => setTimeout(resolve, 100));

      if (videoRef.current) {
        const video = videoRef.current;

        // Configurar atributos
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;

        video.srcObject = stream;

        // Forçar play
        try {
          await video.play();
        } catch (playErr) {
          console.warn('Erro no play:', playErr);
        }

        setDebugInfo(`Vídeo: ${video.videoWidth}x${video.videoHeight}, readyState: ${video.readyState}`);
        setIsScanning(true);

        // Aguardar e iniciar scanning
        setTimeout(() => {
          if (video.videoWidth > 0) {
            setDebugInfo(`Escaneando: ${video.videoWidth}x${video.videoHeight}`);
          } else {
            setDebugInfo('⚠️ Vídeo sem dimensões, verifique permissões');
          }
          scanIntervalRef.current = setInterval(scanQRCode, 500);
        }, 500);
      } else {
        setCameraError('Elemento de vídeo não encontrado. Tente novamente.');
        setDebugInfo('videoRef null');
      }

    } catch (err) {
      console.error('[Scanner] Erro ao acessar câmera:', err);
      setDebugInfo(`Erro: ${err.name} - ${err.message}`);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Câmera bloqueada. Clique no ícone de câmera na barra de endereço e permita o acesso. Depois recarregue a página.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Nenhuma câmera encontrada. Conecte uma webcam ou use a entrada manual abaixo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Câmera em uso por outro aplicativo. Feche outros programas e tente novamente.');
      } else if (err.name === 'OverconstrainedError') {
        setCameraError('Câmera não suporta os requisitos. Tente usar a entrada manual abaixo.');
      } else if (err.name === 'SecurityError') {
        setCameraError('Erro de segurança. Verifique se está usando HTTPS.');
      } else {
        setCameraError(`Erro: ${err.message || err.name}. Use a entrada manual abaixo.`);
      }
    }
  };

  // Escanear QR Code
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState < 2) return; // HAVE_CURRENT_DATA
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (window.jsQR) {
        const code = window.jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          console.log('[Scanner] QR detectado:', code.data);
          stopCamera();
          handleScannedCode(code.data);
        }
      }
    } catch (err) {
      console.error('[Scanner] Erro ao processar frame:', err);
    }
  };

  // Processar código escaneado
  const handleScannedCode = async (code) => {
    setScannedData(null);
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const osMatch = code.match(/BC-\d{4}-\d{6}/);
      const appointmentId = osMatch ? null : code;

      if (!osMatch && !appointmentId) {
        setError('QR Code inválido. Este QR Code não pertence a um agendamento.');
        setLoading(false);
        return;
      }

      const findAppointment = httpsCallable(functions, 'findAppointmentByOS');
      const result = await findAppointment({
        os: osMatch ? osMatch[0] : null,
        appointmentId: appointmentId
      });

      if (result.data.success) {
        setScannedData(result.data.appointment);
      } else {
        setError(result.data.error || 'Agendamento não encontrado.');
      }

    } catch (err) {
      console.error('[Scanner] Erro ao buscar agendamento:', err);
      setError(err.message || 'Erro ao processar QR Code.');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar check-in
  const confirmCheckin = async () => {
    if (!scannedData) return;

    setLoading(true);
    setError(null);

    try {
      const appointmentRef = doc(db, 'appointments', scannedData.id);

      const newStatus = scannedData.status === 'Agendado' ? 'Veículo Recebido' : scannedData.status;

      await updateDoc(appointmentRef, {
        status: newStatus,
        checkinAt: serverTimestamp(),
        checkinBy: 'admin',
        updatedAt: serverTimestamp()
      });

      const updateTimeline = httpsCallable(functions, 'addTimelineEntry');
      await updateTimeline({
        appointmentId: scannedData.id,
        status: newStatus,
        note: 'Check-in realizado via Scanner QR Code'
      });

      setSuccess(`Check-in confirmado! Status atualizado para: ${newStatus}`);
      setScannedData(null);

    } catch (err) {
      console.error('[Scanner] Erro ao confirmar check-in:', err);
      setError(err.message || 'Erro ao confirmar check-in.');
    } finally {
      setLoading(false);
    }
  };

  // Cleanup ao desmontar
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Carregar jsQR library
  useEffect(() => {
    if (window.jsQR) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    script.onload = () => console.log('[Scanner] jsQR carregado');
    script.onerror = () => console.error('[Scanner] Falha ao carregar jsQR');
    document.body.appendChild(script);
  }, []);

  // Entrada manual de OS
  const [manualOS, setManualOS] = useState('');

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualOS.trim()) {
      handleScannedCode(manualOS.trim());
      setManualOS('');
    }
  };

  return (
    <div className="bg-surface border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <QrCode className="text-primary" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Check-in via QR Code</h2>
          <p className="text-sm text-gray-400">Escaneie o QR Code do cliente para fazer check-in</p>
        </div>
      </div>

      {/* Câmera */}
      {isScanning ? (
        <div className="relative">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
            {/* Overlay de scanning */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-4 border-primary rounded-2xl relative">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -mt-4">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 -mb-4">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                </div>
                <div className="absolute top-1/2 left-0 -ml-4 -translate-y-1/2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                </div>
                <div className="absolute top-1/2 right-0 -mr-4 -translate-y-1/2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {/* Debug info */}
          {debugInfo && (
            <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 font-mono">
              [DEBUG] {debugInfo}
            </div>
          )}

          <button
            onClick={stopCamera}
            className="mt-4 w-full px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-400 font-semibold rounded-xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <X size={18} />
            Fechar Câmera
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Botão iniciar câmera */}
          <button
            onClick={startCamera}
            disabled={loading}
            className="w-full px-6 py-4 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Camera size={22} />
            Abrir Câmera
          </button>

          {/* Erro de câmera */}
          {cameraError && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-red-400 font-semibold">Erro ao acessar câmera</p>
                  <p className="text-red-300/80 text-sm mt-1">{cameraError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Debug info quando não está escaneando */}
          {debugInfo && !cameraError && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-xs text-blue-300 font-mono">
              [DEBUG] {debugInfo}
            </div>
          )}

          {/* Entrada manual */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-sm text-gray-500">ou digite manualmente</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualOS}
              onChange={(e) => setManualOS(e.target.value.toUpperCase())}
              placeholder="Digite a OS (ex: BC-2026-123456)"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!manualOS.trim()}
              className="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buscar
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="ml-3 text-gray-400">Processando...</span>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-400 font-semibold">Erro</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sucesso */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mt-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-green-400 font-semibold">Sucesso!</p>
              <p className="text-green-300/80 text-sm mt-1">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dados do agendamento encontrado */}
      {scannedData && !loading && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5 mt-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <CheckCircle className="text-primary" size={20} />
            Agendamento Encontrado
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-24">OS:</span>
              <span className="font-mono font-bold text-primary">{scannedData.os}</span>
            </div>

            <div className="flex items-center gap-3">
              <User className="text-gray-500" size={16} />
              <span className="font-semibold">{scannedData.userName || scannedData.name}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-400">{scannedData.userCelular || scannedData.celular}</span>
            </div>

            <div className="flex items-center gap-3">
              <Car className="text-gray-500" size={16} />
              <span>{scannedData.car}</span>
              <span className="text-gray-400">·</span>
              <span className="font-mono">{scannedData.plate}</span>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="text-gray-500" size={16} />
              <span>{scannedData.date}</span>
              <span className="text-gray-400">·</span>
              <span>{scannedData.time}</span>
            </div>

            <div className="pt-3 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Serviços:</p>
              <div className="flex flex-wrap gap-2">
                {(scannedData.services || []).map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-semibold">
                    {typeof s === 'string' ? s : s.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status:</span>
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                  scannedData.status === 'Agendado' ? 'bg-blue-500/20 text-blue-400' :
                  scannedData.status === 'Veículo Recebido' ? 'bg-yellow-500/20 text-yellow-400' :
                  scannedData.status === 'Serviço Iniciado' ? 'bg-orange-500/20 text-orange-400' :
                  scannedData.status === 'Finalizado' ? 'bg-green-500/20 text-green-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {scannedData.status}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-400">Pagamento:</span>
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                  scannedData.pixStatus === 'paid' ? 'bg-green-500/20 text-green-400' :
                  scannedData.pixStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {scannedData.pixStatus === 'paid' ? '✅ Pago' :
                   scannedData.pixStatus === 'pending' ? '⏳ Pendente' : '❌ Não pago'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={confirmCheckin}
            disabled={loading || scannedData.status === 'Veículo Recebido' || scannedData.status === 'Serviço Iniciado'}
            className="w-full mt-5 px-6 py-4 bg-primary text-black font-bold rounded-xl hover:bg-[#00c853] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            <CheckCircle size={20} />
            {scannedData.status === 'Veículo Recebido' || scannedData.status === 'Serviço Iniciado'
              ? 'Check-in Já Realizado'
              : 'Confirmar Check-in'}
          </button>
        </div>
      )}
    </div>
  );
}
