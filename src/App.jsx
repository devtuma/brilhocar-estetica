import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, CalendarPlus, LayoutDashboard, QrCode } from 'lucide-react';
import Home from './pages/Home';
import Booking from './pages/Booking';
import Checkin from './pages/Checkin';
import Admin from './pages/Admin';

function AppContent() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background text-white font-sans pb-20 md:pb-0">
      {/* Topbar */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-4 md:px-6 py-4 bg-surface border-b border-gray-800 shadow-xl">
        <Link to="/" className="text-xl md:text-2xl font-black tracking-tight">
          <span className="text-primary">Brilho</span>Car
        </Link>
        <nav className="hidden md:flex gap-3">
          <Link to="/" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Início</Link>
          <Link to="/booking" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/booking') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Agendar</Link>
          <Link to="/admin" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/admin') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Painel</Link>
          <Link to="/checkin" className={`border border-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg ${isActive('/checkin') ? 'bg-gray-800 text-primary' : 'bg-[#0b0b0f] hover:bg-gray-800'}`}>Check-in QR</Link>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 flex justify-around items-center p-3 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-primary' : 'text-gray-400'}`}>
          <HomeIcon size={20} />
          <span className="text-[10px] font-bold">Início</span>
        </Link>
        <Link to="/booking" className={`flex flex-col items-center gap-1 ${isActive('/booking') ? 'text-primary' : 'text-gray-400'}`}>
          <CalendarPlus size={20} />
          <span className="text-[10px] font-bold">Agendar</span>
        </Link>
        <Link to="/checkin" className={`flex flex-col items-center gap-1 ${isActive('/checkin') ? 'text-primary' : 'text-gray-400'}`}>
          <QrCode size={20} />
          <span className="text-[10px] font-bold">Check-in</span>
        </Link>
        <Link to="/admin" className={`flex flex-col items-center gap-1 ${isActive('/admin') ? 'text-primary' : 'text-gray-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold">Painel</span>
        </Link>
      </nav>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
