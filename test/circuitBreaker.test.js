// test/circuitBreaker.test.js
import { expect } from 'chai';
import CircuitBreaker, { CircuitBreakerStates } from '../src/circuitBreaker.js';

describe('CircuitBreaker', () => {
  it('should start in the CLOSED state', () => {
    const circuitBreaker = new CircuitBreaker();
    expect(circuitBreaker.getState()).to.equal('CLOSED');
  });

  it('should transition to OPEN after exceeding the failure threshold', async () => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 3 });

    const failingTask = async () => {
      throw new Error('Task failed');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingTask);
      } catch (e) {
        // Catch the expected errors
      }
    }

    expect(circuitBreaker.getState()).to.equal('OPEN');
  });

  it('should transition to HALF-OPEN after reset timeout', (done) => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 500 });

    const failingTask = async () => {
      throw new Error('Task failed');
    };

    circuitBreaker.execute(failingTask).catch(() => {
      setTimeout(() => {
        expect(circuitBreaker.getState()).to.equal('HALF-OPEN');
        done();
      }, 600); // Wait slightly longer than the reset timeout
    });
  });

  it('should transition back to CLOSED on success in HALF-OPEN state', (done) => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 500 });

    const failingTask = async () => {
      throw new Error('Task failed');
    };

    const successfulTask = async () => {
      return 'Task succeeded';
    };

    circuitBreaker.execute(failingTask).catch(() => {
      setTimeout(async () => {
        try {
          const result = await circuitBreaker.execute(successfulTask);
          expect(result).to.equal('Task succeeded');
          expect(circuitBreaker.getState()).to.equal('CLOSED');
          done();
        } catch (e) {
          done(e);
        }
      }, 600); // Wait slightly longer than the reset timeout
    });
  });
});
