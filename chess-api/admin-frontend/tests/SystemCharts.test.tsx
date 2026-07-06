import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import SystemCharts from '../src/SystemCharts';

vi.mock('../src/api', () => ({
  api: vi.fn(),
}));

import { api } from '../src/api';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function makeSample(
  overrides: Partial<import('../src/api').SystemMetricsSample> = {},
): import('../src/api').SystemMetricsSample {
  return {
    cpu: 45.2,
    memory: { used: 4_000_000_000, total: 8_000_000_000, percent: 50 },
    net: { rx: 1_000_000, tx: 500_000 },
    disk: { read: 200_000, write: 100_000 },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('SystemCharts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns null when no samples', () => {
    vi.mocked(api).mockResolvedValue(makeSample());
    const { container } = render(<SystemCharts />);
    expect(container.innerHTML).toBe('');
  });

  test('renders chart cards after receiving samples', async () => {
    vi.mocked(api).mockResolvedValue(makeSample());
    render(<SystemCharts />);
    await vi.waitFor(() => {
      expect(screen.getByText('CPU')).toBeTruthy();
    });
  });

  test('renders all six chart labels', async () => {
    vi.mocked(api).mockResolvedValue(makeSample());
    render(<SystemCharts />);
    await vi.waitFor(() => {
      expect(screen.getByText('CPU')).toBeTruthy();
      expect(screen.getByText('RAM')).toBeTruthy();
      expect(screen.getByText('Net RX')).toBeTruthy();
      expect(screen.getByText('Net TX')).toBeTruthy();
      expect(screen.getByText('Disk Read')).toBeTruthy();
      expect(screen.getByText('Disk Write')).toBeTruthy();
    });
  });

  test('displays live graphs heading', async () => {
    vi.mocked(api).mockResolvedValue(makeSample());
    render(<SystemCharts />);
    await vi.waitFor(() => {
      expect(screen.getByText('Live Graphs')).toBeTruthy();
    });
  });

  test('polls api on mount', async () => {
    vi.mocked(api).mockResolvedValue(makeSample());
    render(<SystemCharts />);
    await vi.waitFor(() => {
      expect(api).toHaveBeenCalledWith('/system/metrics');
    });
  });
});
