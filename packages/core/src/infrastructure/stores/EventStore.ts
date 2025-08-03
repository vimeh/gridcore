import type {
  DomainEvent,
  EventHandler,
  IEventService,
} from "../../domain/interfaces/IEventService"

export class EventStore implements IEventService {
  private handlers = new Map<string, Set<EventHandler<any>>>()
  private eventHistory: DomainEvent[] = []
  private maxHistorySize: number

  constructor(maxHistorySize = 1000) {
    this.maxHistorySize = maxHistorySize
  }

  emit<T extends DomainEvent>(event: T): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date()
    }

    // Store in history
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }

    // Notify handlers
    const handlers = this.handlers.get(event.type)
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(event)
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`Error in async event handler for ${event.type}:`, error)
            })
          }
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error)
        }
      }
    }
  }

  on<T extends DomainEvent>(
    eventType: T["type"],
    handler: EventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
  }

  off<T extends DomainEvent>(
    eventType: T["type"],
    handler: EventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.handlers.delete(eventType)
      }
    }
  }

  clear(): void {
    this.handlers.clear()
    this.eventHistory = []
  }

  getHistory(): DomainEvent[] {
    return [...this.eventHistory]
  }

  getHistoryByType<T extends DomainEvent>(eventType: T["type"]): T[] {
    return this.eventHistory.filter(
      (event): event is T => event.type === eventType
    )
  }
}