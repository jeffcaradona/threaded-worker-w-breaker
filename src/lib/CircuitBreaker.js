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
  constructor(sharedArray, failureThreshold, resetTimeout, openFallback = null, failureFallback = null) {
    this.sharedArray = sharedArray;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.openFallback = openFallback;
    this.failureFallback = failureFallback;
    
    Atomics.store(
      this.sharedArray,
      CircuitBreakerKeys.STATE,
      CircuitBreakerStates.CLOSED
    );
    Atomics.store(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 0);
  }

  async execute(task) {
    const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);
    if (state === CircuitBreakerStates.OPEN) {
      if (this.openFallback) {
        return this.openFallback();
      }
      throw new Error("Circuit is open"); 
    }

    try {
      const result = await task();
      Atomics.store(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 0);
      return result;
    } catch (error) {
      this.onFailure();
      if (this.failureFallback) {
        return this.failureFallback();
      }
      throw error;
    }
  }

  onFailure() {
    const failureCount =
      Atomics.add(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 1) + 1;

    Atomics.store(
      this.sharedArray,
      CircuitBreakerKeys.LAST_FAILURE_TIME,
      Date.now()
    );

    if (failureCount >= this.failureThreshold) {
      Atomics.store(
        this.sharedArray,
        CircuitBreakerKeys.STATE,
        CircuitBreakerStates.OPEN
      );

      setTimeout(() => {
        Atomics.store(
          this.sharedArray,
          CircuitBreakerKeys.STATE,
          CircuitBreakerStates.HALF_OPEN
        );
      }, this.resetTimeout + 1000); // Adjusted timeout to ensure state transition
    }
  }

  transitionToHalfOpen() {
    Atomics.store(
      this.sharedArray,
      CircuitBreakerKeys.STATE,
      CircuitBreakerStates.HALF_OPEN
    );
  }

  getState() {
    const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);

    return Object.keys(CircuitBreakerStates).find(
      (key) => CircuitBreakerStates[key] === state
    );
  }

  getSharedBuffer() {
    return this.sharedArray.buffer;
  }
}

export default CircuitBreaker;
