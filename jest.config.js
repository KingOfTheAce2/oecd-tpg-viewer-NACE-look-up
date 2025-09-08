export default {
  testEnvironment: 'node',
  preset: null,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*validation*.test.js', '**/tests/**/crosswalk.test.js'],
  testPathIgnorePatterns: ['<rootDir>/tests/parser.test.js', '<rootDir>/tests/layout.test.js', '<rootDir>/tests/apa.test.js']
};