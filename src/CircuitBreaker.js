export const CircuitBreakerKeys = {
    FAILURE_COUNT: 0,
    LAST_FAILURE_TIME: 1,
    STATE: 2,
  };
  
  export const CircuitBreakerStates = {
    CLOSED: 0,
    OPEN: 1,
    HALF_OPEN: 2,
  };

class CircuitBreaker {
    constructor(options = {}) {
      this.failureThreshold = options.failureThreshold || 5;
      this.resetTimeout = options.resetTimeout || 10000;
      this.sharedBuffer = new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT);
      this.sharedArray = new Int32Array(this.sharedBuffer);
      Atomics.store(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 0);
      Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.CLOSED);
    }
  
    async execute(task) {
      const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);
      if (state === CircuitBreakerStates.OPEN) {
        throw new Error("Circuit is open");
      }
  
      try {
        const result = await task();
        Atomics.store(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 0);
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }
  
    onFailure() {
      const failureCount = Atomics.add(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 1) + 1;
      Atomics.store(this.sharedArray, CircuitBreakerKeys.LAST_FAILURE_TIME, Date.now());
  
      if (failureCount >= this.failureThreshold) {
        Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.OPEN);
        setTimeout(() => {
          Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.HALF_OPEN);
        }, this.resetTimeout);
      }
    }
  
    getState() {
      const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);
      return Object.keys(CircuitBreakerStates).find(
        (key) => CircuitBreakerStates[key] === state
      );
    }
  
    getSharedBuffer() {
      return this.sharedBuffer;
    }
  }
  
  export default CircuitBreaker;
