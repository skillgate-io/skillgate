/* 16.16: SEO metadata unit tests */
import { describe, it, expect } from 'vitest';
import { softwareApplicationJsonLd, faqJsonLd, pageMetadata } from '@/lib/seo';

describe('SEO', () => {
  describe('softwareApplicationJsonLd', () => {
    it('returns valid JSON', () => {
      const json = softwareApplicationJsonLd();
      const parsed = JSON.parse(json);

      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('SoftwareApplication');
      expect(parsed.name).toBe('SkillGate');
    });

    it('includes pricing offers', () => {
      const parsed = JSON.parse(softwareApplicationJsonLd());
      expect(parsed.offers).toHaveLength(3);
      expect(parsed.offers[0].price).toBe('0');
      expect(parsed.offers[1].price).toBe('49');
      expect(parsed.offers[2].price).toBe('99');
    });
  });

  describe('faqJsonLd', () => {
    it('returns valid FAQ page schema', () => {
      const parsed = JSON.parse(faqJsonLd());
      
      expect(parsed['@type']).toBe('FAQPage');
      expect(parsed.mainEntity.length).toBeGreaterThan(0);
      expect(parsed.mainEntity[0]['@type']).toBe('Question');
      expect(parsed.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
    });
  });

  describe('pageMetadata', () => {
    it('generates correct page metadata', () => {
      const meta = pageMetadata('Pricing', 'Pricing plans', '/pricing');
      
      expect(meta.title).toBe('Pricing');
      expect(meta.description).toBe('Pricing plans');
      expect(meta.alternates?.canonical).toBe('https://skillgate.io/pricing');
    });
  });
});
