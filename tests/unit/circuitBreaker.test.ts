import { CircuitBreaker } from '../../src/utils/circuitBreaker';
import { CircuitOpenError } from '../../src/utils/errors';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('opens after repeated failures and avoids calling the guarded function', async () => {
    const breaker = new CircuitBreaker({
      name: 'unit_test',
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 50,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(
      breaker.execute(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(
      breaker.execute(async () => {
        return 'should-not-run';
      }),
    ).rejects.toThrow(CircuitOpenError);
  });

  it('enters half-open after the configured timeout and closes after successes', async () => {
    jest.useFakeTimers();
    const onStateChange = jest.fn();
    const breaker = new CircuitBreaker({
      name: 'unit_test_half_open',
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 1000,
      onStateChange,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');

    expect(breaker.getState()).toBe('OPEN');

    jest.advanceTimersByTime(1000);
    expect(breaker.getState()).toBe('HALF_OPEN');

    await breaker.execute(async () => 'ok-1');
    expect(breaker.getState()).toBe('HALF_OPEN');

    await breaker.execute(async () => 'ok-2');
    expect(breaker.getState()).toBe('CLOSED');
    expect(onStateChange).toHaveBeenCalled();
  });

  it('re-opens when the half-open probe fails', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({
      name: 'unit_test_reopen',
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 500,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');

    jest.advanceTimersByTime(500);

    await expect(
      breaker.execute(async () => {
        throw new Error('still bad');
      }),
    ).rejects.toThrow('still bad');

    expect(breaker.getState()).toBe('OPEN');
  });

  it('blocks concurrent half-open probes', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({
      name: 'unit_test_probe',
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 200,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');

    jest.advanceTimersByTime(200);

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = breaker.execute(async () => {
      await gate;
      return 'done';
    });

    await Promise.resolve();

    await expect(
      breaker.execute(async () => {
        return 'should-not-run';
      }),
    ).rejects.toThrow(CircuitOpenError);

    release();
    await first;
  });
});
