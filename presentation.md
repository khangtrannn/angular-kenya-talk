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
> "Hi everyone, I'm Khang, a software engineer from Vietnam.
>
> Besides that, I'm currently on a career break, and during this time I'm building my Angular UI library, `@ng-brutalism/ui`.
>
> This is actually my first time speaking at a webinar.
>
> So, what I want to do today is kind of take you guys along on some of the things I've learned about Angular Change Detection and Signals.
>
> And I am not an expert in any of this, so this is going to be me taking you along on my learning journey and nothing more.
>
> So how did I end up being here talking to you guys about Angular Change Detection today?"

---

## Slide 1.2 — The Error Message

> **Speaker note:**
> "If you have worked with Angular for a while, I bet you have encountered this error at least once:
>
> `ExpressionChangedAfterItHasBeenCheckedError`."

---

## Slide 1.3 — Stack Overflow

> **Speaker note:**
> "Back then, there was no AI or LLM explaining errors to us. So I did what every developer did — I went to our old friend Stack Overflow.
>
> And I found a solution very quickly: wrap the mutation in a `setTimeout`.
>
> It worked. The error disappeared.
>
> But the comments were basically saying: don’t do this.
>
> But I didn’t really understand why."

---

## Slide 1.4 — Two Important Questions

> **Speaker note:**
> "And that left me with two questions.
>
> First: why does Angular throw `NG0100`?
>
> Second: why does `setTimeout` make it disappear, while still being considered a bad practice?
>

---

## Slide 1.5 — Angular RFC

> **Speaker note:**
> "Then, back in 2023, when the Angular renaissance started, Angular published the Signals RFC — a new reactive primitive for the framework.
>
> A lot of things in that RFC were interesting, but this line caught my attention:
>
> 'Better guardrails to avoid common pitfalls that lead to poor change detection performance and avoid common pain points such as ExpressionChangedAfterItHasBeenChecked errors.'
>
> And honestly, that confused me.
>
> Signals were reactive state. `NG0100` was a change detection error.
>
> Why were they in the same story?
>
> How could a new state primitive help Angular avoid this kind of timing error?
>
> That question is what pushed me to go deeper into Angular change detection.
>

> To answer those, we had to understand what Angular is actually doing during change detection."
> So let's build the mental model from the ground up."

---

# SECTION 2 — Change Detection 101

**Target time: 14 min**

---

## Slide 2.1 — What Is Change Detection?

```text
State → synchronization → UI
```

> **Speaker note:**
> "At the simplest level, change detection is Angular keeping state and UI in sync.
>
> When the state changes, the screen should reflect the new value.
>
> Simple idea.
>
> But to make that happen, Angular has to answer two questions.
>
> First: when should it check?
>
> And second: what should it check?
>
> To make that concrete, let's start with the smallest possible example: a counter."

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
> "So now we have a rule.
>
> Whenever state changes, we have to call `render()`.
>
> In one place, that is easy.
>
> But real apps do not change state from only one place.
>
> State can change after a click. After a timer. After a Promise. After an API response.
>
> And every time, we have to remember the same thing: call `render()`.
>
> If we forget to call `render()`, the screen is out of date.
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
> "This is where Zone.js comes in.
>
> Instead of asking us to remember every place where state can change, Zone.js watches the places where work enters the app.
>
> A click handler. A timer. A Promise. An HTTP response.
>
> When that work finishes, Zone.js notifies Angular.
>
> Not because it knows something changed.
>
> But because something might have changed.
>
> That distinction is important.
>
> Zone.js can tell Angular when to check.
>
> But it cannot tell Angular what changed.
>
> So Angular still has to decide what to check."

**Transition:**

> "So what happens after Zone.js tells Angular that something might have changed? Angular calls one central method: `ApplicationRef.tick()`."

---

## Slide 2.5 — From “Something Happened” to `tick()`

```text
Work finishes
        ↓
Angular becomes stable
        ↓
Zone.js: "Angular, something might have changed"
        ↓
ApplicationRef.tick()
```

> **Speaker note:**
> "So this is the handoff.
>
> Some work enters the app: a click, a timer, a Promise, an HTTP response.
>
> That work finishes.
>
> Angular becomes stable.
>
> Then Zone.js notifies Angular: something might have changed.
>
> Angular responds by calling `ApplicationRef.tick()`.
>
> And this is the important tradeoff: we no longer have to call `render()` manually.
>
> But Angular still does not know what changed.
>
> So `tick()` is Angular's way of saying: okay, let me go check.
>
> But check what?"

**Transition:**

> "To answer that, Angular sees the app as a tree of components."

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
> "To answer that, Angular sees the app as a tree of components.
>
> The root component at the top. Child components underneath.
>
> When `tick()` runs, Angular starts from the root and walks down that tree.
>
> Parent first. Then child components. Top to bottom.
>
> Because Zone.js does not tell Angular what changed, Angular has to check broadly.
>
> But now we can ask the more interesting question: when Angular reaches one component, what does it actually check?"

## Slide 3.2 — How Does Angular Perform Change Detection for a Component?

> **Speaker note:**
> "When Angular reaches a component, it needs to know two things.
>
> Which values should it read?
>
> And where should those values go in the DOM?
>
> The thing that answers both questions is the template function: `templateFn`."

---

## Slide 3.3 — Template Functions

```text
template → templateFn
```

> **Speaker note:**
> "The key shift is this: Angular does not treat the template as a string at runtime.
>
> It compiles the template into a JavaScript function.
>
> So when Angular checks a component, it calls that generated function.
>
> That function contains the instructions for reading values and updating the DOM."

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

## Slide 3.6 — The Template Function Is Angular's `render()`

> **Speaker note:**
> "So the template function has two jobs.
>
> The creation block runs once. It creates the DOM nodes and stores them in `LView`.
>
> The update block runs on every change detection pass.
>
> It reads values from the component instance, compares bindings, and updates the DOM when needed.
>
> This is Angular's version of the `render()` function from our vanilla JavaScript example.
>
> The difference is: we did not write it by hand. Angular generated it from our template."

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

A callback finished
        ↓
Something may have changed
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
> Zone.js gives Angular timing information. A callback finished, so something may have changed.
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
