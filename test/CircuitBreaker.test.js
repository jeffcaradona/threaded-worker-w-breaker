import { expect } from "chai";
import CircuitBreaker, {
  CircuitBreakerKeys,
  CircuitBreakerStates,
} from "../src/lib/CircuitBreaker.js";

describe("CircuitBreaker", () => {
  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      const circuitBreaker = new CircuitBreaker();
      expect(circuitBreaker.failureThreshold).to.equal(5);
      expect(circuitBreaker.resetTimeout).to.equal(10000);
    });

    it("should initialize with custom configuration", () => {
      const options = { failureThreshold: 3, resetTimeout: 5000 };
      const circuitBreaker = new CircuitBreaker(options);
      expect(circuitBreaker.failureThreshold).to.equal(3);
      expect(circuitBreaker.resetTimeout).to.equal(5000);
    });

    it("should initialize shared array buffer with correct initial state", () => {
      const circuitBreaker = new CircuitBreaker();
      const sharedArray = circuitBreaker.sharedArray;
      expect(
        Atomics.load(sharedArray, CircuitBreakerKeys.FAILURE_COUNT)
      ).to.equal(0);
      expect(
        Atomics.load(sharedArray, CircuitBreakerKeys.STATE)
      ).to.equal(CircuitBreakerStates.CLOSED);
    });
  });

  describe("execute", () => {
    it("should execute a successful task", async () => {
      const circuitBreaker = new CircuitBreaker();
      const task = async () => "success";
      const result = await circuitBreaker.execute(task);
      expect(result).to.equal("success");
      expect(
        Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.FAILURE_COUNT)
      ).to.equal(0);
      expect(
        Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE)
      ).to.equal(CircuitBreakerStates.CLOSED);
    });

    it("should handle a failed task", async () => {
      const circuitBreaker = new CircuitBreaker();
      const task = async () => {
        throw new Error("failure");
      };
      try {
        await circuitBreaker.execute(task);
      } catch (error) {
        expect(error.message).to.equal("failure");
      }
      expect(
        Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.FAILURE_COUNT)
      ).to.equal(1);
      expect(
        Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE)
      ).to.equal(CircuitBreakerStates.CLOSED);
    });

    it("should open the circuit after reaching failure threshold", async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 2 });
      const task = async () => {
        throw new Error("failure");
      };
      try {
        await circuitBreaker.execute(task);
      } catch (error) {}
      try {
        await circuitBreaker.execute(task);
      } catch (error) {}
      expect(
        Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.FAILURE_COUNT)
      ).to.equal(2);
      expect(
        Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE)
      ).to.equal(CircuitBreakerStates.OPEN);
    });

    it("should transition to HALF-OPEN state after reset timeout", async () => {
        const circuitBreaker = new CircuitBreaker({
          failureThreshold: 1,
          resetTimeout: 100,
        });
        const task = async () => {
          throw new Error("failure");
        };
        try {
          await circuitBreaker.execute(task);
        } catch (error) {}
        expect(
          Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE)
        ).to.equal(CircuitBreakerStates.OPEN);
      
        //console.log("State after failure:", Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE));
      
        await new Promise((resolve) => setTimeout(resolve, 150));
      
        //console.log("State after reset timeout:", Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE));
      
        expect(
          Atomics.load(circuitBreaker.sharedArray, CircuitBreakerKeys.STATE)
        ).to.equal(CircuitBreakerStates.HALF_OPEN);
      });
  });
});