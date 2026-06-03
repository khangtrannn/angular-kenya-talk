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

# SECTION 1 — The Hook

**Target time: 3–4 min**

---

## Slide 1.1 — Introduction

> **Speaker note:**
> [Brief self-introduction — name, author of @ng-brutalism/ui, current work.]
>
> "So, what I want to do today is kind of take you guys along on some of the things I've learned about Angular Change Detection and Signals.
>
> And I am not an expert in any of this, so this is going to be me taking you along on my learning journey and nothing more.
>
> So how did I end up being here talking to you guys about Angular Change Detection today?"

---

## Slide 1.2 — The Error Message

> **Speaker note:**
> "It started with this error.
>
> `NG0100: ExpressionChangedAfterItHasBeenCheckedError`.
>
> Expression has changed after it was checked. Previous value: 'John'. Current value: 'Doe'.
>
> I was working on an Angular app and this thing just showed up in my console. I had no idea what it meant. The values looked fine. The data was correct. But Angular was throwing at me anyway."

---

## Slide 1.3 — Stack Overflow

> **Speaker note:**
> "Back then, there was no AI or LLM. So I did what every developer does — I went to our old friend Stack Overflow.
>
> And I found a solution very quickly. Wrap the mutation in a `setTimeout`. And it worked.
>
> The error was gone. The UI updated correctly. Everything looked fine.
>
> But I had two questions that I couldn't shake.
>
> First — *why* does this work? What is `setTimeout` actually doing here that makes Angular happy?
>
> And second — why does everyone in the comments say 'yes this fixes it, but don't do this, it's a bad practice'?
>
> I used it anyway, because I had a deadline. But those two questions stayed with me."

---

## Slide 1.4 — Angular RFC

> **Speaker note:**
> "A while later, I came across this Angular RFC.
>
> 'Better guardrails to avoid common pitfalls that lead to poor change detection performance and avoid common pain points such as ExpressionChangedAfterItHasBeenChecked errors.'
>
> The Angular team was working on something specifically to address this class of problems.
>
> That told me this wasn't just me struggling. This was a real pain point, at the framework level.
>
> And it made me want to actually understand what was going on — not just patch it with `setTimeout` and move on."

---

## Slide 1.5 — Three Important Questions

> **Speaker note:**
> "So today, the whole talk is built around three questions.
>
> One: why is `setTimeout` a bad practice — even when it works?
>
> Two: why does Angular throw `ExpressionChangedAfterItHasBeenCheckedError` in the first place?
>
> Three: why can Signals help us avoid this class of errors entirely?
>
> We are going to answer all three. In order. By building up from scratch — from vanilla JavaScript, to Zone.js, to how Angular actually checks your templates, to what Signals change about the model.
>
> Let's go."

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
> That's the contract. That's the whole job. State changed — make the UI reflect it.
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
> "Here's our counter. Some state, a span in the DOM, and a render function that connects them.
>
> Notice this: the DOM has absolutely no idea that state.count exists.
>
> The only connection between the two is this render() call.
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
> In a small demo, this is fine. But in a real app.
>
> But in a real app with hundreds of places where state can change — forget it once, and you've got a bug. Data is correct, UI is wrong, and you have no idea why.
>
> This is the problem every framework has to solve."

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
> "So this is exactly the problem Zone.js was built to solve.
>
> Instead of you having to remember to call render() everywhere — what if something just intercepted all those places automatically?
>
> That's what Zone.js does. It patches addEventListener, setTimeout, Promise.then, fetch — every place where work enters your app. After each one finishes, it tells Angular: hey, something may have changed.
>
> Zone.js doesn't know if count changed. It doesn't know if name changed. It doesn't even know if anything changed at all.
>
> But it answers the first question from our list: **WHEN should Angular update?** Answer: whenever a callback finishes.
>
> The second question — **WHAT changed** — Zone.js cannot answer. And that limitation is exactly where all our problems come from."

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
> "Here's how the handoff actually works.
>
> Zone.js doesn't call Angular immediately when a button is clicked. It waits. It waits until the microtask queue drains — until all the follow-up work from that callback is done.
>
> Then it fires: Angular, something may have changed.
>
> Angular responds by calling ApplicationRef.tick().
>
> And tick() is Angular saying: I have no idea what changed, so I'm going to walk the entire component tree and check everything.
>
> We traded manual render() calls for an automatic tick(). That's a real improvement. But tick() is still checking everything, every time — because it has no other choice."

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
> "So Zone.js solved the first problem — we no longer have to call render() manually.
>
> But look at what tick() has to do. It starts at AppComponent at the top and works its way down. Every component. Every child. Top to bottom.
>
> It does this because it genuinely has no idea what changed. Zone.js told it something happened — that's all the information it has.
>
> So it checks everything.
>
> And it expects that by the time it finishes, all the values in the tree should be stable. One pass. Done.
>
> That last part — 'should be stable' — is where the error we saw at the beginning comes from."

**Transition:**

> "We know tick() walks the tree. But when Angular arrives at a single component — what does it actually do?"

---

## Slide 3.2 — How Does Angular Perform Change Detection for a Component?

> **Speaker note:**
> "Okay so here's the question that unlocks the rest of this section.
>
> We know tick() walks the tree. But when it arrives at one component — what exactly does it do?
>
> How does it know which values to check? How does it know which DOM nodes to update?
>
> The answer surprised me when I learned it: Angular doesn't check your class properties at runtime by inspecting them directly.
>
> It compiled your template — before your app ever ran."

---

## Slide 3.3 — Template Functions

> **Speaker note:**
> "Every Angular template is compiled into a JavaScript function — the template function, templateFn.
>
> The template string you write in your @Component decorator? Gone at runtime. Angular replaces it with a generated function full of instructions.
>
> When Angular visits your component during change detection, it calls that function.
>
> That function IS the change detection for that component. Not a property scan. A function call."

---

## Slide 3.4 — Template Compiler

```typescript
// Input
@Component({
  template: `<h1>{{ count }}</h1>`
})
export class Count {
  count = 0;
}
```

```typescript
// Compiled output
function Count_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, 'h1');
    ɵɵtext(1);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    ɵɵadvance(1);
    ɵɵtextInterpolate(ctx.count);
  }
}
```

> **Speaker note:**
> "So here's what the compiler actually outputs for `<h1>{{ count }}</h1>`.
>
> Two arguments: rf is the render flags, ctx is your component instance.
>
> rf is a bitmask. rf & 1 — creation phase. rf & 2 — update phase.
>
> Creation phase: Angular builds the real DOM. ɵɵelementStart creates the h1 at slot 0. ɵɵtext creates the text node at slot 1. ɵɵelementEnd closes it.
>
> Update phase: ɵɵadvance(1) moves the internal pointer to slot 1 — the text node. Then ɵɵtextInterpolate evaluates ctx.count and handles the DOM update.
>
> Creation runs once — ever. Update runs on every single change detection pass."

---

## Slide 3.5 — LView: Angular's Internal View

> **Speaker note:**
> "Before we trace what happens in the update phase, I need to introduce one data structure: LView.
>
> Every component has one. LView is a flat array — Angular's internal storage for a view.
>
> It stores everything that view needs: the real DOM nodes, the component instance, and the previous binding values.
>
> One component. One LView.
>
> Remember when I said 'every binding has memory'? That memory is in LView. Slot 0 is the h1 node. Slot 1 is the text node. And further along in the array, Angular keeps the last value it saw for each binding.
>
> That's where the comparison lives."

---

## Slide 3.6 — Creation and Update Phase

> **Speaker note:**
> "This is the Incremental DOM model — and it's worth comparing to Virtual DOM because they solve the same problem differently.
>
> Virtual DOM — React's approach — creates a new in-memory representation of the UI, diffs it against the old one, and applies the differences to the real DOM.
>
> Incremental DOM — Angular's approach — the template function IS the DOM operations. There's no virtual tree. No diffing.
>
> rf & 1: Angular runs once, creates the real DOM nodes, stores them in LView. This block never runs again.
>
> rf & 2: Angular runs this on every change detection pass. It checks bindings and writes directly to the real DOM.
>
> Angular never allocates a parallel in-memory tree. It works on the real DOM, incrementally, guided by the same template function every time."

---

## Slide 3.7 — How a Binding Update Reaches the DOM

> **Speaker note:**
> "Let's trace the whole chain — from ɵɵtextInterpolate all the way down to the actual DOM write.
>
> ɵɵtextInterpolate(ctx.count)
>   → ɵɵtextInterpolate1('', ctx.count, '')
>   → interpolation1(lView, '', ctx.count, '')       ← bindingUpdated is called here
>   → textBindingInternal(lView, getSelectedIndex(), interpolated)
>   → getNativeByIndex(index, lView)                 ← gets the real text node from LView
>   → updateTextNode(lView[RENDERER], textNode, value)
>   → renderer.setValue(textNode, value)
>   → node.nodeValue = value                         ← the real browser DOM write
>
> This is where the DOM actually changes. Not in a virtual tree. Right here.
>
> And the important moment is interpolation1 — that's where bindingUpdated runs. It reads the previous value from LView, compares it to the new value. Equal? The whole rest of the chain is skipped entirely. No DOM write at all.
>
> The comparison isn't just an optimization — it's the gate. Everything below it only happens if the value actually changed."

**Transition:**

> "So every binding in the template has a slot in LView for its previous value. Let's look at that more directly."

---

## Slide 3.8 — Every Binding Has Memory

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
> "Here's something that surprised me when I first learned this — Angular doesn't just re-render everything on every check.
>
> It remembers.
>
> Every binding has a slot in LView where Angular stores the last value it saw. So when it evaluates `{{ count }}` again, it's not just reading the value — it's comparing. Did this produce something different from last time?
>
> Same value? Skip the DOM update entirely.
>
> Different value? Update the DOM and store the new value.
>
> That's the whole loop. That's what change detection actually is — Angular asking that question for every binding, every pass."

**Transition:**

> "Now let's look at a simplified version of what Angular is doing internally."

---

## Slide 3.9 — The Binding Check

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
> "Simplified, but this is the actual mechanism.
>
> oldValue comes out of LView at the binding's slot. If newValue is different — write the new value back to LView, update the DOM, return true. Same value — do nothing, return false.
>
> That's it. That runs for every binding, every pass.
>
> Now — in dev mode — Angular runs this twice. And that second run is exactly where NG0100 comes from."

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
> "In dev mode, Angular doesn't just run detectChanges once.
>
> It runs a second pass right after — checkNoChanges.
>
> The first pass is allowed to update the DOM. That's normal.
>
> The second pass is not allowed to find anything new. It just asks: if I re-evaluate all the bindings right now, do I still get the same values I just stored?
>
> Yes — great, everything is stable.
>
> No — something changed after Angular already checked it. NG0100.
>
> This isn't random. It's Angular catching a very specific violation. Let's go back to the code and see exactly what triggers it."

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
> "Okay — this is the code that sent me to Stack Overflow.
>
> I remember looking at it thinking: what is wrong here? The data is fine. The value ends up as 'Doe'. Nothing looks broken.
>
> But Angular was furious.
>
> The value is not the problem. The timing is."

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
> "Walk through this with me.
>
> Angular starts the change detection pass. It checks the template. `{{ name }}` evaluates to 'John'. Angular stores 'John' in LView.
>
> Then ngAfterViewInit runs — after the view has been checked, that's literally when that lifecycle hook fires.
>
> name gets set to 'Doe'.
>
> Now dev mode runs checkNoChanges. It evaluates `{{ name }}` again. Gets 'Doe'. But Angular stored 'John'.
>
> Angular says: this binding changed after I already checked it.
>
> That is NG0100. The error name isn't cryptic at all once you understand the model — it's completely literal."

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
> "And now — finally — I can explain why setTimeout appears to work. Because when I found this fix on Stack Overflow, I used it, the error went away, and I had no idea why.
>
> Here's why.
>
> You're not fixing anything. You're just moving the mutation out of the current change detection cycle entirely.
>
> During this cycle: name stays 'John'. checkNoChanges runs. No change. No error.
>
> Later — in a completely separate browser task — the timeout fires. name becomes 'Doe'. Zone.js sees that task finish, tells Angular something changed, Angular runs another tick(), and the UI updates.
>
> So yes, it works. But only because you escaped the check, not because you fixed the underlying problem.
>
> That's why everyone in those Stack Overflow comments says 'don't do this'. You're working around Angular's model, not with it."

**Transition:**

> "That is why `setTimeout` feels like magic. But now we can say exactly what it does: it delays the mutation until Angular's current stability check is over."

---

## Slide 4.5 — Unidirectional Data Flow

```text
The problem is not:

"name changed from John to Doe"

The problem is:

"name changed after Angular already checked it"
```

```text
Unidirectional Data Flow:

Angular walks the tree top-down, one pass, one direction.
Once a value has been checked,
it must not change again in the same pass.

NG0100 is the error you get when something violates that.
```

> **Speaker note:**
> "Now we can answer the third question we asked at the beginning.
>
> Why does Angular throw ExpressionChangedAfterItHasBeenCheckedError?
>
> This is the answer: **Unidirectional Data Flow**.
>
> Angular walks the component tree top-down, in one direction. Parent first, then children.
>
> It expects that one pass should be stable. If a value was already checked and something mutates it afterward — in the same pass — Angular has no way to honor that without walking the tree again.
>
> In the old model, it doesn't. It throws instead.
>
> Angular is not angry because the value changed. Angular is angry because the value changed in the wrong direction — after the check had already moved past it.
>
> That is the rule NG0100 protects. And now you know its real name."

**Transition:**

> "Zone.js can tell Angular when to check. But it cannot tell Angular what changed, or that this mutation should be part of a new synchronization step. For that, Angular needs a different model."

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
> "Okay — here's the big picture comparison. And I think once you see this it just clicks.
>
> Zone.js tells Angular: something happened. A callback finished. Go check everything.
>
> Signals tell Angular: this exact piece of state changed. Here are the consumers that depend on it.
>
> With Zone.js, Angular is always guessing. It has to scan the whole tree every time because it has no information about what actually changed.
>
> With Signals, Angular knows. The mutation itself carries the information. Angular doesn't need to guess because it was told.
>
> That's the shift — from 'something happened, go check' to 'this changed, here's what to refresh'."

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
> "Same problem. Same component. Same ngAfterViewInit timing.
>
> But now name is a signal.
>
> It looks like a tiny change — signal(), parentheses in the template, .set() instead of assignment.
>
> But what's actually different is when Angular finds out.
>
> With a class property, Angular discovers the change later — during the next check, when it's already too late.
>
> With a signal, Angular is notified at the moment name.set('Doe') runs. The template that read name() is marked dirty right then. Angular schedules a refresh.
>
> It doesn't need to guess. It was told."

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
> "Here's how Angular knows which consumers to notify.
>
> When you read a signal inside a computed or a template, Angular records that dependency. It builds a graph automatically.
>
> The template reads message() — so the template is a consumer of message. message reads count() — so message is a consumer of count. The graph is: count → message → template.
>
> Now when count changes, Angular doesn't need to scan anything to find out who cares. The graph already has the answer.
>
> This is fundamentally different from Zone.js, which has no graph at all — just a notification that something, somewhere, may have changed."

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
> "One thing that confused me about Signals at first: when you call .set(), Angular doesn't immediately push the new value everywhere through the graph.
>
> What it pushes is dirtiness. Just a flag: you might be stale.
>
> Then later, before a consumer actually needs to recompute, it checks — did my producer's version number change? That's the poll step.
>
> If yes: pull the new value and recompute.
>
> This keeps Signals both precise and efficient. Angular knows the affected path, but it still avoids recomputing anything that doesn't actually need it."

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
> "And here's the Angular-specific piece of this.
>
> A template is a reactive consumer — just like a computed.
>
> When the template reads name(), Angular records: this view depends on name.
>
> When name.set('Doe') runs, Angular marks that specific view dirty.
>
> Not the whole tree. Not everything that Zone.js would've triggered.
>
> Just the exact view that consumed that exact signal."

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
