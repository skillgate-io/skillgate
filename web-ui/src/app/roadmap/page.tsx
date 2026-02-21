/* Backend-driven roadmap page for claim restoration and tier alignment */

import type { Metadata } from 'next';
import { CTASection } from '@/components/sections/CTASection';
import { RoadmapSection } from '@/components/sections/RoadmapSection';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(
  'Roadmap',
  'SkillGate product roadmap by plan, including live features and near-term releases.',
  '/roadmap',
);

export default function RoadmapPage() {
  return (
    <>
      <RoadmapSection />
      <CTASection />
    </>
  );
}
