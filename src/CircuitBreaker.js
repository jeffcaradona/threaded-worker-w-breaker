// Define keys for shared state in the SharedArrayBuffer
export const CircuitBreakerKeys = Object.freeze({
    FAILURE_COUNT: 0,      // Index 0: Tracks the failure count
    STATE: 1,              // Index 1: Tracks the current circuit state
    LAST_FAILURE_TIME: 2,  // Index 2: Timestamp of the last failure
  });


// Define the CircuitBreakerStates enum
export const CircuitBreakerStates = Object.freeze({
  CLOSED: 0, // Default state
  OPEN: 1, // Circuit is open do not attempt to call the service
  HALF_OPEN: 2, // Circuit is half-open to test if the service is available again, before closing the circuit. 
});

export default class CircuitBreaker {
    constructor(options = {}) {
      const { failureThreshold = 5, resetTimeout = 10000 } = options; // Configuration defaults, 5 failures in 10 seconds
  
      // Configuration
      this.failureThreshold = failureThreshold;
      this.resetTimeout = resetTimeout;
  
      // Shared state using SharedArrayBuffer
      this.sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 3);
      this.sharedArray = new Int32Array(this.sharedBuffer);
  
      // Initialize shared state
      Atomics.store(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 0); // failureCount
      Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.CLOSED); // Initial state
      Atomics.store(this.sharedArray, CircuitBreakerKeys.LAST_FAILURE_TIME, 0); // lastFailureTime
    }
  
    // Executes a task with thread-safe circuit breaker logic
    async execute(task) {
      const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);
  
      if (state === CircuitBreakerStates.OPEN) {
        const timeSinceLastFailure = Date.now() - Atomics.load(this.sharedArray, CircuitBreakerKeys.LAST_FAILURE_TIME);
        if (timeSinceLastFailure > this.resetTimeout) {
          Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.HALF_OPEN); // Transition to HALF-OPEN
        } else {
          throw new Error('Circuit is OPEN, rejecting task.');
        }
      }
  
      try {
        const result = await task();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }
  
    // Called when a task succeeds
    onSuccess() {
      const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);
      if (state === CircuitBreakerStates.HALF_OPEN) {
        Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.CLOSED); // Transition to CLOSED
      }
      Atomics.store(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 0); // Reset failure count
    }
  
    // Called when a task fails
    onFailure() {
      const failureCount = Atomics.add(this.sharedArray, CircuitBreakerKeys.FAILURE_COUNT, 1) + 1; // Increment failure count
      Atomics.store(this.sharedArray, CircuitBreakerKeys.LAST_FAILURE_TIME, Date.now()); // Update last failure time
  
      if (failureCount >= this.failureThreshold) {
        Atomics.store(this.sharedArray, CircuitBreakerKeys.STATE, CircuitBreakerStates.OPEN); // Transition to OPEN
      }
    }
  
    // Get the current state of the circuit (CLOSED, OPEN, HALF-OPEN)
    getState() {
      const state = Atomics.load(this.sharedArray, CircuitBreakerKeys.STATE);
      return Object.keys(CircuitBreakerStates).find(
        (key) => CircuitBreakerStates[key] === state
      );
    }
  
    // Share the buffer for worker threads
    getSharedBuffer() {
      return this.sharedBuffer;
    }
  }