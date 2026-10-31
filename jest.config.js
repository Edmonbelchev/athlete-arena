/**
 * Unit tests for pure logic (pose engines, timers, coordinate math).
 *
 * Uses plain Jest + babel-preset-expo instead of the jest-expo preset: jest-expo 57.x
 * needs @react-native/jest-preset ^0.86.3, which conflicts with react-native 0.86.0.
 * Switch to `preset: 'jest-expo'` after upgrading the SDK patch versions.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      { presets: ['babel-preset-expo'], babelrc: false, configFile: false },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Native pose thresholds (Platform.OS === 'ios').
    '^react-native$': '<rootDir>/test/mocks/react-native.ts',
  },
};
