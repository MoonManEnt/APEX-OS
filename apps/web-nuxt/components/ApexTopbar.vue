<script setup lang="ts">
const { selected, select, BRAND_META, BRAND_SLUGS } = useBrand()
const config = useRuntimeConfig()

const { data: healthData } = useFetch<{ status: string }>(
  `${config.public.apexApiBaseUrl}/health`,
  { server: false },
)
</script>

<template>
  <header class="apex-topbar">
    <div class="apex-logo">
      <div class="apex-logo-icon">A</div>
      <span class="apex-logo-name">APEX OS</span>
      <span class="apex-logo-version">v1.0</span>
    </div>

    <div class="apex-brand-chips">
      <button
        v-for="slug in BRAND_SLUGS"
        :key="slug"
        class="apex-chip"
        :class="{ 'apex-chip--active': selected === slug }"
        :style="
          selected === slug
            ? {
                background: BRAND_META[slug].color + '20',
                borderColor: BRAND_META[slug].color,
                color: BRAND_META[slug].color,
              }
            : {}
        "
        @click="select(slug)"
      >
        <span class="chip-short">{{ BRAND_META[slug].short }}</span>
        <span class="chip-label">{{ BRAND_META[slug].label }}</span>
      </button>
    </div>

    <div class="apex-topbar-end">
      <span
        class="apex-status-dot"
        :class="healthData?.status === 'ok' ? 'apex-status-dot--ok' : 'apex-status-dot--err'"
        :title="healthData?.status === 'ok' ? 'API online' : 'API unreachable'"
      />
      <div class="apex-operator">
        <div class="apex-operator-avatar">RS</div>
        <span class="apex-operator-label">Operator</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.apex-topbar {
  height: 52px;
  background: #0c1929;
  border-bottom: 1px solid #1a2d45;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  flex-shrink: 0;
  overflow: hidden;
}

.apex-logo {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  margin-right: 0.25rem;
}

.apex-logo-icon {
  width: 28px;
  height: 28px;
  background: #185fa5;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.apex-logo-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.06em;
}

.apex-logo-version {
  font-size: 0.63rem;
  color: #3a5070;
  background: #112035;
  border: 1px solid #1a2d45;
  padding: 1px 5px;
  border-radius: 4px;
}

.apex-brand-chips {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex: 1;
  overflow: hidden;
}

.apex-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  border: 1px solid #1a2d45;
  background: transparent;
  color: #4a6180;
  font-size: 0.7rem;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
  white-space: nowrap;
  font-family: inherit;
}

.apex-chip:hover {
  border-color: #2a4060;
  color: #7a9ab8;
}

.apex-chip--active {
  font-weight: 600;
}

.chip-short {
  font-weight: 700;
  font-size: 0.65rem;
}

.chip-label {
  font-size: 0.69rem;
}

.apex-topbar-end {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
  margin-left: auto;
}

.apex-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.apex-status-dot--ok {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e70;
}

.apex-status-dot--err {
  background: #ef4444;
}

.apex-operator {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.apex-operator-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #185fa5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.58rem;
  font-weight: 700;
  color: #fff;
}

.apex-operator-label {
  font-size: 0.69rem;
  color: #3a5070;
}
</style>
