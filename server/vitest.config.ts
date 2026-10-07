import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './test/globalSetup.ts',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/barmap_test',
      CLIENT_ORIGIN: 'http://localhost:5173',
      JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
      UPLOAD_DIR: 'test/.uploads',
      CLIENT_DIST: 'test/.no-dist',
      RESEND_API_KEY: '',
    },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
