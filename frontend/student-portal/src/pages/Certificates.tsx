import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCertificates } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Certificate } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  GraduationCap,
  Award,
  Download,
  Share2,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse p-6">
      <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto mb-6" />
      <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto mb-4" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mx-auto mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/4 mx-auto mb-6" />
      <div className="flex gap-3 justify-center">
        <div className="h-9 bg-gray-200 rounded w-28" />
        <div className="h-9 bg-gray-200 rounded w-20" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certificate Card
// ---------------------------------------------------------------------------

interface CertificateCardProps {
  certificate: Certificate;
}

function CertificateCard({ certificate }: CertificateCardProps) {
  const certificateUrl = `${API_BASE_URL}/api/method/lms.lms.api.get_certificate_pdf?certificate=${certificate.name}`;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/certificate/${certificate.certificate_id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificate - ${certificate.course_title}`,
          text: `I earned a certificate for completing ${certificate.course_title} at Delta SPMU Academy!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed silently
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border-2 border-primary/20 relative">
      {/* Decorative top border */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-yellow-500 to-primary" />

      {/* Decorative corner accents */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary/40 rounded-tl-sm" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary/40 rounded-tr-sm" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary/40 rounded-bl-sm" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary/40 rounded-br-sm" />

      <div className="p-6 sm:p-8 text-center">
        {/* Academy name */}
        <p className="text-xs tracking-[0.2em] uppercase text-primary font-medium mb-1">
          Delta SPMU Academy
        </p>

        {/* Subtitle */}
        <p className="text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-5">
          Certificate of Completion
        </p>

        {/* Award icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Award className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Course title */}
        <h3 className="font-heading text-lg sm:text-xl font-bold text-dark mb-3 leading-tight">
          {certificate.course_title}
        </h3>

        {/* Student name */}
        <p className="text-sm text-gray-600 mb-1">
          Awarded to{' '}
          <span className="font-medium text-dark">{certificate.student_name}</span>
        </p>

        {/* Issue date */}
        <p className="text-xs text-gray-400 mb-1">
          Issued on {formatDate(certificate.issue_date)}
        </p>

        {/* Certificate ID */}
        <p className="text-[10px] text-gray-300 font-mono mb-6">
          ID: {certificate.certificate_id}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <a
            href={certificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
          <a
            href={`/certificate/${certificate.certificate_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View
          </a>
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center w-9 h-9 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-dark transition-colors"
            aria-label="Share certificate"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Certificates() {
  const { t } = useTranslation(['common', 'pages']);
  const { user } = useAuth();

  const {
    data: certificatesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => getCertificates(),
    enabled: !!user,
  });

  const certificates: Certificate[] = useMemo(() => {
    if (!certificatesData) return [];
    if (Array.isArray(certificatesData)) return certificatesData as Certificate[];
    if (
      typeof certificatesData === 'object' &&
      'data' in (certificatesData as Record<string, unknown>)
    ) {
      return (certificatesData as { data: Certificate[] }).data;
    }
    return [];
  }, [certificatesData]);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-8 h-8 text-primary" />
            <h1 className="font-heading text-3xl sm:text-4xl font-bold">
              {t('pages:certificates.title', 'My Certificates')}
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            Your earned certificates of completion
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          /* Error */
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              Something went wrong while loading your certificates.
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : certificates.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-dark mb-1">
              You haven't earned any certificates yet.
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Complete a course to earn your certificate.
            </p>
            <Link
              to="/courses"
              className="inline-flex items-center px-6 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          /* Certificate grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <CertificateCard key={cert.name} certificate={cert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
