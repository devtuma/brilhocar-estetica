import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home as HomeIcon, CalendarPlus, LayoutDashboard, QrCode, Search, LogOut } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Home from './pages/Home';
import Booking from './pages/Booking';
import Checkin from './pages/Checkin';
import Admin from './pages/Admin';
import AdminSiteTexts from './pages/admin/SiteTexts';
import AdminPromotions from './pages/admin/Promotions';
import AdminPixConfig from './pages/admin/PixConfig';
import Login from './pages/Login';
import Track from './pages/Track';
import ClientLogin from './pages/ClientLogin';
import Signup from './pages/Signup';
import PagamentoPix from './pages/PagamentoPix';
import ProtectedRoute from './components/ProtectedRoute';
import ClientProtectedRoute from './components/ClientProtectedRoute';

function ClientLayout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background text-white font-sans pb-24 md:pb-0">
      <header className="sticky top-0 z-50 flex justify-between items-center px-4 md:px-6 py-4 bg-surface border-b border-gray-800 shadow-xl">
        <Link to="/" className="text-xl md:text-2xl font-black tracking-tight">
          <span className="text-primary">Brilho</span>Car
        </Link>
        <nav className="hidden md:flex gap-3 items-center">
          <Link to="/" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Início</Link>
          <Link to="/booking" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/booking') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Agendar</Link>
          <Link to="/track" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/track') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Acompanhar</Link>
          {user && (
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors ml-4 flex items-center gap-2 text-sm font-semibold" title="Sair">
              <LogOut size={18}/>
              <span className="hidden lg:inline">Sair</span>
            </button>
          )}
        </nav>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 flex justify-around items-center p-3 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-primary' : 'text-gray-400'}`}>
          <HomeIcon size={20} />
          <span className="text-[10px] font-bold">Início</span>
        </Link>
        <Link to="/booking" className={`flex flex-col items-center gap-1 ${isActive('/booking') ? 'text-primary' : 'text-gray-400'}`}>
          <CalendarPlus size={20} />
          <span className="text-[10px] font-bold">Agendar</span>
        </Link>
        <Link to="/track" className={`flex flex-col items-center gap-1 ${isActive('/track') ? 'text-primary' : 'text-gray-400'}`}>
          <Search size={20} />
          <span className="text-[10px] font-bold">Acompanhar</span>
        </Link>
        {user && (
          <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500">
            <LogOut size={20} />
            <span className="text-[10px] font-bold">Sair</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-20 md:pb-0 border-t-4 border-primary">
      <header className="sticky top-0 z-50 flex justify-between items-center px-4 md:px-6 py-4 bg-surface border-b border-gray-800 shadow-xl">
        <Link to="/admin" className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
          <span className="text-primary">Admin</span>
        </Link>
        <nav className="hidden md:flex gap-3 items-center">
          <Link to="/admin" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/admin') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Painel</Link>
          <Link to="/checkin" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/checkin') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Scanner QR</Link>
          {user && (
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors ml-4 flex items-center gap-2 text-sm font-semibold">
              <LogOut size={20}/>
              <span className="hidden lg:inline">Sair</span>
            </button>
          )}
        </nav>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 flex justify-around items-center p-3 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <Link to="/admin" className={`flex flex-col items-center gap-1 ${isActive('/admin') ? 'text-primary' : 'text-gray-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold">Painel</span>
        </Link>
        <Link to="/checkin" className={`flex flex-col items-center gap-1 ${isActive('/checkin') ? 'text-primary' : 'text-gray-400'}`}>
          <QrCode size={20} />
          <span className="text-[10px] font-bold">Scanner</span>
        </Link>
        {user && (
          <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500">
            <LogOut size={20} />
            <span className="text-[10px] font-bold">Sair</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/" element={<ClientLayout><Home /></ClientLayout>} />
        <Route path="/client-login" element={<ClientLayout><ClientLogin /></ClientLayout>} />
        <Route path="/signup" element={<ClientLayout><Signup /></ClientLayout>} />
        <Route path="/login" element={<Login />} />

        {/* Rotas Privadas (Clientes) */}
        <Route path="/booking" element={<ClientProtectedRoute><ClientLayout><Booking /></ClientLayout></ClientProtectedRoute>} />
        <Route path="/pagamento/:id" element={<ClientProtectedRoute><ClientLayout><PagamentoPix /></ClientLayout></ClientProtectedRoute>} />
        <Route path="/track" element={<ClientProtectedRoute><ClientLayout><Track /></ClientLayout></ClientProtectedRoute>} />

        {/* Rotas Privadas (Admin/Operador) */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout><Admin /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/textos" element={<ProtectedRoute><AdminLayout><AdminSiteTexts /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/promocoes" element={<ProtectedRoute><AdminLayout><AdminPromotions /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/pix" element={<ProtectedRoute><AdminLayout><AdminPixConfig /></AdminLayout></ProtectedRoute>} />
        <Route path="/checkin" element={<ProtectedRoute><AdminLayout><Checkin /></AdminLayout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
