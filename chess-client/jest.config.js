/** @type {import('jest').Config} */
module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  reporters: ['default', ['jest-junit', { outputDirectory: 'reports', outputName: 'junit.xml' }]],
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
