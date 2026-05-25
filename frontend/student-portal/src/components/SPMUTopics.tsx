/**
 * SPMU Knowledge Topics — clickable tiles representing the core
 * subject areas covered across the 4 certification programs.
 *
 * Brand-aligned redesign: dark cards with gold accents, large
 * topic numbers, restrained typography. Mirrors the marketing
 * site's palette (forest green + champagne gold) rather than the
 * pastel rainbow we had originally.
 */

import { Link } from 'react-router-dom';
import {
  Brain,
  Droplets,
  Palette,
  Ruler,
  Sparkles,
  Award,
  Briefcase,
  Stethoscope,
  Heart,
  ArrowUpRight,
} from 'lucide-react';

interface TopicTile {
  key: string;
  title: string;
  description: string;
  icon: typeof Brain;
  courseHint?: string;
}

const TOPICS: TopicTile[] = [
  {
    key: 'skin-anatomy',
    title: 'Skin Anatomy & Healing',
    description: 'Layers, Fitzpatrick scale, contraindications',
    icon: Stethoscope,
    courseHint: 'foundation-certification',
  },
  {
    key: 'hygiene-safety',
    title: 'Hygiene & Safety',
    description: 'Cross-contamination, sterilization, station setup',
    icon: Droplets,
    courseHint: 'foundation-certification',
  },
  {
    key: 'color-theory',
    title: 'Color Theory',
    description: 'Undertones, pigment selection, neutralization',
    icon: Palette,
    courseHint: 'foundation-certification',
  },
  {
    key: 'brow-mapping',
    title: 'Brow Mapping',
    description: 'Golden ratio, facial symmetry, design',
    icon: Ruler,
    courseHint: 'foundation-certification',
  },
  {
    key: 'signature-techniques',
    title: 'Signature Techniques',
    description: 'Ombré · Powder · Nano · Combo brows',
    icon: Sparkles,
    courseHint: 'advanced-certification',
  },
  {
    key: 'aftercare',
    title: 'Aftercare & Healing',
    description: 'Day-by-day recovery and client guidance',
    icon: Heart,
    courseHint: 'foundation-certification',
  },
  {
    key: 'studio-business',
    title: 'Studio & Business',
    description: 'Pricing, client retention, brand building',
    icon: Briefcase,
    courseHint: 'master-artist-program',
  },
  {
    key: 'teach-train',
    title: 'Teach & Train',
    description: 'Open your own academy and license students',
    icon: Award,
    courseHint: 'instructor-licensing',
  },
];

interface Props {
  onTopicClick?: (courseHint: string | undefined) => void;
}

export default function SPMUTopics({ onTopicClick }: Props) {
  return (
    <section className="py-12 sm:py-14">
      {/* Section header */}
      <div className="mb-10 max-w-2xl">
        <div className="flex items-center gap-3 text-primary-dark text-[11px] uppercase tracking-[0.25em] font-medium mb-3">
          <span className="h-px w-8 bg-primary-dark/40" />
          <span>Curriculum</span>
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-dark leading-tight">
          The eight pillars of the practice
        </h2>
        <p className="text-dark-light text-base mt-3 leading-relaxed">
          Every program at Delta SPMU is built from these foundational skill
          areas, drawn directly from our 16-chapter training manual. Dig
          deeper into the topic that's calling you next.
        </p>
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {TOPICS.map((topic, idx) => {
          const Icon = topic.icon;
          const number = String(idx + 1).padStart(2, '0');

          const tileInner = (
            <div className="group relative overflow-hidden rounded-2xl bg-dark text-white p-6 sm:p-7 h-full transition-all duration-500 hover:shadow-xl hover:shadow-dark/20 cursor-pointer flex flex-col">
              {/* Decorative ambient gold glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-2xl transition-all duration-500 group-hover:bg-primary/25 group-hover:scale-125" />

              {/* Number badge in corner */}
              <span className="absolute top-5 right-5 text-[10px] font-mono tracking-[0.15em] text-primary/60">
                {number}
              </span>

              {/* Icon */}
              <div className="relative z-10 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 backdrop-blur ring-1 ring-primary/20 mb-5 transition-all duration-300 group-hover:bg-primary/30 group-hover:ring-primary/40">
                <Icon className="w-5 h-5 text-primary-light" strokeWidth={1.6} />
              </div>

              {/* Text */}
              <h3 className="relative z-10 font-heading text-lg sm:text-xl font-semibold leading-tight mb-2">
                {topic.title}
              </h3>
              <p className="relative z-10 text-[13px] text-white/60 leading-relaxed flex-1">
                {topic.description}
              </p>

              {/* Hover arrow */}
              <div className="relative z-10 mt-4 flex items-center gap-1.5 text-[12px] text-primary opacity-60 group-hover:opacity-100 transition-opacity">
                <span className="uppercase tracking-wider">Explore</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          );

          if (onTopicClick) {
            return (
              <button
                key={topic.key}
                onClick={() => onTopicClick(topic.courseHint)}
                className="text-left h-full"
              >
                {tileInner}
              </button>
            );
          }

          return (
            <Link
              key={topic.key}
              to={topic.courseHint ? `/course/${topic.courseHint}` : '#courses-grid'}
              className="block h-full"
            >
              {tileInner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
