import { describe, test, expect, beforeEach } from "bun:test"
import { EventStore } from "./EventStore"
import type {
  CellValueChangedEvent,
  BatchUpdateStartedEvent,
  DomainEvent,
} from "../../domain/interfaces/IEventService"
import { CellAddress } from "../../domain/models/CellAddress"
import { Cell } from "../../domain/models/Cell"

describe("EventStore", () => {
  let eventStore: EventStore

  beforeEach(() => {
    eventStore = new EventStore()
  })

  describe("emit", () => {
    test("adds timestamp if not present", () => {
      const event: DomainEvent = { type: "TestEvent" } as any
      eventStore.emit(event)
      
      expect(event.timestamp).toBeInstanceOf(Date)
    })

    test("preserves existing timestamp", () => {
      const originalTimestamp = new Date("2024-01-01")
      const event: DomainEvent = {
        type: "TestEvent",
        timestamp: originalTimestamp,
      } as any
      
      eventStore.emit(event)
      
      expect(event.timestamp).toBe(originalTimestamp)
    })

    test("stores events in history", () => {
      const event1: DomainEvent = { type: "Event1" } as any
      const event2: DomainEvent = { type: "Event2" } as any
      
      eventStore.emit(event1)
      eventStore.emit(event2)
      
      const history = eventStore.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].type).toBe("Event1")
      expect(history[1].type).toBe("Event2")
    })

    test("limits history size", () => {
      const smallStore = new EventStore(3)
      
      for (let i = 0; i < 5; i++) {
        smallStore.emit({ type: `Event${i}` } as any)
      }
      
      const history = smallStore.getHistory()
      expect(history).toHaveLength(3)
      expect(history[0].type).toBe("Event2")
      expect(history[2].type).toBe("Event4")
    })
  })

  describe("on/off", () => {
    test("registers and calls event handler", () => {
      let called = false
      const handler = () => {
        called = true
      }
      
      eventStore.on("TestEvent", handler)
      eventStore.emit({ type: "TestEvent" } as any)
      
      expect(called).toBe(true)
    })

    test("calls multiple handlers for same event", () => {
      let count = 0
      const handler1 = () => count++
      const handler2 = () => count++
      
      eventStore.on("TestEvent", handler1)
      eventStore.on("TestEvent", handler2)
      eventStore.emit({ type: "TestEvent" } as any)
      
      expect(count).toBe(2)
    })

    test("removes specific handler", () => {
      let called1 = false
      let called2 = false
      const handler1 = () => { called1 = true }
      const handler2 = () => { called2 = true }
      
      eventStore.on("TestEvent", handler1)
      eventStore.on("TestEvent", handler2)
      eventStore.off("TestEvent", handler1)
      eventStore.emit({ type: "TestEvent" } as any)
      
      expect(called1).toBe(false)
      expect(called2).toBe(true)
    })

    test("handles async handlers", async () => {
      let resolved = false
      const handler = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        resolved = true
      }
      
      eventStore.on("TestEvent", handler)
      eventStore.emit({ type: "TestEvent" } as any)
      
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(resolved).toBe(true)
    })

    test("catches errors in sync handlers", () => {
      const handler = () => {
        throw new Error("Test error")
      }
      
      eventStore.on("TestEvent", handler)
      
      // Should not throw
      expect(() => {
        eventStore.emit({ type: "TestEvent" } as any)
      }).not.toThrow()
    })

    test("catches errors in async handlers", async () => {
      const handler = async () => {
        throw new Error("Async test error")
      }
      
      eventStore.on("TestEvent", handler)
      
      // Should not throw
      expect(() => {
        eventStore.emit({ type: "TestEvent" } as any)
      }).not.toThrow()
    })
  })

  describe("typed events", () => {
    test("handles CellValueChangedEvent", () => {
      const address = CellAddress.create(0, 0).value
      const oldCell = Cell.create(42).value
      const newCell = Cell.create(100).value
      
      let capturedEvent: CellValueChangedEvent | undefined
      
      eventStore.on("CellValueChanged", (event) => {
        capturedEvent = event
      })
      
      const event: CellValueChangedEvent = {
        type: "CellValueChanged",
        timestamp: new Date(),
        address,
        oldValue: oldCell,
        newValue: newCell,
      }
      
      eventStore.emit(event)
      
      expect(capturedEvent).toBe(event)
    })

    test("handles BatchUpdateStartedEvent", () => {
      let capturedBatchId: string | undefined
      
      eventStore.on("BatchUpdateStarted", (event) => {
        capturedBatchId = event.batchId
      })
      
      const event: BatchUpdateStartedEvent = {
        type: "BatchUpdateStarted",
        timestamp: new Date(),
        batchId: "batch-123",
      }
      
      eventStore.emit(event)
      
      expect(capturedBatchId).toBe("batch-123")
    })
  })

  describe("clear", () => {
    test("removes all handlers and history", () => {
      let called = false
      const handler = () => { called = true }
      
      eventStore.on("TestEvent", handler)
      eventStore.emit({ type: "TestEvent" } as any)
      
      eventStore.clear()
      
      called = false
      eventStore.emit({ type: "TestEvent" } as any)
      
      expect(called).toBe(false)
      // After clearing, new events are still recorded in history
      expect(eventStore.getHistory()).toHaveLength(1)
    })
  })

  describe("getHistoryByType", () => {
    test("filters history by event type", () => {
      eventStore.emit({ type: "Event1" } as any)
      eventStore.emit({ type: "Event2" } as any)
      eventStore.emit({ type: "Event1" } as any)
      eventStore.emit({ type: "Event3" } as any)
      
      const event1History = eventStore.getHistoryByType("Event1")
      expect(event1History).toHaveLength(2)
      expect(event1History.every(e => e.type === "Event1")).toBe(true)
    })
  })
})