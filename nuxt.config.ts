export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  runtimeConfig: {
    // Overridable at runtime via NUXT_* env vars (Docker) — see .env.example
    migrationsDir: 'server/database/migrations',
    seedDemoData: false,
  },
})
