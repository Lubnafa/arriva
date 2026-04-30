import { CircuitOpenError } from './errors';
import { getLogger } from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerStats = {
  failures: number;
  successes: number;
  state: CircuitState;
  lastFailureAt: number | undefined;
};

export type CircuitBreakerOptions = {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
};

/**
 * Generic circuit breaker protecting arbitrary async operations.
 */
export class CircuitBreaker {
  private readonly name: string;

  private readonly failureThreshold: number;

  private readonly successThreshold: number;

  private readonly timeoutMs: number;

  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  private state: CircuitState = 'CLOSED';

  private failures = 0;

  private successes = 0;

  private lastFailureAt: number | undefined;

  private openedAt: number | undefined;

  private halfOpenProbeInFlight = false;

  public constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold;
    this.successThreshold = options.successThreshold;
    this.timeoutMs = options.timeout;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Executes fn behind breaker semantics (CLOSED/HALF_OPEN/OPEN).
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeAdvanceFromOpen();
    if (this.state === 'OPEN') {
      throw new CircuitOpenError(`Circuit "${this.name}" is OPEN`);
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitOpenError(`Circuit "${this.name}" probe already in flight`);
      }
      this.halfOpenProbeInFlight = true;
      try {
        const result = await fn();
        this.recordHalfOpenSuccess();
        return result;
      } catch (err) {
        this.recordHalfOpenFailure();
        throw err;
      } finally {
        this.halfOpenProbeInFlight = false;
      }
    }

    try {
      const result = await fn();
      this.recordClosedSuccess();
      return result;
    } catch (err) {
      this.recordClosedFailure();
      throw err;
    }
  }

  /** Current breaker state for observability. */
  public getState(): CircuitState {
    this.maybeAdvanceFromOpen();
    return this.state;
  }

  /** Snapshot counters and timing for health checks. */
  public getStats(): CircuitBreakerStats {
    return {
      failures: this.failures,
      successes: this.successes,
      state: this.getState(),
      lastFailureAt: this.lastFailureAt,
    };
  }

  private transitionTo(next: CircuitState): void {
    const prev = this.state;
    if (prev === next) {
      return;
    }
    this.state = next;
    getLogger().warn(
      {
        circuit: this.name,
        from: prev,
        to: next,
      },
      'circuit_breaker_state_change',
    );
    this.onStateChange?.(prev, next);
  }

  private recordClosedSuccess(): void {
    this.failures = 0;
  }

  private recordClosedFailure(): void {
    this.failures += 1;
    this.lastFailureAt = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.openedAt = Date.now();
      this.transitionTo('OPEN');
    }
  }

  private recordHalfOpenSuccess(): void {
    this.successes += 1;
    if (this.successes >= this.successThreshold) {
      this.failures = 0;
      this.successes = 0;
      this.openedAt = undefined;
      this.transitionTo('CLOSED');
    }
  }

  private recordHalfOpenFailure(): void {
    this.successes = 0;
    this.openedAt = Date.now();
    this.transitionTo('OPEN');
  }

  private maybeAdvanceFromOpen(): void {
    if (this.state !== 'OPEN' || this.openedAt === undefined) {
      return;
    }
    if (Date.now() - this.openedAt < this.timeoutMs) {
      return;
    }
    this.openedAt = undefined;
    this.successes = 0;
    this.halfOpenProbeInFlight = false;
    this.transitionTo('HALF_OPEN');
  }
}
