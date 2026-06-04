# The Beauties of Angular Signals — Revised Talk Chapter

> Revised integrated flow for the Angular Signals talk.
>
> This version tightens the story from vanilla JavaScript manual rendering, to Zone.js, to `tick()`, to the component tree, to NG0100, and finally to why Signals change the model from detection to synchronization.


---

# SECTION 1 — The Hook

**Target time: 3–4 min**

---

## Slide 1.1 — Introduction

> **Speaker note:**
> "Hi everyone, I’m Khang, a software engineer from Vietnam.
>
>
> This is my first time speaking at a webinar like this, so thank you so much to the Angular Kenya team for setting everything up and making this happen.
>
> So, what I want to do today is kind of take you guys along on some of the things I've learned about Angular Change Detection and Signals.
>
> And I am not an expert in any of this, so this is going to be me taking you along on my learning journey and nothing more.
>
> So how did I end up here today talking to you guys about this topic?"

---

## Slide 1.2 — The Error Message

> **Speaker note:**
> "The journey started with this kind of error message.
>
> If you have worked with Angular for a while, I bet you have encountered this error at least once:
>
> `ExpressionChangedAfterItHasBeenCheckedError`."

---

## Slide 1.3 — Stack Overflow

> **Speaker note:**
> "I did what every developer did: I searched Stack Overflow.
>
> I found the magic solution: wrap the mutation in a `setTimeout`.
>
> I tried it, and the error disappeared.
>
> But then I reached to the comment section, and they were basically saying: please don't do this.
>
> That was the confusing part.
>
> If it fixed the error, why was it wrong?"

---

## Slide 1.4 — Two Important Questions

> **Speaker note:**
> "So that became the starting point for this talk.
>
> It left me with two questions.
>
> First: why does Angular throw `NG0100` in the first place?
>
> Second: why does `setTimeout` make the error disappear, but still feel like the wrong solution?"

---

## Slide 1.5 — Angular RFC

> **Speaker note:**
> "Then, back in 2023, when the Angular renaissance started by introducing a new reactive primitive for the framework.
>
> A lot of things in that RFC were interesting, but this line caught my attention:
>
> 'Better guardrails to avoid common pitfalls that lead to poor change detection performance and avoid common pain points such as ExpressionChangedAfterItHasBeenChecked errors.'
>
> And that confused me again.
>
> How could a new reactive primitive help Angular avoid the ExpressionChangedAfterItHasBeenChecked errors?
>
> That question is what pushed me to go deeper into Angular change detection.
>
> To answer those questions, we had to understand what Angular is actually doing during change detection and build the mental model from the ground up."

---

# SECTION 2 — Change Detection 101

**Target time: 14 min**

---

## Slide 2.1 — What Is Change Detection?

```text
State → synchronization → UI
```

> **Speaker note:**
> "Before we talk about Signals, let's step back and define change detection.
>
> At the simplest level, change detection is Angular keeping your application state and the rendered UI in sync.
>
> When state changes, the UI should reflect that change.
>
> This is simple idea but the hard part is deciding when Angular should run change detection, and what part of the UI it should update.
>
> To make that concrete, let's start with a tiny counter example."

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
> "Here is the same idea in plain JavaScript.
>
> We have some state: `count`.
>
> We have some UI: this `span`.
>
> And then we have a `render()` function that connects them.
>
> The important thing is: the DOM does not know that `state.count` exists.
>
> So changing the state does not automatically update the screen.
>
> The only time the UI gets synchronized is when we call `render()`."

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
> "So now the rule becomes: whenever state changes, something has to synchronize the UI.
>
> In a tiny demo, we can do that ourselves by calling `render()`.
>
> But real apps do not have just one place where state changes.
>
> State can change from a click, a timer, a Promise, or an API response.
>
> So now the problem is not the counter anymore. The problem is remembering every entry point where the app can change.
>
> Forget one of them, and the UI falls behind.
>
> And this is the problem Angular needed to solve before Signals:
>
> how do we know when the app might need to be synchronized?"

**Transition:**

> "Angular's first big answer was Zone.js."

---

## Slide 2.4 — Zone.js: “Let Me Call Angular For You”

```javascript
// Zone.js patches the places where work enters your app
// Simplified mental model:

const originalAddEventListener = Element.prototype.addEventListener;

Element.prototype.addEventListener = function(eventName, callback) {
  return originalAddEventListener.call(this, eventName, () => {
    callback();

    // Angular: something might have changed,
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
> "This is where Zone.js comes in.
>
> Zone.js wraps the common places where work enters the app: clicks, timers, Promises, HTTP responses.
>
> After that work finishes, it notifies Angular.
>
> The important detail is that Zone.js is not saying: this exact state changed.
>
> It is saying: something just happened, so something might have changed.
>
> That gives Angular the first answer: when to run change detection.
>
> But it does not answer the second question: what actually changed?"

**Transition:**

> "So what happens after Zone.js tells Angular that something might have changed? Angular runs one central change detection pass: `ApplicationRef.tick()`."

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

```typescript
// What tick() means conceptually
tick() {
  for (const view of allViews) {
    detectChanges(view);
  }
}
```

```text
Angular checks top-down:

1. Parent first
2. Then child components
3. Each template binding is re-evaluated
4. Old value is compared with new value
```

> **Speaker note:**
> "So this is the handoff.
>
> Zone.js only tells Angular that some work finished, so something might have changed.
>
> Angular responds by running `ApplicationRef.tick()`.
>
> Because Zone.js does not deliver any information about what changed, Angular needs to start change detection from the root component and walk down the component tree.
>
> Parent first. Then child components. Top to bottom.
>
> But now we can ask the more interesting question: when Angular reaches one component, what does it actually check?"

---

## Slide 3.2 — Template Functions

```text
template → templateFn
```

> **Speaker note:**
> "When Angular reaches a component, it needs to know two things.
>
> Which values should it read from the component?
>
> And where should those values go in the DOM?
>
> The thing that answers both questions is the template function: `templateFn`."

---

## Slide 3.4 — Template Compiler

```typescript
// Input
@Component({
  template: `<h1>{{ name }}</h1>`
})
export class App {
  name = 'John';
}
```

```typescript
// Compiled output
function App_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, 'h1');
    ɵɵtext(1);
    ɵɵelementEnd();
  }

  if (rf & 2) {
    ɵɵadvance(1);
    ɵɵtextInterpolate(ctx.name);
  }
}
```

> **Speaker note:**
> "Now let's open that `templateFn` and see how it answers those two questions.
>
> Here is a simplified version of what the compiler generates for a tiny template.
>
> `rf` is the render flag. For our purpose, just read it as two modes: create and update.
>
> `ctx` is the component instance, so `ctx.name` is the `name` property from our class.
>
> The first block is the creation block. It creates the DOM nodes once.
>
> The second block is the update block. This is the part that runs during change detection.
>
> And the important line is `ɵɵtextInterpolate(ctx.name)`, because this is where Angular reads the current value of the binding."

---

## Slide 3.5 — LView: Where Angular Remembers Values

```text
LView = internal storage for a view

LView [
  ...
  h1 text node,
  component instance,
  last seen value for {{ name }}: "John",
  ...
]
```

> **Speaker note:**
> "Now we need one more piece: where does Angular keep the previous value of a binding?
>
> Angular stores that previous value inside something called `LView`.
>
> You can think of `LView` as Angular's internal storage for this view.
>
> Technically, it is an array, but the important idea is what it stores.
>
> It keeps references to DOM nodes, the component instance, and the last value Angular saw for each binding.
>
> So for `{{ name }}`, Angular has a place where it can remember: last time, this was `"John"`.
>
> That memory is what makes comparison possible."

---

## Slide 3.6 — How a Binding Update Reaches the DOM

```typescript
// Simplified mental model
function ɵɵtextInterpolate(value) {
  if (bindingUpdated(lView, bindingIndex, value)) {
    updateDOM(value);
  }
}

function bindingUpdated(lView, bindingIndex, newValue) {
  const oldValue = lView[bindingIndex];

  if (Object.is(oldValue, newValue)) {
    return false;
  }

  lView[bindingIndex] = newValue;
  return true;
}
```

```

> **Speaker note:**
> "Now let's follow the update path.
>
> The template function calls `ɵɵtextInterpolate(ctx.name)`.
>
> Inside that interpolation work, Angular runs a binding check with `bindingUpdated(...)`.
>
> `bindingUpdated(...)` reads the old value from `LView` and compares it with the new value Angular just read from the template function.
>
> If the value is unchanged, it returns `false`, and the update path stops. Nothing needs to touch the DOM.
>
> If the value changed, Angular stores the new value in `LView` and returns `true`.
>
> This is the core loop of change detection: read the binding, compare it with the last value, and remember the new value when it changes."

**Transition:**

> "In development mode, Angular asks one stricter question: after checking, are these binding values still stable?"

---

# SECTION 4 — NG0100 Explained

**Target time: 10–12 min**

---

## Slide 4.1 — Dev Mode and the Second Check

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
> "In development mode, Angular takes that binding check one step further.
>
> After the normal change detection pass, it runs another pass immediately.
>
> The first pass is allowed to update `LView` and the DOM.
>
> The second pass is different. It re-runs the template, but it expects every binding to produce the same value as before.
>
> If the values are the same, Angular knows the view is stable.
>
> If a binding produces a different value, Angular throws `NG0100`."

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

Template reads:
{{ name }}

Lifecycle hook:
ngAfterViewInit()
```

> **Speaker note:**
> "Now let's go back to the code that sent me to Stack Overflow.
>
> At first glance, this code feels pretty normal.
>
> We start with `name = 'John'`, the template reads `name`, and after the view initializes, we assign `name = 'Doe'`.
>
> The final value, `Doe`, is perfectly valid. The interesting detail is where the assignment happens: inside `ngAfterViewInit`.
>
> That hook runs after Angular has already read this template binding once in the current pass.
>
> So to understand the error, let's trace the timeline."

---

## Slide 4.3 — Why NG0100 Happens

```text
1. First pass
detectChanges

{{ name }} → 'John'
Angular remembers 'John'

2. Lifecycle hook
ngAfterViewInit()

this.name = 'Doe'

3. Dev-mode second pass
checkNoChanges

{{ name }} → 'Doe'
Angular expected 'John'

NG0100

{{ name }} changed after it was checked.
```

> **Speaker note:**
> "Let's walk through it slowly.
>
> First pass: Angular reads `{{ name }}`. At this moment, `name` is `'John'`, so Angular remembers `'John'` in `LView`.
>
> Then the lifecycle hook runs. `ngAfterViewInit` assigns `this.name = 'Doe'`.
>
> Now dev mode does the second pass. It reads the same binding again. But this time, it gets `'Doe'`.
>
> And that is the problem. Angular was expecting the value it had just checked: `'John'`.
>
> So when Angular says `ExpressionChangedAfterItHasBeenCheckedError`, it is describing exactly what happened: `{{ name }}` changed after it was checked."

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
Angular reads {{ name }} → 'John'
ngAfterViewInit schedules callback
callback has not run yet
checkNoChanges sees 'John' again ✅

Later, in a new browser task:
setTimeout callback runs
this.name = 'Doe'
Zone.js triggers another tick()
UI updates to 'Doe'

Takeaway:
setTimeout moves the mutation into the next task.
It works by escaping the current check, not by fixing the model.
```

> **Speaker note:**
> "This is the part I wish I had understood from the very beginning.
>
> `setTimeout` does not make the assignment safer. It moves the assignment out of the current change detection cycle and into a later browser task.
>
> During the current cycle, Angular only registers the timeout. The callback has not run yet, so `name` is still `'John'`.
>
> When `checkNoChanges` runs, it sees `'John'` again, so there is no NG0100.
>
> Later, the timeout callback runs in a new browser task. It assigns `this.name = 'Doe'`. After that task, Zone.js triggers another `tick()`, and Angular updates the UI.
>
> So yes, it works. But it works by escaping the current check, not by fixing the model."

---

## Slide 4.5 — Unidirectional Data Flow

```text
The problem is not:

name changed from 'John' to 'Doe'

The problem is:

{{ name }} changed after Angular already checked it
```

```text
The rule:
Unidirectional data flow

Classic checking model

Angular checks top-down.
Checked values should stay stable.
Angular does not rewind the pass.

NG0100 protects this rule.
```

> **Speaker note:**
> "Now we can answer the first question from the beginning: why does Angular throw `ExpressionChangedAfterItHasBeenCheckedError`?
>
> The answer is unidirectional data flow.
>
> Angular checks the component tree top-down. Once Angular has checked a binding and moved forward, that binding is expected to stay stable for the rest of the pass.
>
> Angular is not complaining because the value became `Doe`. It is complaining because the binding changed in the wrong direction: after Angular had already checked it and moved forward.
>
> If Angular kept going backward every time something changed behind it, one pass would no longer have a clear meaning.
>
> In dev mode, Angular catches that with the second check and throws NG0100.
>
> That is the rule NG0100 protects."

**Transition:**

> "Zone.js can tell Angular when something happened. But it cannot tell Angular exactly what state changed, or which view depends on that state. For that, Angular needs a different synchronization model."

---

# SECTION 5 — Why Signals Fix This

**Target time: 13–15 min**

---

## Slide 5.1 — Zone.js vs Signals

```text
Zone.js model:

A callback finished
        ↓
Something might have changed
        ↓
Angular checks broadly
        ↓
One pass should be stable
```

```text
Signal model:

A signal changed
        ↓
Angular knows who consumed it
        ↓
Mark affected views dirty
        ↓
Refresh affected views
```

> **Speaker note:**
> "Okay — here's the big picture comparison. And I think once you see this it just clicks.
>
> Zone.js gives Angular timing information. A callback finished, so something might have changed.
>
> But Zone.js cannot tell Angular which state changed, or which view depends on that state. So conceptually, Angular has to check broadly and expect that one pass is stable.
>
> Signals give Angular dependency information. A signal changed, and Angular can know which views consumed that signal.
>
> That is the shift: from 'something happened, go check' to 'this state changed, and these are the affected views'."

**Transition:**

> "But that raises the real question: how can Angular know which view depends on a signal?"

---

## Slide 5.2 — Signals Build a Reactive Graph

```typescript
name = signal('John');
```

```text
Template:

{{ name() }}
```

```text
Reactive graph:

name
producer
"John"
    ↓
app-root
template consumer
</>
```

> **Speaker note:**
> "Here's how Angular gets dependency information.
>
> This graph only has two nodes, and that is enough for our example.
>
> `name` is a signal producer. The `app-root` template is a reactive consumer.
>
> When the template reads `name()`, Angular records the edge: this template consumer depends on this signal producer.
>
> So when `name` changes later, Angular does not need to discover that relationship by guessing. The graph already has the answer."

**Transition:**

> "Now the Angular-specific question is: how does a template become a reactive consumer in the first place?"

---

## Slide 5.3 — Templates Run With a Reactive Consumer

```text
refreshView(lView)
    ↓
ReactiveLViewConsumer
    ↓
executeTemplate(...)
    ↓
template reads name()
    ↓
producerAccessed(name)
    ↓
edge recorded:
name → app-root template consumer
```

> **Speaker note:**
> "This is the Angular-specific piece.
>
> When Angular refreshes a view, it can run the template with a reactive consumer attached to the `LView`.
>
> Then Angular executes the template. If the template reads `name()`, the signal system sees that read through `producerAccessed(name)`.
>
> Because Angular is currently running the template with a reactive consumer, that read creates the edge from the `name` signal producer to the `app-root` template consumer.
>
> This is why a template read is not just a normal function call anymore. It becomes dependency information."

**Transition:**

> "Now we know how the edge is created. What happens when the signal changes?"

---

## Slide 5.4 — Push Dirtiness, Pull Values

```text
name.set('Doe')
    ↓
PUSH:
  mark app-root template consumer dirty
    ↓
Angular refreshes affected view
    ↓
PULL:
  template reads name()
```

```text
Signals do not push values into templates.

They push dirtiness.

Templates pull the latest value when refreshed.
```

> **Speaker note:**
> "One thing that confused me about Signals at first: when you call `.set()`, Angular does not push the new value directly into the template.
>
> What it pushes is dirtiness.
>
> `name.set('Doe')` marks the `app-root` template consumer dirty. Then, when Angular refreshes that affected view, the template calls `name()` again and pulls the latest value.
>
> So the model is not 'push the value everywhere.' It is: push dirtiness, then pull the value during refresh."

**Transition:**

> "Now we can revisit the exact example from the beginning with the right mental model."

---

## Slide 5.5 — The Same Example with Signals

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
1. First check
template reads name()
name() returns "John"
LView binding slot = "John"
edge recorded

2. Hook runs
name.set("Doe")
signal value = "Doe"
LView binding slot = "John"
consumer marked dirty

3. Refresh
template reads name()
name() returns "Doe"
bindingUpdated("John", "Doe")
LView binding slot = "Doe"
DOM updates
```

> **Speaker note:**
> "Now we can bring the original example back.
>
> Same component. Same `ngAfterViewInit` timing. But now `name` is a signal.
>
> In the first check, the template reads `name()`, gets 'John', and Angular stores 'John' in the `LView` binding slot. At the same time, the signal read records the edge from `name` to the `app-root` template consumer.
>
> Then `ngAfterViewInit` runs. `name.set('Doe')` changes the signal value. The `LView` binding slot is still 'John', but now Angular also knows the template consumer is dirty.
>
> So Angular can refresh the affected view. The template reads `name()` again, gets 'Doe', `bindingUpdated` compares old 'John' with new 'Doe', updates the `LView` slot, and writes the DOM.
>
> Signals do not remove `LView` or `bindingUpdated`. The difference is that the mutation is visible to Angular when it happens, so Angular can synchronize the affected view instead of only discovering a changed binding too late."

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
> "And this is the answer to everything we've been building toward.
>
> Old model: Angular runs one pass, expects it to be stable, and throws NG0100 if anything changes too late.
>
> Signal model: if a signal changes during synchronization, Angular can honor it. It marks the affected view dirty and loops until everything stabilizes.
>
> Angular still has safety limits — it won't loop forever. But late mutations via signals aren't violations anymore. Angular knows about them. It can incorporate them.
>
> The model went from 'one pass, hope for the best' to 'synchronize until stable'."

**Transition:**

> "Now let's revisit the original NG0100 example one more time."

---

## Slide 5.7 — Signals Change the Timing Story

```text
Class property version:

check {{ name }} → "John"
        ↓
ngAfterViewInit mutates name to "Doe"
        ↓
Angular discovers it too late
        ↓
NG0100
```

```text
Signal version:

check {{ name() }} → "John"
        ↓
ngAfterViewInit calls name.set("Doe")
        ↓
Angular knows the signal changed
        ↓
affected view is refreshed
```

```text
Signals make updates explicit:
Angular does not have to discover the change too late.
```

> **Speaker note:**
> "Let's bring this back to where we started.
>
> On the left: the class property version. Angular checks `name`, gets 'John', stores it. Then `ngAfterViewInit` runs and mutates `name` to 'Doe'. Angular discovers the change too late — after the check has already moved past it. NG0100.
>
> On the right: the signal version. `name.set('Doe')` runs. Angular is notified at that exact moment. The view is marked dirty. Angular synchronizes it before finishing the pass.
>
> The bottom line on the slide says it: signals make updates explicit. Angular doesn't have to discover the change by checking. It is told about the change when it happens.
>
> With a class property, Angular is always guessing — scanning the tree, hoping nothing changed too late.
>
> With a signal, Angular knows. It knows what changed, which view consumed it, and when to refresh it.
>
> That is the shift from change detection to synchronization."

**Transition to Q&A:**

> "And that's the whole story — from a vanilla JavaScript counter that needed a manual render(), through Zone.js telling Angular when to check, through LView and templateFn and bindingUpdated, through NG0100 and unidirectional data flow, all the way to Signals giving Angular the information it was always missing."

---

## Slide 5.8 — Thank You

> **Speaker note:**
> "Thank you.
>
> I hope this was useful — not just as a list of Angular facts, but as a way to build the mental model from the ground up.
>
> If you take one thing away: Zone.js solved the 'when' problem. Signals solve the 'what' problem. And once Angular knows what changed, it can synchronize instead of guess.
>
> I'm Khang — author of @ng-brutalism/ui — build loud, stay sharp. Happy to take any questions."

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
