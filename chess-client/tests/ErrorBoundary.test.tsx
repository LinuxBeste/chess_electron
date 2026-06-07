import { describe, test, expect, jest, beforeAll } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '../src/renderer/components/ErrorBoundary';

function Good() {
  return <div>All good</div>;
}

class Bomb extends React.Component<object, object> {
  render(): React.ReactNode {
    throw new Error('Boom!');
  }
}

describe('ErrorBoundary', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Good />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  test('catches error and shows fallback', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Boom!')).toBeTruthy();
  });

  test('reload app button exists', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Reload App')).toBeTruthy();
  });
});
