import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BadgePercent, ArrowRight } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

interface BundleOfferProps {
  bundlePrice?: number;
  individualTotal?: number;
}

export default function BundleOffer({
  bundlePrice = 20000,
  individualTotal,
}: BundleOfferProps) {
  const { t } = useTranslation();

  const savings = individualTotal && individualTotal > bundlePrice
    ? Math.round(((individualTotal - bundlePrice) / individualTotal) * 100)
    : null;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark to-primary-dark p-8 md:p-10">
      {/* Decorative circles */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Text content */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-white">
              {t('Bundle Offer — All 5 Courses', 'Bundle Offer — All 5 Courses')}
            </h2>
            {savings && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-yellow-400 text-dark text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                <BadgePercent className="w-3.5 h-3.5" />
                {t('Save {{percent}}%', { percent: savings })}
              </span>
            )}
          </div>

          <p className="text-white/70 text-base max-w-lg">
            {t(
              'Get access to all 5 certification courses at a special price',
              'Get access to all 5 certification courses at a special price'
            )}
          </p>

          {/* Price */}
          <div className="flex items-baseline gap-3 pt-1">
            <span className="text-3xl md:text-4xl font-bold text-white">
              {formatPrice(bundlePrice)}
            </span>
            {individualTotal && individualTotal > bundlePrice && (
              <span className="text-white/50 line-through text-lg">
                {formatPrice(individualTotal)}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <Link
          to="/payment/all-courses-bundle"
          className={cn(
            'inline-flex items-center gap-2 bg-dark text-white px-8 py-4 rounded-xl',
            'font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg',
            'shrink-0'
          )}
        >
          {t('Buy Bundle', 'Buy Bundle')}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}
