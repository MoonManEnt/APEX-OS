export const GORE_BRANDS = [
  { slug: 'clean_scapes', name: 'Clean Scapes' },
  { slug: 'partners_cc', name: 'Partners CC' },
  { slug: 'scout_security', name: 'Scout Security' },
  { slug: 'ecs_texas', name: 'ECS of Texas' },
  { slug: 'revival_restoration', name: 'Revival Restoration' },
] as const;

export type GoreBrandSlug = (typeof GORE_BRANDS)[number]['slug'];
