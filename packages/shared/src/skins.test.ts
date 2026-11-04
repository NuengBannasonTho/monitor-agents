import { describe, expect, it } from 'vitest';
import { SkinManifestSchema, defaultCostume, skinImageFor } from './skins.js';

const manifest = SkinManifestSchema.parse({
  version: 1,
  name: 'Test',
  size: 64,
  images: { normal: 'normal.png', crying: 'crying.png', fire: 'fire.png', ninja: 'ninja.png' },
  byState: { idle: 'normal', running: 'fire', 'needs-you': 'crying' },
  costumes: ['normal', 'ninja'],
  stateOverrides: { 'needs-you': 'crying' },
});

describe('skin manifest', () => {
  it('rejects references to unknown images and missing idle', () => {
    expect(SkinManifestSchema.safeParse({ ...manifest, byState: { idle: 'nope' } }).success).toBe(
      false,
    );
    expect(
      SkinManifestSchema.safeParse({ ...manifest, byState: { running: 'fire' } }).success,
    ).toBe(false);
  });

  it('rejects unsafe file names', () => {
    expect(
      SkinManifestSchema.safeParse({ ...manifest, images: { normal: '../../etc/passwd' } }).success,
    ).toBe(false);
  });

  it('by-state picks the state image, falling back to idle', () => {
    expect(skinImageFor(manifest, 'by-state', 'running', 'ninja')).toBe('fire');
    expect(skinImageFor(manifest, 'by-state', 'reading', 'ninja')).toBe('normal');
  });

  it('by-agent keeps the costume except for overridden states', () => {
    expect(skinImageFor(manifest, 'by-agent', 'running', 'ninja')).toBe('ninja');
    expect(skinImageFor(manifest, 'by-agent', 'needs-you', 'ninja')).toBe('crying');
  });

  it('gives each desk a stable default costume', () => {
    expect(defaultCostume(manifest, 'feat-auth')).toBe(defaultCostume(manifest, 'feat-auth'));
    expect(manifest.costumes).toContain(defaultCostume(manifest, 'docs-site'));
  });
});
