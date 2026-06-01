module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/static/js/filters/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/static/js/filters/tests/setup.ts'],
  collectCoverageFrom: ['static/js/filters/**/*.ts', '!static/js/filters/tests/**']
};
