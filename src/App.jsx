import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Booking from './pages/Booking';
import Checkin from './pages/Checkin';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-white font-sans">
        {/* Topbar */}
        <header className="sticky top-0 z-50 flex justify-between items-center px-6 py-4 bg-surface border-b border-gray-800 shadow-xl">
          <Link to="/" className="text-2xl font-black tracking-tight">
            <span className="text-primary">Brilho</span>Car
          </Link>
          <nav className="hidden md:flex gap-3">
            <Link to="/" className="border border-gray-800 bg-[#0b0b0f] hover:bg-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg">Início</Link>
            <Link to="/booking" className="border border-gray-800 bg-[#0b0b0f] hover:bg-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg">Agendar</Link>
            <Link to="/admin" className="border border-gray-800 bg-[#0b0b0f] hover:bg-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg">Painel</Link>
            <Link to="/checkin" className="border border-gray-800 bg-[#0b0b0f] hover:bg-gray-800 transition-colors text-sm font-semibold px-4 py-1.5 rounded-lg">Check-in QR</Link>
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
      </div>
    </BrowserRouter>
  );
}

export default App;
