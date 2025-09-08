// Test setup file
import 'jsdom';
import { TextEncoder, TextDecoder } from 'util';

// Global polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Global test utilities
global.jest = {
  fn: (implementation) => {
    const mockFn = function(...args) {
      mockFn.mock.calls.push(args);
      mockFn.mock.results.push({ type: 'return', value: implementation ? implementation(...args) : undefined });
      return implementation ? implementation(...args) : undefined;
    };
    
    mockFn.mock = {
      calls: [],
      results: [],
      instances: []
    };
    
    mockFn.mockResolvedValue = (value) => {
      mockFn.mock.resolvedValue = value;
      return mockFn;
    };
    
    mockFn.mockClear = () => {
      mockFn.mock.calls = [];
      mockFn.mock.results = [];
      mockFn.mock.instances = [];
      return mockFn;
    };
    
    return mockFn;
  }
};

// Mock console methods for tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};