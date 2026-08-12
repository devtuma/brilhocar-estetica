import { useActivePromotion } from '../hooks/useConfig';

/**
 * Banner de promoção ativa - mostra automaticamente quando há promoção configurada
 */
export default function PromotionBanner() {
  const { promotion, loading } = useActivePromotion();

  if (loading || !promotion) return null;

  const isValid = promotion.startDate && promotion.endDate;
  if (!isValid) return null;

  const now = new Date();
  const startDate = new Date(promotion.startDate);
  const endDate = new Date(promotion.endDate);

  if (now < startDate || now > endDate) return null;

  return (
    <div
      className="w-full py-3 text-center transition-all"
      style={{
        backgroundColor: promotion.customBg || '#6366f1',
        color: promotion.customText || '#ffffff'
      }}
    >
      <p className="font-black text-sm md:text-base">
        {promotion.bannerText || promotion.name}
        {promotion.discount > 0 && (
          <span className="ml-2 font-black">
            {promotion.discount}% OFF
          </span>
        )}
      </p>
    </div>
  );
}
