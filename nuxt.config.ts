export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  runtimeConfig: {
    // Overridable at runtime via NUXT_* env vars (Docker) — see .env.example
    migrationsDir: 'server/database/migrations',
    seedDemoData: false,
    session: {
      cookie: {
        // Declared so NUXT_SESSION_COOKIE_SECURE can bind: nuxt-auth-utils only
        // seeds {name, password, cookie: {sameSite}}, and Nuxt's env override
        // reaches existing keys only — otherwise h3's production default of
        // secure:true wins and plain-HTTP deployments can't hold a session.
        secure: true,
      },
    },
  },
})
