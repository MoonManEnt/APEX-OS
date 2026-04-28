<script setup lang="ts">
defineProps<{
  apiBase: string
  eventCount: number
}>()
</script>

<template>
  <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200/70">APEX OS · Nuxt Replatform</div>
        <h1 class="mt-2 text-3xl font-semibold text-white">Unified operating shell scaffold</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-300">
          This Nuxt + Nuxt UI track is the parallel frontend rebuild for APEX while the FastAPI backend and current beta spine remain intact.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UBadge color="primary" variant="soft" label="Nuxt UI" />
        <UBadge color="neutral" variant="soft" :label="`${eventCount} live events`" />
        <UBadge color="secondary" variant="soft" label="Port 3001 scaffold" />
      </div>
    </div>

    <div class="flex flex-wrap gap-3 text-xs text-slate-300">
      <span class="rounded-full border border-white/10 px-3 py-1">Backend: {{ apiBase }}</span>
      <span class="rounded-full border border-white/10 px-3 py-1">Current focus: shell + data rails</span>
      <span class="rounded-full border border-white/10 px-3 py-1">Migration mode: parallel, non-destructive</span>
    </div>
  </div>
</template>
