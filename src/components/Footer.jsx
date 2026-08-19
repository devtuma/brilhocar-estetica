import { useTexts } from '../hooks/useConfig';
import { MapPin, Phone, Instagram, Facebook, Mail, MessageCircle } from 'lucide-react';

export default function Footer() {
  const { texts } = useTexts();

  // SEMPRE usar defaults se vazio, pra nunca aparecer "Rua Exemplo"
  const defaults = {
    address: 'R. Pindamonhangaba, 178',
    phone: '11981312143',
    whatsapp: '5511981312143',
    instagram: '@brilhocar',
    facebook: 'BrilhoCar',
    email: 'contato@brilhocar.com',
  };

  const footer = {
    address: texts?.footer?.address || defaults.address,
    phone: texts?.footer?.phone || defaults.phone,
    whatsapp: texts?.footer?.whatsapp || defaults.whatsapp,
    instagram: texts?.footer?.instagram || defaults.instagram,
    facebook: texts?.footer?.facebook || defaults.facebook,
    email: texts?.footer?.email || defaults.email,
  };

  const whatsappLink = footer.whatsapp
    ? `https://wa.me/${String(footer.whatsapp).replace(/\D/g, '')}`
    : '#';
  const instagramLink = footer.instagram
    ? `https://instagram.com/${footer.instagram.replace('@', '')}`
    : '#';
  const facebookLink = footer.facebook
    ? `https://facebook.com/${footer.facebook}`
    : '#';
  const emailLink = footer.email ? `mailto:${footer.email}` : '#';

  return (
    <footer className="bg-surface border-t border-gray-800 mt-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sobre */}
          <div>
            <h3 className="text-xl font-black text-white mb-3">
              <span className="text-primary">Brilho</span>Car
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Estética automotiva premium. Devolvemos o brilho original do seu veículo
              com produtos de alta performance e equipe especializada.
            </p>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Contato
            </h4>
            <ul className="space-y-3 text-sm">
              {footer.address && (
                <li className="flex items-start gap-2 text-gray-300">
                  <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                  <span>{footer.address}</span>
                </li>
              )}
              {footer.phone && (
                <li className="flex items-center gap-2 text-gray-300">
                  <Phone size={16} className="text-primary shrink-0" />
                  <span>{footer.phone}</span>
                </li>
              )}
              {footer.email && (
                <li>
                  <a
                    href={emailLink}
                    className="flex items-center gap-2 text-gray-300 hover:text-primary transition-colors"
                  >
                    <Mail size={16} className="text-primary shrink-0" />
                    <span>{footer.email}</span>
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Redes sociais */}
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Redes Sociais
            </h4>
            <div className="flex flex-col gap-3">
              {footer.whatsapp && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-gray-300 hover:text-[#25D366] transition-colors text-sm"
                >
                  <MessageCircle size={18} className="text-[#25D366]" />
                  WhatsApp
                </a>
              )}
              {footer.instagram && (
                <a
                  href={instagramLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-gray-300 hover:text-primary transition-colors text-sm"
                >
                  <Instagram size={18} className="text-primary" />
                  {footer.instagram}
                </a>
              )}
              {footer.facebook && (
                <a
                  href={facebookLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-gray-300 hover:text-primary transition-colors text-sm"
                >
                  <Facebook size={18} className="text-primary" />
                  {footer.facebook}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} BrilhoCar Estética Automotiva. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
