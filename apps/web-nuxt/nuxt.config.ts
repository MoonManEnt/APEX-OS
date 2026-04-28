export default defineNuxtConfig({
  compatibilityDate: '2026-04-27',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apexApiBaseUrl: process.env.NUXT_PUBLIC_APEX_API_BASE_URL || 'http://127.0.0.1:8000',
    },
  },
  app: {
    head: {
      title: 'APEX OS · Nuxt',
      meta: [
        { name: 'description', content: 'Nuxt + Nuxt UI replatform scaffold for the APEX operating system.' },
        { name: 'theme-color', content: '#185FA5' },
      ],
    },
  },
});
