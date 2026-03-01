import { describe, expect, it, vi } from 'vitest';
import { debounce } from '../src/debounce';

describe('performance controls', () => {
  it('debounces repeated calls', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const wrapped = debounce(spy, 500);

    wrapped();
    wrapped();
    wrapped();

    expect(spy).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(499);
    expect(spy).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
