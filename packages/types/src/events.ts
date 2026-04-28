export type BrandSlug =
  | 'clean_scapes'
  | 'partners_cc'
  | 'scout_security'
  | 'ecs_texas'
  | 'revival_restoration';

export type EventType =
  | 'ownership_transfer'
  | 'lease_signed'
  | 'lease_expiring'
  | 'personnel_change'
  | 'construction_start'
  | 'construction_completion'
  | 'permit_filed'
  | 'zoning_action'
  | 'capital_raise'
  | 'corporate_relocation'
  | 'data_center_announcement'
  | 'vendor_change_signal'
  | 'market_news'
  | 'other';

export interface EventDTO {
  id: string;
  title: string;
  summary: string | null;
  eventType: EventType;
  market: string | null;
  urgencyScore: number;
  relevanceScore: number;
  confidenceScore: number;
  primaryBrand: BrandSlug | null;
  brandRelevance: BrandSlug[];
  badges: string[];
  sourceUrl: string | null;
  eventAt: string | null;
}

export interface FeedFilterParams {
  brand?: BrandSlug;
  market?: string;
  eventType?: EventType;
  minScore?: number;
}
