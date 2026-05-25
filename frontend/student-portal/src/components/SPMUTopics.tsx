/**
 * SPMU Knowledge Topics — clickable tiles representing the core
 * subject areas covered across the 4 certification programs. Each tile
 * deep-links into the relevant course (when one is uniquely matched) or
 * scrolls to the filter at the bottom of the page.
 *
 * Content mirrors the chapter breakdown in the academy's 16-chapter
 * training manual: skin anatomy & healing, hygiene, color theory, brow
 * mapping, plus the four signature brow techniques (Ombré / Powder /
 * Nano / Combo) and the business / instructor track for Master + Licensing.
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
  TrendingUp,
} from 'lucide-react';

interface TopicTile {
  key: string;
  title: string;
  description: string;
  icon: typeof Brain;
  // Course slug to filter / scroll to. When matching multiple courses we
  // just navigate to the grid + let the filter narrow.
  courseHint?: string;
  accent: string;
}

const TOPICS: TopicTile[] = [
  {
    key: 'skin-anatomy',
    title: 'Skin Anatomy & Healing',
    description: 'Layers, Fitzpatrick scale, contraindications',
    icon: Stethoscope,
    courseHint: 'foundation-certification',
    accent: 'from-rose-100 to-rose-50 text-rose-700',
  },
  {
    key: 'hygiene-safety',
    title: 'Hygiene & Safety',
    description: 'Cross-contamination, sterilization, station setup',
    icon: Droplets,
    courseHint: 'foundation-certification',
    accent: 'from-sky-100 to-sky-50 text-sky-700',
  },
  {
    key: 'color-theory',
    title: 'Color Theory',
    description: 'Undertones, pigment selection, neutralization',
    icon: Palette,
    courseHint: 'foundation-certification',
    accent: 'from-amber-100 to-amber-50 text-amber-700',
  },
  {
    key: 'brow-mapping',
    title: 'Brow Mapping',
    description: 'Golden ratio, facial symmetry, design',
    icon: Ruler,
    courseHint: 'foundation-certification',
    accent: 'from-emerald-100 to-emerald-50 text-emerald-700',
  },
  {
    key: 'signature-techniques',
    title: 'Signature Techniques',
    description: 'Ombré · Powder · Nano · Combo brows',
    icon: Sparkles,
    courseHint: 'advanced-certification',
    accent: 'from-fuchsia-100 to-fuchsia-50 text-fuchsia-700',
  },
  {
    key: 'aftercare',
    title: 'Aftercare & Healing',
    description: 'Day-by-day recovery, client guidance',
    icon: Heart,
    courseHint: 'foundation-certification',
    accent: 'from-pink-100 to-pink-50 text-pink-700',
  },
  {
    key: 'studio-business',
    title: 'Studio & Business',
    description: 'Pricing, client retention, brand building',
    icon: Briefcase,
    courseHint: 'master-artist-program',
    accent: 'from-indigo-100 to-indigo-50 text-indigo-700',
  },
  {
    key: 'teach-train',
    title: 'Teach & Train',
    description: 'Open your own academy and license students',
    icon: Award,
    courseHint: 'instructor-licensing',
    accent: 'from-primary-light/60 to-primary-light/30 text-primary-dark',
  },
];

interface Props {
  /** Called when a tile is clicked. If not provided, tile navigates by href. */
  onTopicClick?: (courseHint: string | undefined) => void;
}

export default function SPMUTopics({ onTopicClick }: Props) {
  return (
    <section className="py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary-dark text-xs uppercase tracking-[0.2em] font-medium mb-2">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Browse by Skill</span>
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-dark">
          Master the Craft, Step by Step
        </h2>
        <p className="text-dark-light text-sm sm:text-base mt-2 max-w-2xl">
          Every program is built from the same eight foundational skill areas —
          dig deeper into the topic that interests you most.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          const tile = (
            <div
              className={`group relative overflow-hidden rounded-2xl border border-dark/5 bg-gradient-to-br ${topic.accent} p-4 sm:p-5 h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer`}
            >
              <div className="flex flex-col h-full">
                <div className="mb-3 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/70 backdrop-blur shadow-sm">
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                </div>
                <h3 className="font-heading text-sm sm:text-base font-semibold leading-tight">
                  {topic.title}
                </h3>
                <p className="text-xs sm:text-[13px] text-current/75 mt-1 leading-snug line-clamp-2">
                  {topic.description}
                </p>
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
                {tile}
              </button>
            );
          }

          return (
            <Link
              key={topic.key}
              to={topic.courseHint ? `/course/${topic.courseHint}` : '#courses-grid'}
              className="block h-full"
            >
              {tile}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
