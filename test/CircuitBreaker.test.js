import { strict as assert } from 'assert';
import CircuitBreaker, { CircuitBreakerStates } from '../src/CircuitBreaker.js';

describe('CircuitBreaker', function() {
  it('should initialize with default values', function() {
    const cb = new CircuitBreaker();
    assert.equal(cb.failureThreshold, 5);
    assert.equal(cb.resetTimeout, 10000);
    assert.equal(Atomics.load(cb.sharedArray, 1), CircuitBreakerStates.CLOSED);
  });
});