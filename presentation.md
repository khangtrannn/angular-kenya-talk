# The Beauties of Angular Signals — Revised Talk Chapter

> Revised integrated flow for the Angular Signals talk.
>
> This version tightens the story from vanilla JavaScript manual rendering, to Zone.js, to `tick()`, to the component tree, to NG0100, and finally to why Signals change the model from detection to synchronization.

---

## Revised Narrative Flow

```text
Vanilla JS:
  state changes → developer must call render()

Zone.js:
  callback finished → Angular runs tick()

tick():
  Angular walks the component tree

Old Angular model:
  one pass should be stable

NG0100:
  a checked value changed too late

Signals:
  this exact state changed → mark exact consumers dirty → synchronize until stable
```

---

# SECTION 2 — Change Detection 101

**Target time: 14 min**

---

## Slide 2.1 — What Is Change Detection?

```text
State → synchronization → UI
```

> **Speaker note:**  
> "Change detection is simply this: given a piece of state, the UI must reflect it.
>
> That's the contract.
>
> The question is how and when the framework fulfills that contract. Let's build this from scratch with something very small: a counter."

---

## Slide 2.2 — Vanilla JS: State Does Not Update the UI

```javascript
const state = { count: 0 };

const counter = document.getElementById('counter');

function render() {
  counter.textContent = state.count;
}

render(); // initial sync
```

```html
<button id="increment">Increment</button>
<span id="counter"></span>
```

> **Speaker note:**  
> "Let's start with the simplest possible UI: a counter. We have some state, and we have the DOM.
>
> But notice something important: the DOM does not know that `state.count` exists.
>
> The only thing that connects state to the UI is this `render()` function.
>
> If we call it, the UI is synchronized.
>
> If we don't call it, the UI is stale."

---

## Slide 2.3 — The Manual Render Problem

```javascript
document.getElementById('increment').addEventListener('click', () => {
  state.count++;
  render(); // ✅ remember to sync
});

setTimeout(() => {
  state.count++;
  render(); // ✅ remember again
}, 1000);

fetch('/api/count')
  .then(response => response.json())
  .then(data => {
    state.count = data.count;
    render(); // ✅ remember again
  });
```

> **Speaker note:**  
> "Every time state changes, we have to remember to call `render()`.
>
> It doesn't matter whether the change comes from a click, a timer, a Promise, or an API response.
>
> The rule is always the same: state changed, so we must manually synchronize the UI.
>
> In a small demo, this is fine. But in a real app, state can change from hundreds of places.
>
> Forget `render()` once, and your state is correct but your UI is wrong.
>
> This is the problem frameworks try to solve."

**Transition:**

> "The problem is not really async. The problem is that the browser gives us many places where state can change, but no built-in way to know that the UI should be synchronized afterward. Zone.js was Angular's first big answer to that problem."

---

## Slide 2.4 — Zone.js: “Let Me Call Angular For You”

```javascript
// Zone.js patches the places where work enters your app
// Simplified mental model:

const originalAddEventListener = Element.prototype.addEventListener;

Element.prototype.addEventListener = function(eventName, callback) {
  return originalAddEventListener.call(this, eventName, () => {
    callback();

    // Angular: something may have changed,
    // let's synchronize the UI
    notifyAngular();
  });
};
```

```javascript
// Same idea for:
setTimeout(...)
setInterval(...)
Promise.then(...)
fetch(...).then(...)
XMLHttpRequest(...)
```

> **Speaker note:**  
> "In vanilla JavaScript, we had to remember to call `render()` every time state changed.
>
> Zone.js says: what if developers don't have to remember?
>
> What if we intercept the places where work enters the app — clicks, timers, promises, HTTP responses — and after that work finishes, we tell Angular: something may have changed.
>
> That is the key idea.
>
> Zone.js does not know that `count` changed. It does not know which component changed. It only knows that some callback finished.
>
> So Zone.js answers the first big question: **WHEN should Angular update?**
>
> But it cannot answer the second question: **WHAT exactly changed?**
>
> And because Angular doesn't know what changed, the safest thing it can do is check everything."

**Transition:**

> "So how does Zone.js decide that a callback is finished and Angular should run? That brings us to one important concept: stability — specifically, when the microtask queue becomes empty."

---

## Slide 2.5 — From “Something Happened” to `tick()`

```text
A callback finishes
        ↓
microtasks are drained
        ↓
Zone.js: "Angular, something may have changed"
        ↓
ApplicationRef.tick()
        ↓
Angular checks the component tree
```

```typescript
// Simplified Angular + Zone.js mental model
this.zone.onMicrotaskEmpty.subscribe(() => {
  this.applicationRef.tick();
});
```

```typescript
// What tick() means conceptually
tick() {
  for (const view of allViews) {
    detectChanges(view);
  }
}
```

> **Speaker note:**  
> "Now we can connect the dots.
>
> Zone.js does not directly update the UI. It only tells Angular: a callback finished, the microtask queue is empty, something may have changed.
>
> Angular responds by calling `ApplicationRef.tick()`.
>
> And `tick()` is basically Angular saying: I don't know what changed, so I need to walk the component tree and check the views.
>
> This is the important tradeoff.
>
> Zone.js removes the need for us to manually call `render()`, but it still cannot tell Angular what changed.
>
> It only tells Angular when it is a good time to check."

**Transition:**

> "So now Angular no longer needs us to call `render()` manually. Zone.js tells Angular when to check. But because Zone.js cannot tell Angular what changed, Angular has to inspect the component tree. So next, let's look at what that tree actually looks like."

---

# SECTION 3 — What `tick()` Actually Checks

**Target time: 8–10 min**

---

## Slide 3.1 — `tick()` Walks the Component Tree

```text
ApplicationRef.tick()
        ↓
AppComponent
        ↓
CounterPageComponent
        ├── CounterControlsComponent
        └── CounterDisplayComponent
```

```text
Angular checks top-down:

1. Parent first
2. Then child components
3. Each template binding is re-evaluated
4. Old value is compared with new value
```

> **Speaker note:**  
> "So now Angular no longer needs us to call `render()` manually. Zone.js tells Angular when something may have changed, and Angular responds by running `tick()`.
>
> But what does `tick()` actually do?
>
> It walks the component tree from the root. Parent first, then child components. And inside each component, Angular re-evaluates the template bindings.
>
> This top-down order is important.
>
> Angular's original change detection model assumes that during one pass, values should become stable as Angular moves through the tree.
>
> If something changes after Angular already checked it, Angular has a problem.
>
> And that problem is exactly the error we saw at the beginning."

**Transition:**

> "To understand that error, we need one more piece: Angular does not just render values. It remembers what it rendered last time."

---

## Slide 3.2 — Every Binding Has Memory

```typescript
@Component({
  template: `<h1>{{ count }}</h1>`
})
export class CounterComponent {
  count = 0;
}
```

```text
Template binding:

{{ count }}

Angular stores:

previous value: 0
```

```text
Next change detection pass:

new value === previous value?
        ↓
yes → skip DOM update
no  → update DOM and store new value
```

> **Speaker note:**  
> "When Angular sees a binding like `{{ count }}`, it doesn't blindly update the DOM every time.
>
> It stores the previous value internally.
>
> Then on the next change detection pass, it evaluates the binding again and compares the new value with the previous value.
>
> If the value is the same, Angular skips the DOM update.
>
> If the value changed, Angular updates the DOM and stores the new value.
>
> So change detection is basically Angular asking this question over and over: did this binding produce a different value than last time?"

**Transition:**

> "Now let's look at a simplified version of what Angular is doing internally."

---

## Slide 3.3 — The Binding Check

```typescript
function bindingUpdated(lView, bindingIndex, newValue) {
  const oldValue = lView[bindingIndex];

  if (newValue !== oldValue) {
    lView[bindingIndex] = newValue;
    updateDOM(newValue);
    return true;
  }

  return false;
}
```

```text
lView = Angular's internal storage for this view

bindingIndex = where this binding's previous value is stored
```

> **Speaker note:**  
> "This is simplified, but it gives us the right mental model.
>
> Angular stores binding values inside an internal structure called `LView`.
>
> Each binding has a slot.
>
> During change detection, Angular calculates the new value and compares it with the old value in that slot.
>
> If the value changed, Angular updates the DOM and writes the new value into `LView`.
>
> This explains the normal case.
>
> But in development mode, Angular does one extra thing."

**Transition:**

> "Development mode asks a stricter question: after Angular finishes checking, are the values still stable?"

---

# SECTION 4 — NG0100 Explained

**Target time: 10–12 min**

---

## Slide 4.1 — Dev Mode Double Checks Stability

```typescript
// First pass
detectChanges(lView);

// Dev mode only
checkNoChanges(lView);
```

```text
detectChanges:
  "Update the DOM if values changed."

checkNoChanges:
  "Run the template again.
   If anything changed now, throw NG0100."
```

> **Speaker note:**  
> "In development mode, Angular runs a second check after the normal change detection pass.
>
> The first pass is allowed to update the DOM.
>
> The second pass is not.
>
> The second pass asks: if I run the template again immediately, do I get the same values?
>
> If the answer is no, Angular throws `ExpressionChangedAfterItHasBeenCheckedError`.
>
> So NG0100 is not random.
>
> It means Angular checked a value, then something changed that value before the current change detection cycle finished."

**Transition:**

> "Now let's return to the code from the beginning."

---

## Slide 4.2 — Back to the Original Code

```typescript
@Component({
  template: `<h1>{{ name }}</h1>`
})
export class AppComponent implements AfterViewInit {
  name = 'John';

  ngAfterViewInit() {
    this.name = 'Doe';
  }
}
```

```text
Initial value:
name = 'John'

Template:
{{ name }}
```

> **Speaker note:**  
> "At first glance, this code looks harmless.
>
> We start with `name = 'John`.
>
> Then in `ngAfterViewInit`, we change it to `Doe`.
>
> The value is valid. The UI should eventually show `Doe`.
>
> So why does Angular throw?
>
> The answer is not the value. The answer is timing."

**Transition:**

> "Let's trace the timeline."

---

## Slide 4.3 — Why NG0100 Happens

```text
Change detection starts
  ↓
Angular checks template
  ↓
{{ name }} evaluates to "John"
  ↓
Angular stores "John"
  ↓
ngAfterViewInit runs
  ↓
name changes to "Doe"
  ↓
Dev mode checkNoChanges runs
  ↓
{{ name }} now evaluates to "Doe"
  ↓
Angular expected "John"
  ↓
NG0100 ❌
```

> **Speaker note:**  
> "Angular starts checking the component.
>
> The template reads `name`, gets `John`, and Angular stores `John` as the checked value.
>
> Then `ngAfterViewInit` runs and changes `name` to `Doe`.
>
> Now development mode runs `checkNoChanges`.
>
> Angular evaluates the same binding again. But now the value is `Doe`.
>
> From Angular's point of view, this means the value changed after it was already checked.
>
> That is why the error name is so literal: `ExpressionChangedAfterItHasBeenCheckedError`."

**Transition:**

> "This also explains why the famous `setTimeout` trick appears to fix it."

---

## Slide 4.4 — Why `setTimeout` “Works”

```typescript
ngAfterViewInit() {
  setTimeout(() => {
    this.name = 'Doe';
  });
}
```

```text
Current change detection cycle:
  ↓
Angular checks name = "John"
  ↓
ngAfterViewInit registers setTimeout
  ↓
name is still "John"
  ↓
checkNoChanges passes ✅

Later, in a new task:
  ↓
setTimeout callback runs
  ↓
name changes to "Doe"
  ↓
Zone.js notifies Angular
  ↓
Angular runs another tick()
  ↓
UI updates
```

> **Speaker note:**  
> "`setTimeout` does not fix the model.
>
> It just moves the mutation to later.
>
> During the current change detection cycle, `name` stays as `John`, so `checkNoChanges` passes.
>
> Then the timeout callback runs in a separate task.
>
> Zone.js sees that task finish and tells Angular: something may have changed.
>
> Angular runs another `tick()`, walks the tree again, and updates the UI to `Doe`.
>
> So yes, it works.
>
> But it works by escaping the current check, not by making the mutation meaningful to Angular."

**Transition:**

> "That is why `setTimeout` feels like magic. But now we can say exactly what it does: it delays the mutation until Angular's current stability check is over."

---

## Slide 4.5 — The Real Lesson

```text
The problem is not:

"name changed from John to Doe"

The problem is:

"name changed after Angular already checked it"
```

```text
Old Angular mental model:

One pass should be stable.
If a checked value changes too late,
Angular throws.
```

> **Speaker note:**  
> "The important lesson is this: Angular is not angry because the value changed.
>
> Angular is angry because the value changed too late.
>
> In the old model, one change detection pass is expected to be stable.
>
> Angular walks from top to bottom.
>
> Once a value has been checked, it should not change again inside the same pass.
>
> That is the rule NG0100 protects."

**Transition:**

> "And this brings us back to the bigger limitation. Zone.js can tell Angular when to check. But it cannot tell Angular what changed, or that this mutation should be part of a new synchronization step. For that, Angular needs a different model."

---

# SECTION 5 — Why Signals Fix This

**Target time: 13–15 min**

---

## Slide 5.1 — Zone.js vs Signals

```text
Zone.js model:

"Something happened"
        ↓
Run tick()
        ↓
Check the tree
        ↓
Hope everything is stable
```

```text
Signal model:

"This exact state changed"
        ↓
Mark exact consumers dirty
        ↓
Refresh what depends on it
        ↓
Synchronize until stable
```

> **Speaker note:**  
> "This is the key shift.
>
> Zone.js only knows that something happened.
>
> A click finished. A timeout finished. A promise resolved.
>
> But Zone.js does not know whether `name`, `count`, `user`, or nothing changed.
>
> Signals are different.
>
> A signal is not just a value. It is a value Angular can track.
>
> When a signal changes, Angular knows which consumers depend on it.
>
> That means Angular finally has information about `WHAT` changed, not just `WHEN` something happened."

**Transition:**

> "Let's make that concrete with the same example."

---

## Slide 5.2 — The Same Example with Signals

```typescript
@Component({
  template: `<h1>{{ name() }}</h1>`
})
export class AppComponent implements AfterViewInit {
  name = signal('John');

  ngAfterViewInit() {
    this.name.set('Doe');
  }
}
```

```text
name.set('Doe')
        ↓
Angular knows this signal changed
        ↓
The template that read name() is marked dirty
        ↓
Angular schedules that view for refresh
```

> **Speaker note:**  
> "This looks like a tiny change: `signal()`, parentheses in the template, and `.set()`.
>
> But architecturally, this is huge.
>
> With a normal class property, Angular only discovers the change later by checking.
>
> With a signal, Angular is notified at the moment the value changes.
>
> So when `name.set('Doe')` runs, Angular does not need to guess.
>
> It knows this signal changed, and it knows the template that read this signal must be refreshed."

**Transition:**

> "That is possible because Signals build a reactive graph."

---

## Slide 5.3 — Signals Build a Reactive Graph

```typescript
const count = signal(0);
const message = computed(() => `Count: ${count()}`);
```

```text
count signal
    ↓
message computed
    ↓
template
```

```html
<h1>{{ message() }}</h1>
```

> **Speaker note:**  
> "When Angular renders the template, it tracks signal reads.
>
> If the template reads `message()`, the template becomes a consumer of `message`.
>
> If `message` reads `count()`, then `message` becomes a consumer of `count`.
>
> So Angular builds a graph:
>
> `count` affects `message`, and `message` affects the template.
>
> Now when `count` changes, Angular does not need to scan the whole world to discover who cares.
>
> The graph already tells Angular who may be affected."

**Transition:**

> "But Signals do not immediately push new values everywhere. The mechanism is more careful than that."

---

## Slide 5.4 — Push, Poll, Pull

```text
count.set(1)
    ↓
PUSH:
  mark consumers dirty

Before recomputing:
    ↓
POLL:
  did the producer version change?

If yes:
    ↓
PULL:
  recompute the value
```

```text
Signals do not push values.

They push dirtiness.
Consumers pull the value when needed.
```

> **Speaker note:**  
> "When you call `.set()`, Angular does not push the new value through the whole graph immediately.
>
> It pushes a dirtiness notification: this consumer may be stale.
>
> Later, before recomputing, the consumer checks the producer's version.
>
> If the version changed, it pulls the new value and recomputes.
>
> This is why Signals are precise and efficient.
>
> Angular knows the affected path, but it still avoids unnecessary recomputation."

**Transition:**

> "Now let's connect this back to templates."

---

## Slide 5.5 — Templates Become Reactive Consumers

```text
name = signal('John')

Template:
{{ name() }}

Reactive relationship:

name signal
    ↓
component template
```

```text
When name.set('Doe') runs:

name signal changes
    ↓
template is marked dirty
    ↓
this view gets refreshed
```

> **Speaker note:**  
> "The important Angular-specific piece is this: templates can act as reactive consumers.
>
> When a template reads `name()`, Angular remembers that this view depends on that signal.
>
> Later, when `name.set('Doe')` runs, Angular marks that view dirty.
>
> Not every view.
>
> Not the whole tree because a callback finished.
>
> The specific view that consumed the signal."

**Transition:**

> "And this is where Angular's model changes from detection to synchronization."

---

## Slide 5.6 — From One Pass to Synchronization

```text
Old model:

Run one pass
    ↓
Value changed too late?
    ↓
Throw NG0100
```

```text
Signal model:

Signal changed
    ↓
Mark affected view dirty
    ↓
Refresh it
    ↓
Still dirty?
    ↓
Loop until stable
```

```typescript
while (dirty) {
  checkDirtyViews();

  if (somethingBecameDirtyAgain) {
    continue;
  }

  runAfterRenderHooks();
}
```

> **Speaker note:**  
> "This is the big architectural shift.
>
> Old Angular expected a single pass to be stable.
>
> If something changed too late, development mode caught it and threw NG0100.
>
> With Signals, Angular can do something better.
>
> If a signal changes during synchronization, Angular can honor that change.
>
> It marks the affected view dirty and loops until the UI becomes stable.
>
> This does not mean infinite loops are okay. Angular still has safety limits.
>
> But it does mean Angular no longer has to treat every late mutation as a broken unidirectional flow.
>
> If the mutation is a signal mutation, Angular can synchronize it."

**Transition:**

> "Now let's revisit the original NG0100 example one more time."

---

## Slide 5.7 — NG0100 Revisited with Signals

```typescript
// Before
@Component({
  template: `<h1>{{ name }}</h1>`
})
export class AppComponent implements AfterViewInit {
  name = 'John';

  ngAfterViewInit() {
    this.name = 'Doe'; // ❌ NG0100
  }
}
```

```typescript
// After
@Component({
  template: `<h1>{{ name() }}</h1>`
})
export class AppComponent implements AfterViewInit {
  name = signal('John');

  ngAfterViewInit() {
    this.name.set('Doe'); // ✅ synchronized
  }
}
```

```text
What changes?

Class property:
  Angular discovers the change too late

Signal:
  Angular is notified when the change happens
```

> **Speaker note:**  
> "Now the difference is clear.
>
> In the class property version, Angular has no notification.
>
> It checked `John`, then later discovered `Doe`, and dev mode threw NG0100.
>
> In the signal version, `name.set('Doe')` marks the view dirty.
>
> Angular sees that the view needs another refresh and synchronizes it before finishing.
>
> NG0100 is not suppressed.
>
> Angular simply has nothing to complain about because the state and UI are synchronized."

**Transition to Section 6:**

> "And once Angular knows exactly what changed and which view consumed it, this unlocks something much bigger than fixing NG0100: targeted change detection."

---

# Optional Parking Lot / Q&A Slide

## Why Not Keep `ngOnInit` vs `ngAfterViewInit` in the Main Path?

```typescript
// ✅ Usually fine
ngOnInit() {
  this.name = 'Doe';
}

// ❌ Can throw NG0100
ngAfterViewInit() {
  this.name = 'Doe';
}
```

> **Speaker note:**  
> "This example is useful, but I would keep it as an optional demo or Q&A slide.
>
> It reinforces the same lesson: NG0100 is about when a mutation happens relative to Angular's checking pass.
>
> But in the main path, it may distract from the cleaner story:
>
> Zone.js knows when something happened, but not what changed. Signals make the mutation visible to Angular."

---

# Final Summary

```text
manual render
→ Zone calls Angular
→ Angular walks tree
→ Angular stores binding values
→ dev mode checks stability
→ NG0100 is a stability error
→ Signals make mutations visible
→ Angular synchronizes instead of guessing
```

## Core Closing Line for This Chapter

```text
Zone.js helps Angular know WHEN to check.

Signals help Angular know WHAT changed.

That is the shift from change detection to synchronization.
```
