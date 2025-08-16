⎿  Simplified Plan: Leverage Leptos Reactive Primitives Without Duplication

```
 Problem Analysis

 The current code uses 7 Triggers to manually notify when controller state changes. This is an anti-pattern because:
 1. We're manually managing reactivity instead of letting Leptos handle it
 2. The controller already has an event system - we're duplicating it with triggers
 3. We're using Memos that track triggers just to read controller state

 New Approach: Minimal, Focused Reactive Helpers

 Instead of wrapping the entire controller, we'll:
 1. Keep using SpreadsheetController directly - no wrapper
 2. Create a single reactive state signal that updates when controller events fire
 3. Use derived signals for specific UI needs - let Leptos track dependencies automatically
 4. Use effects only for DOM/canvas rendering - not for state synchronization

 Implementation Plan

 1. Create a Simple Reactive Helper (src/reactive/mod.rs)

 // Single source of truth: a generation counter that changes when controller state changes
 pub fn create_reactive_state(controller: Rc<RefCell<SpreadsheetController>>) -> RwSignal<u32> {
     let generation = RwSignal::new(0);

     // Subscribe to controller events and increment generation
     controller.borrow_mut().subscribe_to_events(Box::new(move |_event| {
         generation.update(|g| *g += 1);
     }));

     generation
 }

 2. Replace Triggers with Derived Signals in app.rs

 // Instead of 7 triggers, one reactive state signal
 let state_generation = create_reactive_state(controller.clone());

 // Derived signals that automatically track state_generation
 let active_cell = Signal::derive(move || {
     state_generation.get(); // Track changes
     controller_stored.with_value(|c| c.borrow().cursor())
 });

 let formula_bar_value = Signal::derive(move || {
     state_generation.get(); // Track changes
     controller_stored.with_value(|c| c.borrow().get_formula_bar_value().to_string())
 });

 // Similar for other derived state...

 3. Optimize Heavy Operations with Selective Reactivity

 For expensive operations like selection stats, use memos with specific tracking:
 // Only recalculate when we know selection changed
 let selection_version = RwSignal::new(0);

 // In event handler, only for selection events:
 if matches!(event, SpreadsheetEvent::StateChanged) {
     selection_version.update(|v| *v += 1);
 }

 let selection_stats = Memo::new(move |_| {
     selection_version.get();
     controller_stored.with_value(|c| c.borrow().get_current_selection_stats())
 });

 4. Use Effects Only for Canvas Rendering

 // Canvas rendering is the ONLY legitimate use of effects here
 Effect::new(move |_| {
     state_generation.get(); // Track any state change

     // Render to canvas (side effect to non-reactive DOM)
     if let Some(canvas) = canvas_ref.get() {
         render_grid(&canvas, &controller);
     }
 });

 5. Direct Event Handling Without Intermediate State

 // In GridEventHandler - directly update controller, no trigger.notify()
 let on_click = move |ev: MouseEvent| {
     let cell = calculate_cell_from_position(ev);
     controller.borrow_mut().set_cursor(cell);
     // State change will trigger reactive updates automatically via events
 };

 Benefits of This Approach

 1. Minimal Code Changes - We keep the existing controller architecture
 2. No Duplication - We're not recreating controller functionality
 3. True Reactivity - Leptos handles dependency tracking automatically
 4. Better Performance - Fine-grained updates only when needed
 5. Follows Leptos Best Practices - Derived signals for transformations, effects only for side effects

 Files to Modify

 1. Create src/reactive/mod.rs - Simple reactive helper (20 lines)
 2. Update src/app.rs - Replace triggers with derived signals
 3. Update components - Remove trigger props, use derived signals from context
 4. Simplify GridCanvas - Single effect for rendering
 5. Clean up GridEventHandler - Remove manual trigger notifications

 What We're NOT Doing

 - ❌ Creating a ReactiveController wrapper
 - ❌ Duplicating controller methods
 - ❌ Using effects to sync signals
 - ❌ Manual dependency tracking with triggers
 - ❌ Complex state management layers

 This approach is much simpler, more idiomatic Leptos, and maintains clean separation between the controller (business logic) and UI (reactive layer).
```
