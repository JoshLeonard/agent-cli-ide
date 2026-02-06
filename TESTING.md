# Testing Guide

This document describes the testing setup and best practices for Terminal IDE.

## Test Framework

We use **Vitest** as our test runner and framework:
- Modern, fast, and great TypeScript support
- Native ESM support
- Compatible with Jest API
- Built-in coverage with V8

## Running Tests

```bash
# Run all tests (watch mode)
npm test

# Run tests once (CI mode)
npm test -- --run

# Run with UI dashboard
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Project Structure

```
src/
├── main/              # Main process (Node environment)
│   └── **/*.test.ts   # Main process tests
├── renderer/          # Renderer process (Browser environment)
│   ├── test/          # Test utilities and setup
│   └── **/*.test.tsx  # React component tests
└── shared/            # Shared types and utilities
    └── **/*.test.ts   # Shared code tests
```

## Test Configurations

### Main Process Tests (`vitest.config.ts`)
- **Environment**: Node.js
- **Target**: Services, IPC handlers, business logic
- **Location**: `src/main/**/*.test.ts`

### Renderer Tests (`vitest.config.renderer.ts`)
- **Environment**: jsdom (browser simulation)
- **Target**: React components, UI logic
- **Location**: `src/renderer/**/*.test.tsx`
- **Setup**: `src/renderer/test/setup.ts`

## Writing Tests

### Main Process (Services/Business Logic)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyService } from './MyService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should do something', () => {
    const result = service.doSomething();
    expect(result).toBe(expected);
  });
});
```

### React Components

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

## Best Practices

### General
1. **One test file per source file**: `MyService.ts` → `MyService.test.ts`
2. **Descriptive test names**: Use "should" statements
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Test behavior, not implementation**: Focus on public APIs
5. **Isolate tests**: Each test should be independent

### Mocking
- Use `vi.fn()` for function mocks
- Use `vi.spyOn()` for spying on existing functions
- Mock external dependencies (fs, electron APIs, etc.)

```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/path')
  }
}));

// Mock function
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
```

### Testing Async Code

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// Or with promises
it('should resolve promise', () => {
  return expect(promiseFunction()).resolves.toBe(expected);
});
```

### Coverage Guidelines
- Aim for **>80% coverage** on core services
- Focus on critical paths and business logic
- Don't over-optimize for 100% - test value, not coverage numbers
- UI components: Focus on user interactions and state changes

## What to Test

### Priority 1 (Critical)
- ✅ Core services (EventBus, ActivityParser, SessionRegistry)
- ✅ Business logic and data transformations
- ✅ IPC handlers and message passing
- ✅ Error handling and edge cases

### Priority 2 (Important)
- React components with complex logic
- State management (Zustand stores)
- Git operations and worktree management
- Agent status tracking

### Priority 3 (Nice to have)
- UI components (simple presentational)
- Integration tests
- E2E tests (using Playwright)

## Current Test Coverage

- ✅ EventBus (pub/sub system)
- ✅ ActivityParser (terminal output parsing)

## Future Additions

- [ ] SessionRegistry tests
- [ ] GitWorktreeManager tests
- [ ] IPC handler tests
- [ ] React component tests
- [ ] Integration tests for agent workflows

## Continuous Integration

Tests should run on:
- Every commit (pre-commit hook)
- Pull requests (CI pipeline)
- Before builds and releases

## Debugging Tests

```bash
# Run specific test file
npm test -- EventBus.test.ts

# Run tests matching pattern
npm test -- --grep="should emit events"

# Debug with Node inspector
node --inspect-brk node_modules/vitest/vitest.mjs run

# Use VS Code debugger with breakpoints
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
