export type BrandSlug =
  | 'all'
  | 'clean_scapes'
  | 'partners_cc'
  | 'scout_security'
  | 'ecs_texas'
  | 'revival_restoration'

export type BrandMeta = {
  label: string
  short: string
  color: string
}

export const BRAND_META: Record<BrandSlug, BrandMeta> = {
  all: { label: 'All brands', short: 'A', color: '#ba7517' },
  clean_scapes: { label: 'Clean Scapes', short: 'CS', color: '#639922' },
  partners_cc: { label: 'Partners CC', short: 'PCC', color: '#5f5e5a' },
  scout_security: { label: 'Scout Security', short: 'SC', color: '#185FA5' },
  ecs_texas: { label: 'ECS of Texas', short: 'EC', color: '#1d9e75' },
  revival_restoration: { label: 'Revival', short: 'RV', color: '#7f77dd' },
}

export const BRAND_SLUGS = Object.keys(BRAND_META) as BrandSlug[]

export function useBrand() {
  const selected = useState<BrandSlug>('apex-selected-brand', () => 'all')
  const meta = computed(() => BRAND_META[selected.value])

  function select(slug: BrandSlug) {
    selected.value = slug
  }

  return { selected, meta, select, BRAND_META, BRAND_SLUGS }
}
