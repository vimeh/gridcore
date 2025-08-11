# Calendar Application Architecture Plan

## Overview

This document outlines the architecture for a calendar application built using the same three-layer architecture pattern as GridCore. The application will maintain strict separation between business logic, state management, and presentation layers.

## Project Structure

```
calendar-rs/
├── calendar-core/         # Pure business logic (no UI dependencies)
├── calendar-controller/    # State management and coordination
└── calendar-ui/           # Leptos/WebAssembly rendering layer
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│           calendar-ui                   │
│  (Pure Rendering - Leptos/WebAssembly)  │
│  • Event capture                        │
│  • Canvas rendering                     │
│  • Thin controller wrappers             │
└──────────────────┬──────────────────────┘
                   │ Delegates to
┌──────────────────▼──────────────────────┐
│        calendar-controller              │
│     (State & Coordination Layer)        │
│  • ViewManager                          │
│  • SelectionManager                     │
│  • NavigationManager                    │
│  • Event interpretation                 │
│  • Drag & drop coordination             │
└──────────────────┬──────────────────────┘
                   │ Uses
┌──────────────────▼──────────────────────┐
│          calendar-core                  │
│      (Pure Business Logic)              │
│  • Event management                     │
│  • Recurrence engine                    │
│  • Conflict detection                   │
│  • Undo/redo system                     │
│  • Data structures                      │
└─────────────────────────────────────────┘
```

## Layer 1: calendar-core (Business Logic)

### Purpose
Pure calendar business logic with zero UI dependencies. This layer handles all calendar operations, event management, and business rules.

### Key Components

#### Domain Models
```rust
// Event - Core domain model
struct Event {
    id: EventId,
    title: String,
    description: Option<String>,
    start_time: DateTime,
    end_time: DateTime,
    location: Option<String>,
    attendees: Vec<Attendee>,
    recurrence: Option<RecurrenceRule>,
    reminders: Vec<Reminder>,
    color: Option<Color>,
    category: Option<Category>,
}

// Supporting types
struct RecurrenceRule {
    frequency: RecurrenceFrequency, // Daily, Weekly, Monthly, Yearly
    interval: u32,
    end_condition: RecurrenceEnd,
    exceptions: Vec<DateTime>,
}

struct Reminder {
    time_before: Duration,
    notification_type: NotificationType,
}
```

#### Core Services
- **CalendarFacade**: Main API for calendar operations
  - Create, update, delete events
  - Query events by date range
  - Handle recurring events
  
- **RecurrenceEngine**: Handle recurring event logic
  - Generate occurrences
  - Handle exceptions
  - Calculate next occurrence
  
- **ConflictDetector**: Check for overlapping events
  - Detect time conflicts
  - Suggest alternative times
  - Handle resource conflicts
  
- **ReminderManager**: Notification scheduling
  - Schedule reminders
  - Track notification status
  - Handle snooze/dismiss

#### Command System
```rust
trait CalendarCommand {
    fn execute(&self, executor: &mut dyn CommandExecutor) -> Result<()>;
    fn undo(&self, executor: &mut dyn CommandExecutor) -> Result<()>;
    fn description(&self) -> String;
}

// Example commands
struct CreateEventCommand { ... }
struct UpdateEventCommand { ... }
struct DeleteEventCommand { ... }
struct MoveEventCommand { ... }
```

#### Ports (Interfaces)
```rust
trait RepositoryPort {
    fn get_event(&self, id: &EventId) -> Option<Event>;
    fn get_events_in_range(&self, start: DateTime, end: DateTime) -> Vec<Event>;
    fn save_event(&self, event: Event) -> Result<()>;
    fn delete_event(&self, id: &EventId) -> Result<()>;
}

trait EventPort {
    fn publish(&self, event: DomainEvent) -> Result<()>;
}

trait NotificationPort {
    fn schedule(&self, reminder: Reminder, event_id: EventId) -> Result<()>;
    fn cancel(&self, reminder_id: ReminderId) -> Result<()>;
}
```

## Layer 2: calendar-controller (State & Coordination)

### Purpose
Bridges core business logic with UI, managing state transitions, view coordination, and user interactions.

### Key Components

#### CalendarController
Main orchestrator that coordinates all managers and handles state transitions.

```rust
struct CalendarController {
    state_machine: UIStateMachine,
    facade: CalendarFacade,
    view_manager: ViewManager,
    selection_manager: SelectionManager,
    navigation_manager: NavigationManager,
    drag_drop_manager: DragDropManager,
}
```

#### View Management
```rust
enum CalendarView {
    Month { year: i32, month: u32 },
    Week { week_start: DateTime },
    Day { date: DateTime },
    Agenda { start: DateTime, end: DateTime },
    Year { year: i32 },
}

struct ViewManager {
    current_view: CalendarView,
    viewport_info: ViewportInfo,
    visible_events: Vec<EventId>,
}
```

#### State Machine
```rust
enum UIState {
    Viewing {
        view: CalendarView,
        selected_date: Option<DateTime>,
    },
    Creating {
        start_time: DateTime,
        draft_event: DraftEvent,
    },
    Editing {
        event_id: EventId,
        draft_changes: EventChanges,
    },
    DraggingEvent {
        event_id: EventId,
        start_pos: Position,
        current_pos: Position,
        preview_time: DateTime,
    },
    SelectingTimeRange {
        start: DateTime,
        end: DateTime,
    },
}

enum Action {
    NavigateToDate { date: DateTime },
    ChangeView { view: CalendarView },
    StartEventCreation { time: DateTime },
    SubmitEvent { event: Event },
    CancelEventCreation,
    StartEventEdit { event_id: EventId },
    UpdateEventDraft { changes: EventChanges },
    SaveEventChanges,
    DeleteEvent { event_id: EventId },
    StartDrag { event_id: EventId, position: Position },
    UpdateDrag { position: Position },
    CompleteDrag,
    CancelDrag,
}
```

#### Selection Management
```rust
struct SelectionManager {
    selected_date: Option<DateTime>,
    selected_events: Vec<EventId>,
    selected_time_range: Option<TimeRange>,
    multi_select_mode: bool,
}
```

#### Navigation
```rust
struct NavigationManager {
    current_date: DateTime,
    view_stack: Vec<CalendarView>, // For back/forward navigation
    bookmarks: Vec<DateTime>,
}
```

## Layer 3: calendar-ui (Presentation)

### Purpose
Pure rendering layer using Leptos and WebAssembly. All business logic is delegated to the controller.

### Key Components

#### Main Application Component
```rust
#[component]
pub fn CalendarApp() -> impl IntoView {
    let controller = Rc::new(RefCell::new(CalendarController::new()));
    
    view! {
        <div class="calendar-app">
            <CalendarHeader/>
            <CalendarToolbar/>
            <CalendarGrid/>
            <EventEditor/>
            <MiniCalendar/>
        </div>
    }
}
```

#### Calendar Grid (Canvas-based)
```rust
#[component]
pub fn CalendarGrid() -> impl IntoView {
    // Canvas-based rendering for performance
    // Delegates all logic to controller
    // Only handles:
    // - Canvas setup
    // - Event capture
    // - Render calls
}
```

#### Components
- **CalendarHeader**: Title, navigation arrows, today button
- **CalendarToolbar**: View selector, search, filters
- **CalendarGrid**: Main calendar display (month/week/day)
- **EventEditor**: Modal/sidebar for event creation/editing
- **EventCard**: Individual event display
- **MiniCalendar**: Date picker widget
- **EventList**: Agenda/list view component
- **TimeSlotPicker**: Time selection interface

#### Rendering Strategy
- Canvas-based grid for performance
- Virtual scrolling for agenda view
- Efficient diff-based updates
- Responsive design with breakpoints

## Key Patterns

### 1. Command Pattern
All modifications as undoable commands for undo/redo support.

### 2. Repository Pattern
Abstract data persistence with ports and adapters.

### 3. State Machine Pattern
Explicit state transitions for predictable UI behavior.

### 4. Observer Pattern
Reactive updates using Leptos signals.

### 5. Facade Pattern
Clean API boundaries between layers.

### 6. Manager Pattern
Specialized managers for different concerns (view, selection, navigation).

## Implementation Phases

### Phase 1: Core Layer Foundation
- [ ] Set up Rust workspace structure
- [ ] Define Event domain model
- [ ] Implement CalendarFacade
- [ ] Create command system for undo/redo
- [ ] Build basic RecurrenceEngine
- [ ] Implement repository ports
- [ ] Add unit tests for core logic

### Phase 2: Controller Layer
- [ ] Implement UIStateMachine
- [ ] Create ViewManager for different calendar views
- [ ] Build SelectionManager
- [ ] Implement NavigationManager
- [ ] Add event handlers and action dispatching
- [ ] Create controller tests

### Phase 3: Basic UI
- [ ] Set up Leptos project with Trunk
- [ ] Create calendar grid component (month view)
- [ ] Implement basic event rendering
- [ ] Add click/navigation handlers
- [ ] Create event editor form
- [ ] Wire up to controller

### Phase 4: Advanced Features
- [ ] Add week and day views
- [ ] Implement drag-and-drop for events
- [ ] Add keyboard navigation
- [ ] Create agenda/list view
- [ ] Implement mini calendar
- [ ] Add time slot selection

### Phase 5: Recurring Events
- [ ] Complete RecurrenceEngine implementation
- [ ] Add recurrence UI in event editor
- [ ] Handle recurrence exceptions
- [ ] Implement "edit this/all" for recurring events

### Phase 6: Polish & Optimization
- [ ] Add search and filtering
- [ ] Implement reminders/notifications
- [ ] Add import/export (ICS format)
- [ ] Performance optimizations
- [ ] Accessibility improvements
- [ ] Mobile responsive design

## Testing Strategy

### Unit Tests
- Core layer: Test business logic in isolation
- Controller layer: Test state transitions
- Mock implementations of ports for testing

### Integration Tests
- Test layer interactions
- End-to-end workflows
- State persistence

### E2E Tests
- Playwright tests for UI interactions
- Visual regression tests
- Performance benchmarks

## Performance Considerations

### Rendering Optimization
- Canvas-based rendering for grid
- Virtual scrolling for long lists
- Efficient diff algorithms
- Request animation frame for smooth updates

### Data Management
- Lazy loading of events
- Caching strategies
- Pagination for large datasets
- Indexed lookups for quick queries

### Memory Management
- Object pooling for frequent allocations
- Weak references where appropriate
- Cleanup of event listeners

## Security Considerations

- Input validation for all user data
- XSS prevention in event descriptions
- CSRF protection for API calls
- Secure storage of sensitive data
- Rate limiting for API requests

## Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management

## Future Enhancements

### Collaboration Features
- Real-time updates
- Shared calendars
- Comments on events
- Change tracking

### Advanced Scheduling
- Meeting room booking
- Resource management
- Availability checking
- Smart scheduling suggestions

### Integrations
- External calendar sync (Google, Outlook)
- Video conferencing links
- Task management integration
- Weather information

### Analytics
- Time tracking
- Meeting statistics
- Productivity insights
- Calendar heatmaps

## Technology Stack

### Core Technologies
- **Rust**: System programming language
- **Leptos**: Reactive web framework
- **WebAssembly**: Compilation target
- **Trunk**: Build tool for Rust/WASM

### Development Tools
- **cargo**: Rust package manager
- **wasm-pack**: WASM packaging
- **Playwright**: E2E testing
- **cargo-watch**: Auto-rebuild

### Libraries
- **chrono**: Date/time handling
- **serde**: Serialization
- **uuid**: Event IDs
- **ical**: ICS format support

## Conclusion

This architecture ensures:
- **Clean separation of concerns**: Each layer has distinct responsibilities
- **Testability**: Each layer can be tested in isolation
- **Reusability**: Core layer can power different UIs (web, CLI, API)
- **Maintainability**: Clear boundaries and patterns
- **Performance**: Efficient rendering and data management
- **Scalability**: Architecture supports growth and new features

The three-layer architecture proven in GridCore provides a solid foundation for building a robust, maintainable calendar application.