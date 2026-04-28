<script setup lang="ts">
const { selected: brandSlug, meta: brandMeta } = useBrand()

const activeSurface = useState<string>('apex-surface', () => 'newsroom')

const navGroups = [
  {
    label: 'Daily flow',
    items: [
      { key: 'command', label: 'Command center' },
      { key: 'newsroom', label: 'Newsroom' },
      { key: 'xfeed', label: 'X signals' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { key: 'account', label: 'Account workspace' },
      { key: 'brain', label: 'Mind map' },
      { key: 'contacts', label: 'Contacts' },
      { key: 'map', label: 'Spatial map' },
    ],
  },
  {
    label: 'Action',
    items: [
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'proposals', label: 'Proposals' },
      { key: 'sentry', label: 'Sentry mode' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'brand', label: 'Brand profile' },
      { key: 'integrations', label: 'Integrations' },
    ],
  },
]
</script>

<template>
  <nav class="apex-sidebar">
    <div
      v-if="brandSlug !== 'all'"
      class="brand-ctx"
      :style="{ borderLeftColor: brandMeta.color }"
    >
      <div class="brand-ctx-eyebrow">Brand scope</div>
      <div class="brand-ctx-name" :style="{ color: brandMeta.color }">
        {{ brandMeta.label }}
      </div>
    </div>

    <div v-for="group in navGroups" :key="group.label" class="nav-group">
      <div class="nav-group-label">{{ group.label }}</div>
      <button
        v-for="item in group.items"
        :key="item.key"
        class="nav-item"
        :class="{ 'nav-item--active': activeSurface === item.key }"
        @click="activeSurface = item.key"
      >
        {{ item.label }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.apex-sidebar {
  width: 192px;
  background: #0a1623;
  border-right: 1px solid #1a2d45;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 0.75rem 0.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.brand-ctx {
  margin: 0 0.25rem 0.75rem;
  padding: 0.5rem 0.6rem;
  border-left: 3px solid transparent;
  background: #0e1f34;
  border-radius: 0 6px 6px 0;
}

.brand-ctx-eyebrow {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3a5070;
  margin-bottom: 0.2rem;
}

.brand-ctx-name {
  font-size: 0.75rem;
  font-weight: 700;
}

.nav-group {
  margin-bottom: 0.5rem;
}

.nav-group-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2a4060;
  padding: 0.5rem 0.6rem 0.25rem;
}

.nav-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.38rem 0.65rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #5a7a9a;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  font-family: inherit;
}

.nav-item:hover {
  background: #0f2035;
  color: #94b8d8;
}

.nav-item--active {
  background: #112d4e;
  color: #60aef0;
  font-weight: 600;
}
</style>
