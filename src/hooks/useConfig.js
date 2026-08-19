import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Hook para buscar configurações do CMS (textos, promoções, etc.)
 * @param {string} section - Seção específica (ex: 'texts', 'activePromotion')
 *                          - Se não passar, busca tudo
 */
export function useConfig(section = null) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!section) {
      // Buscar documento único 'config'
      const unsub = onSnapshot(
        doc(db, 'config', 'main'),
        (docSnap) => {
          if (docSnap.exists()) {
            setConfig(docSnap.data());
          } else {
            setConfig(getDefaultConfig());
          }
          setLoading(false);
        },
        (err) => {
          console.error('Erro ao buscar config:', err);
          setError(err);
          setLoading(false);
        }
      );
      return () => unsub();
    } else {
      // Buscar subdocumento específico
      const unsub = onSnapshot(
        doc(db, 'config', section),
        (docSnap) => {
          if (docSnap.exists()) {
            setConfig(docSnap.data());
          } else {
            setConfig(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Erro ao buscar config:', err);
          setError(err);
          setLoading(false);
        }
      );
      return () => unsub();
    }
  }, [section]);

  return { config, loading, error };
}

/**
 * Hook otimizado para buscar textos específicos
 */
export function useTexts() {
  const { config, loading, error } = useConfig();
  return {
    texts: config?.texts || getDefaultTexts(),
    loading,
    error
  };
}

/**
 * Hook para buscar promoção ativa
 */
export function useActivePromotion() {
  const { config, loading, error } = useConfig();

  const activePromotion = config?.activePromotion;
  const isValid = activePromotion?.enabled &&
    activePromotion?.startDate &&
    activePromotion?.endDate;

  const now = new Date();
  const isActive = isValid &&
    now >= new Date(activePromotion.startDate) &&
    now <= new Date(activePromotion.endDate);

  return {
    promotion: isActive ? activePromotion : null,
    loading,
    error
  };
}

/**
 * Hook para buscar configuração de PIX
 */
export function usePixConfig() {
  const { config, loading, error } = useConfig();
  return {
    pixConfig: config?.pixConfig || getDefaultPixConfig(),
    loading,
    error
  };
}

/**
 * Configuração padrão de textos - baseada no que está ONLINE AGORA
 */
export function getDefaultTexts() {
  return {
    homeHero: {
      title: 'Devolva o Brilho Original ao seu Veículo.',
      subtitle: 'Tratamento vip para o seu carro com produtos de alta performance.',
      ctaText: 'Agendar Meu Horário'
    },
    homeAbout: {
      title: 'Por que escolher a BrilhoCar?',
      description: 'Não pulamos etapas. Utilizamos iluminação especial e técnicas avançadas para garantir que cada centímetro da pintura esteja perfeito. Acompanhamento em tempo real via QR Code exclusivo.'
    },
    bookingTitle: 'Novo Agendamento',
    bookingSubtitle: 'Selecione os serviços desejados e confirme os dados do seu veículo.',
    footer: {
      address: 'R. Pindamonhangaba, 178',
      phone: '11981312143',
      whatsapp: '5511981312143',
      instagram: '@brilhocar',
      facebook: 'BrilhoCar',
      email: 'contato@brilhocar.com'
    }
  };
}

/**
 * Configuração padrão de PIX
 */
export function getDefaultPixConfig() {
  return {
    guaranteePercentage: 30,
    minGuaranteeAmount: 5, // Mínimo R$ 5 por restrição do Asaas sandbox
    pixKey: '',
    pixRecipientName: '',
    pixRecipientDocument: ''
  };
}

/**
 * Configuração padrão completa
 */
export function getDefaultConfig() {
  return {
    texts: getDefaultTexts(),
    pixConfig: getDefaultPixConfig(),
    activePromotion: null,
    banners: [],
    services: [],
    businessHours: {
      monday: { open: '08:00', close: '18:00', active: true },
      tuesday: { open: '08:00', close: '18:00', active: true },
      wednesday: { open: '08:00', close: '18:00', active: true },
      thursday: { open: '08:00', close: '18:00', active: true },
      friday: { open: '08:00', close: '18:00', active: true },
      saturday: { open: '08:00', close: '14:00', active: true },
      sunday: { open: '00:00', close: '00:00', active: false }
    },
    aiConfig: {
      enabled: false,
      chatEnabled: false,
      chatPosition: 'bottom-right',
      chatWelcomeMessage: 'Olá! Como posso ajudar?'
    },
    updatedAt: null,
    updatedBy: null
  };
}
