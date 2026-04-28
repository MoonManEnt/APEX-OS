<script setup lang="ts">
const { selected: brandSlug, meta: brandMeta } = useBrand()
const { getEvents, getHealth } = useApexApi()

const [{ data: eventsData, error: eventsError }, { data: healthData }] = await Promise.all([
  useAsyncData('apex-events', getEvents),
  useAsyncData('apex-health', getHealth),
])

const events = computed(() => eventsData.value?.events ?? [])

const filteredEvents = computed(() => {
  if (brandSlug.value === 'all') return events.value
  return events.value.filter((e) => e.primary_brand === brandSlug.value)
})

const criticalCount = computed(() => filteredEvents.value.filter((e) => e.relevance_score >= 90).length)
const readyCount = computed(() => filteredEvents.value.filter((e) => e.latest_draft_status === 'ready_to_send').length)
const leadEvent = computed(() => filteredEvents.value[0] ?? null)

function scoreColor(score: number): string {
  if (score >= 90) return '#ef4444'
  if (score >= 75) return '#f97316'
  if (score >= 50) return '#eab308'
  return '#4a6180'
}

const surfaceScopeLabel = computed(() =>
  brandSlug.value === 'all'
    ? 'All brands · full feed'
    : `${brandMeta.value.label} · brand-scoped feed`,
)
</script>

<template>
  <div class="newsroom">
    <!-- Page header -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-eyebrow">Newsroom</div>
        <h1 class="page-title">Signal feed</h1>
        <div class="page-scope">{{ surfaceScopeLabel }}</div>
      </div>
      <div class="page-header-right">
        <span
          class="api-badge"
          :class="healthData?.status === 'ok' ? 'api-badge--ok' : 'api-badge--err'"
        >
          {{ healthData?.status === 'ok' ? 'API online' : 'API issue' }}
        </span>
      </div>
    </div>

    <!-- Brand context banner -->
    <div
      v-if="brandSlug !== 'all'"
      class="brand-banner"
      :style="{ borderColor: brandMeta.color + '50', background: brandMeta.color + '12' }"
    >
      <div class="brand-banner-swatch" :style="{ background: brandMeta.color }" />
      <span class="brand-banner-label">Viewing</span>
      <span class="brand-banner-name" :style="{ color: brandMeta.color }">{{ brandMeta.label }}</span>
      <span class="brand-banner-sep">·</span>
      <span class="brand-banner-count">{{ filteredEvents.length }} of {{ events.length }} events</span>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Events</div>
        <div class="stat-value">{{ filteredEvents.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Critical</div>
        <div class="stat-value" style="color: #ef4444">{{ criticalCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ready drafts</div>
        <div class="stat-value" style="color: #22c55e">{{ readyCount }}</div>
      </div>
    </div>

    <!-- API error -->
    <div v-if="eventsError" class="error-banner">
      Backend fetch failed — confirm FastAPI is running at http://127.0.0.1:8000
    </div>

    <!-- Empty state after brand filter -->
    <div
      v-else-if="filteredEvents.length === 0 && brandSlug !== 'all'"
      class="empty-state"
    >
      <div class="empty-icon">—</div>
      <div class="empty-msg">No events for <strong style="color: inherit">{{ brandMeta.label }}</strong> in the current feed.</div>
      <div class="empty-sub">The backend may not have tagged events for this brand yet, or they haven't been ingested.</div>
    </div>

    <template v-else>
      <!-- Lead signal -->
      <div v-if="leadEvent" class="lead-card">
        <div class="lead-card-header">
          <div>
            <div class="section-label">Lead signal</div>
            <div class="section-sub">
              Highest-ranked event{{ brandSlug === 'all' ? ' across all brands' : ' for ' + brandMeta.label }}
            </div>
          </div>
          <div class="score-pill" :style="{ background: scoreColor(leadEvent.relevance_score) + '20', color: scoreColor(leadEvent.relevance_score) }">
            {{ leadEvent.relevance_score }}
          </div>
        </div>
        <div class="lead-title">{{ leadEvent.title }}</div>
        <p class="lead-summary">{{ leadEvent.summary || 'No summary available.' }}</p>
        <div class="chip-row">
          <span class="tag-chip">{{ leadEvent.primary_brand || 'unassigned' }}</span>
          <span v-if="leadEvent.market" class="tag-chip tag-chip--market">{{ leadEvent.market }}</span>
          <span v-if="leadEvent.event_type" class="tag-chip tag-chip--type">{{ leadEvent.event_type }}</span>
          <span v-if="leadEvent.latest_draft_status" class="tag-chip tag-chip--draft">{{ leadEvent.latest_draft_status }}</span>
        </div>
      </div>

      <!-- Event list -->
      <div v-if="filteredEvents.length > 1" class="event-list">
        <div class="section-label" style="margin-bottom: 0.5rem">
          All signals ({{ filteredEvents.length }})
        </div>
        <div
          v-for="event in filteredEvents.slice(1, 10)"
          :key="event.id"
          class="event-row"
        >
          <div
            class="event-score"
            :style="{ color: scoreColor(event.relevance_score), borderColor: scoreColor(event.relevance_score) + '40' }"
          >
            {{ event.relevance_score }}
          </div>
          <div class="event-body">
            <div class="event-title">{{ event.title }}</div>
            <div class="event-meta">
              <span>{{ event.primary_brand || 'unassigned' }}</span>
              <span v-if="event.market"> · {{ event.market }}</span>
              <span v-if="event.event_type"> · {{ event.event_type }}</span>
            </div>
          </div>
          <span v-if="event.latest_draft_status" class="event-status">{{ event.latest_draft_status }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.newsroom {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 900px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-eyebrow {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #3a5070;
  margin-bottom: 0.25rem;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}

.page-scope {
  font-size: 0.75rem;
  color: #4a6a8a;
}

.page-header-right {
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.api-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid;
}

.api-badge--ok {
  border-color: #22c55e40;
  color: #22c55e;
  background: #22c55e10;
}

.api-badge--err {
  border-color: #ef444440;
  color: #ef4444;
  background: #ef444410;
}

.brand-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  border: 1px solid;
  font-size: 0.78rem;
}

.brand-banner-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.brand-banner-label {
  color: #5a7a9a;
}

.brand-banner-name {
  font-weight: 700;
}

.brand-banner-sep {
  color: #2a4060;
}

.brand-banner-count {
  color: #4a6a8a;
  font-size: 0.72rem;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat-card {
  background: #0c1929;
  border: 1px solid #1a2d45;
  border-radius: 12px;
  padding: 0.9rem 1rem;
}

.stat-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3a5070;
  margin-bottom: 0.4rem;
}

.stat-value {
  font-size: 1.7rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: -0.03em;
  line-height: 1;
}

.error-banner {
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #1f0a0a;
  border: 1px solid #4a1515;
  color: #fca5a5;
  font-size: 0.8rem;
}

.empty-state {
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: #3a5070;
  border: 1px dashed #1a2d45;
  border-radius: 14px;
}

.empty-icon {
  font-size: 1.5rem;
  margin-bottom: 0.75rem;
}

.empty-msg {
  font-size: 0.85rem;
  color: #5a7a9a;
  margin-bottom: 0.4rem;
}

.empty-sub {
  font-size: 0.73rem;
  color: #2a4060;
}

.lead-card {
  background: #0c1929;
  border: 1px solid #1a2d45;
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.lead-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3a5070;
  margin-bottom: 0.2rem;
}

.section-sub {
  font-size: 0.71rem;
  color: #2a4060;
}

.score-pill {
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
}

.lead-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.lead-summary {
  font-size: 0.82rem;
  line-height: 1.6;
  color: #7a9ab8;
  margin: 0;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag-chip {
  font-size: 0.67rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #112035;
  border: 1px solid #1a2d45;
  color: #4a6a8a;
}

.tag-chip--market {
  background: #0f2a1f;
  border-color: #1d9e7540;
  color: #1d9e75;
}

.tag-chip--type {
  background: #1c1a0a;
  border-color: #ba751740;
  color: #ba7517;
}

.tag-chip--draft {
  background: #0d1f38;
  border-color: #185fa540;
  color: #60aef0;
}

.event-list {
  background: #0c1929;
  border: 1px solid #1a2d45;
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.5rem;
  border-radius: 8px;
  transition: background 0.1s;
}

.event-row:hover {
  background: #0f2035;
}

.event-score {
  font-size: 0.72rem;
  font-weight: 700;
  width: 32px;
  text-align: center;
  border: 1px solid;
  border-radius: 6px;
  padding: 0.1rem 0;
  flex-shrink: 0;
}

.event-body {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #c8d8e8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-meta {
  font-size: 0.68rem;
  color: #2a4060;
  margin-top: 0.12rem;
}

.event-status {
  font-size: 0.65rem;
  font-weight: 600;
  color: #60aef0;
  background: #0d1f38;
  border: 1px solid #185fa540;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  flex-shrink: 0;
}
</style>
