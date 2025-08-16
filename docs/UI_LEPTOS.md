```
 Based on the Leptos documentation, here's an improved plan that follows best practices:

 1. Replace Custom Triggers with Derived Signals (UPDATED)

 Current Issues:
 - Using 7 separate Trigger instances for state updates
 - Manual trigger.notify() calls violate Leptos best practices
 - Creates unnecessary effect chains

 Proposed Changes:
 - Create source signals for actual state (cursor, mode, formula, selection)
 - Use derived signals (closures) instead of triggers for computed values
 - Avoid effects that write to other signals (anti-pattern)
 - Use .with() and .update() to minimize cloning

 Example transformation:
 // Before (anti-pattern):
 let cursor_trigger = Trigger::new();
 let active_cell = Memo::new(move |_| {
     cursor_trigger.track();
     controller_stored.with_value(|ctrl| ctrl.borrow().cursor())
 });

 // After (best practice):
 let cursor = RwSignal::new(CellAddress::new(0, 0));
 let active_cell = move || cursor.get(); // Simple derived signal

 2. Optimize Signal Access Patterns (NEW)

 Based on Leptos best practices:
 - Use .with() instead of .get() for large data structures to avoid cloning
 - Use .update() for in-place mutations
 - Use .read() for immutable references when cloning is expensive

 Specific optimizations:
 // Before:
 let selection = controller_stored.with_value(|ctrl| ctrl.borrow().get_selection().cloned());

 // After:
 selection_signal.with(|sel| {
     // Work with selection by reference, no clone
     render_selection(sel);
 });

 3. Proper Effect Usage (UPDATED)

 Key principle: Effects are ONLY for synchronizing with the non-reactive world

 Current misuse:
 - Using effects to update other signals
 - Complex effect chains for state propagation

 Correct usage:
 - Effects only for DOM updates, canvas rendering, console logging
 - Use derived signals for transformations between reactive values
 - Effects for controller synchronization (non-reactive external system)

 Example:
 // Good: Effect for canvas rendering (non-reactive DOM)
 Effect::new(move |_| {
     let state = cursor.get();
     render_canvas(state); // Side effect to DOM
 });

 // Bad: Effect updating another signal
 Effect::new(move |_| {
     set_derived.set(source.get() * 2); // Anti-pattern!
 });

 4. Simplify State Management with Reactive Wrappers (UPDATED)

 New approach based on signal best practices:
 // Create a reactive controller wrapper
 pub struct ReactiveController {
     // Source signals (single source of truth)
     cursor: RwSignal<CellAddress>,
     mode: RwSignal<SpreadsheetMode>,
     selection: RwSignal<Option<Selection>>,
     formula: RwSignal<String>,

     // Keep controller for business logic
     controller: Rc<RefCell<SpreadsheetController>>,
 }

 impl ReactiveController {
     // Use .update() for efficient mutations
     pub fn move_cursor(&self, direction: Direction) {
         self.cursor.update(|c| {
             *c = calculate_new_position(*c, direction);
         });
         // Sync with controller
         self.sync_cursor_to_controller();
     }

     // Use .with() to avoid cloning
     pub fn with_selection<R>(&self, f: impl FnOnce(&Option<Selection>) -> R) -> R {
         self.selection.with(f)
     }
 }

 5. Component-Specific Improvements (UPDATED)

 GridCanvas:
 // Use proper effect for canvas rendering
 Effect::new(move |_| {
     // Track all dependencies automatically
     let cursor = cursor_signal.get();
     let selection = selection_signal.with(|s| s.clone());

     // Canvas rendering is a side effect to non-reactive DOM
     if let Some(canvas) = canvas_ref.get() {
         render_to_canvas(&canvas, cursor, selection);
     }
 });

 GridEventHandler:
 // Direct signal updates, no effects needed
 let on_click = move |ev: MouseEvent| {
     let cell = calculate_cell_from_mouse(ev);
     cursor_signal.set(cell); // Direct update
     // Controller sync happens in a single effect
 };

 GridContainer:
 // Use derived signals for computed state
 let editing_mode = move || {
     matches!(mode_signal.get(), SpreadsheetMode::Editing { .. })
 };

 let cell_position = move || {
     if editing_mode() {
         let cell = cursor_signal.get();
         viewport.with(|vp| vp.get_cell_position(&cell))
     } else {
         Default::default()
     }
 };

 6. Avoid Common Pitfalls (NEW)

 Things to avoid:
 1. ❌ Effects that write to signals (use derived signals instead)
 2. ❌ Unnecessary .get() calls on large data (use .with())
 3. ❌ Creating signals for derived state (use closures)
 4. ❌ Manual dependency tracking (let Leptos handle it)

 Things to embrace:
 1. ✅ Derived signals as simple closures
 2. ✅ .update() for in-place mutations
 3. ✅ .with() for working with references
 4. ✅ Effects only for external side effects

 7. Implementation Order (UPDATED)

 Phase 1: Create Reactive State Layer
 - New ReactiveController with source signals
 - Implement .with() and .update() patterns
 - Single effect for controller synchronization

 Phase 2: Replace Triggers with Signals
 - Convert each trigger to appropriate signal
 - Replace Memo tracking with derived signals
 - Remove manual notify() calls

 Phase 3: Optimize Signal Access
 - Replace .get() with .with() where appropriate
 - Use .update() for mutations
 - Minimize cloning of large structures

 Phase 4: Simplify Effects
 - Remove effect chains
 - Keep effects only for DOM/canvas updates
 - Use derived signals for all transformations

 Benefits of Updated Approach

 1. Better Performance: Minimized cloning, efficient updates
 2. Cleaner Code: No manual dependency tracking
 3. Follows Best Practices: Aligns with Leptos philosophy
 4. Reduced Complexity: No effect chains or trigger management
 5. Automatic Optimization: Leptos handles fine-grained updates

 This updated plan better leverages Leptos's reactive system while avoiding common pitfalls and anti-patterns identified in the documentation.
```
