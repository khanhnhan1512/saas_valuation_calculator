// Test-only values for the E2E server. Never used outside tests.
export const E2E_PORT = 3200;
export const E2E_STAFF_PASSWORD = 'e2e-staff-password';
export const E2E_ENV = {
  PGLITE_DIR: '.data/e2e',
  STAFF_PASSWORD: E2E_STAFF_PASSWORD,
  AUTH_SECRET: 'e2e-auth-secret-not-for-production',
  LEAD_RATE_LIMIT: '1000',
};
