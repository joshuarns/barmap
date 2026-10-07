export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  appName: import.meta.env.VITE_APP_NAME ?? 'Barmap',
  stadiaApiKey: import.meta.env.VITE_STADIA_API_KEY ?? '',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? '',
  isDev: import.meta.env.DEV,
}
