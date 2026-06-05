# Speaker Notes

## Slide 1.1 - Introduction

Hi everyone, I'm Khang, a software engineer from Vietnam.

This is my very first time speaking at a webinar like this, so I would like to thanks to the Angular Kenya team for setting everything up and making this happen.

So, what I want to do today is kind of take you guys along on some of the things I've learned about Angular Change Detection and Signals.

And I am not an expert in any of this, so this is going to be me taking you guys along on my learning journey and nothing more.

Let's start this session with the reason why I end up here talking about this topic today?

## Slide 1.2 - The Error Message

The journey started with this kind of error message.

If you have worked with Angular for a while, I bet you have encountered this kind of error at least once:

`ExpressionChangedAfterItHasBeenChecked`.

And when it happened to me, I had no idea what Angular was actually complaining about.

## Slide 1.3 - Stack Overflow

I went to Stack Overflow and found the this solution that wrap the mutation in a `setTimeout`.

I tried it, and the error disappeared like a magic and I have no idea why it worked.

Especially when I reached the comment section, people were basically saying that fixing the error like that is not considered best practice.

## Slide 1.4 - Two Important Questions

So that became the starting point for this talk. It left me with two questions.

First: why does Angular throw this kind of message in the first place?

Second: why does `setTimeout` make the error disappear, but still feel like the wrong solution?

## Slide 1.5 - Angular RFC

Then, back in 2023, when the Angular renaissance started by introducing a new reactive primitive for the framework.

A lot of ideas in that RFC were interesting, but one line really stood out to me.

'Better guardrails to avoid common pitfalls that lead to poor change detection performance and avoid common pain points such as ExpressionChangedAfterItHasBeenChecked errors.'

And to be honest that confused me again.

How could a new reactive primitive help Angular avoid this kind of errors?

These questions are what pushed me to go deeper into Angular change detection.

## Slide 2.1 - What Is Change Detection?

To answer those questions, we had to understand what Angular is actually doing during change detection by building the mental model from the ground up.

Before we talk about Signals, let's step back to a basic question "What is change detection".

And at the simplest level, change detection is Angular keeping your application state and the rendered UI in sync.

When state changes, the UI should reflect that change.

This is simple idea but there are two questions that Angular need to answer when it should run change detection, and what part of the UI it should update.

To make that concrete, let's start with a tiny example.

## Slide 2.2 - Vanilla JS: State Does Not Update the UI

Here is the same idea in plain JavaScript.

We have some state: `name`.

We have some UI: this `span`.

But the important thing is that there is no connection between the DOM and the name state.

So changing the state doesn't automatically update the screen.

That the reason why we need to have a `render()` function here to connect them together.

Nothing changes on the screen until we call render().

## Slide 2.3 - The Manual Render Problem

But there is a problem here, to make sure everything stays in sync, whenever state changes, we have to call the `render()` function manually.

Now imagine this in a real application.

State can change from many places, like a click event, a timer, a Promise, or an API response.

That means we have to remember to call `render()` in all of those places.

And this is the problem Angular solves automatically for us:

So how does Angular know when the application might need to update the UI?

## Slide 2.4 - Zone.js: Let Me Call Angular For You

This is where Zone.js comes in.

Instead of us manually tell Angular every time state might have changed, Angular uses Zone.js to intercept the common async callbacks in the browser by monkey-patches every browser events.

Things like click events, timers, Promises, and HTTP responses.

When one of those callbacks finished, Zone.js will notifies Angular.

But the important detail is that Zone.js has nothing to do with the update UI.

It only tells Angular: something just happened so something might have changed.

That gives Angular the first answer:

when to run change detection.

But it still doesn't answer the second question:

what actually changed?

## Slide 3.1 - `tick()` Walks the Component Tree

So that notification is only the starting point.
Once Angular receives that notification, it responds by running `ApplicationRef.tick()`.

Because Zone.js does not deliver any information about what changed, Angular needs to start change detection from the root component and walk down the component tree from top to bottom.

Or technically, Angular will loop through all of the components and run detectChanges for each of them. But now we can ask the more interesting question: when Angular reaches one component, what does it actually check?

## Slide 3.2 — Template Functions

When Angular reaches a component, it does not guess what to update.

It needs instructions.

Those instructions answer two questions:

What values should Angular read from the component?

And where should those values go in the DOM?

That instruction set is the **template function** — or `templateFn`.

So next, let’s open up that `templateFn` and see what Angular’s compiler actually generates.


## Slide 3.4 — Template Compiler

So this is the `templateFn` Angular gets after compiling our template.

It looks low-level, but it is answering the same two questions.

The first block is the **creation phase**.

It creates the DOM structure once, when the component is initialized.

The second block is the **update phase**.

This is the part Angular runs during change detection.

Here, Angular reads `ctx.name` inside `ɵɵtextInterpolate(...)`.

That is the **binding read**.

Then Angular writes that value into the text node inside the `h1`.

So the template function connects the component state to the DOM:

Read `ctx.name`.

Write it into the `h1` text node.

But now we have one more question:

Where does Angular remember the previous value, so it knows whether the DOM actually needs to change?

## Slide 3.5 — LView: Where Angular Remembers Values

Angular remembers the previous value inside something called `LView`.

You can think of `LView` as Angular’s internal storage for the current view.

Technically, it is an array.

But the important part is what it stores.

It keeps references to DOM nodes, the component instance, and the last value Angular saw for each binding.

So for our `name` binding, Angular has a place to remember:

Last time, this value was `"John"`.

That memory is what makes comparison possible.

## Slide 3.6 — How a Binding Update Reaches the DOM

Now let’s follow the update path from the template function.

It calls:

`ɵɵtextInterpolate(ctx.name)`

Inside that instruction, Angular runs a binding check with `bindingUpdated(...)`.

`bindingUpdated(...)` reads the old value from `LView` and compares it with the new value from `ctx.name`.

If the value is the same, Angular skips the DOM update.

If the value changed, Angular stores the new value in `LView` and allows the text node to be updated.

So the core loop is:

Read the binding.

Compare it with the previous value.

Store the new value.

Update the DOM only when needed.

## Slide 4.1 — Dev Mode and the Second Check

In development mode, Angular does not stop after the first check.

It asks one stricter question:

It asks a stricter question:
If Angular runs the template again, do the bindings still produce the same values?

To answer that, Angular immediately runs the template function one more time.

If every binding returns the same value, everything is fine.

But if a binding returns a different value, Angular knows something changed too late.

That is when Angular throws an error.

## Slide 4.2 — Back to the Original Code

Now let’s go back to the code from the beginning.
At first glance, this code looks completely normal.
We start with `name = 'John'`.
The template reads `name`.
And after the view is initialized, we change it to `Doe`.
The value itself is not the problem.
Angular is not complaining because the value changed from `John` to `Doe`.
The important detail is **when** that change happens.

let’s trace the timeline step by step to understand why Angular throw the error.

## Slide 4.3 — Why NG0100 Happens

Let’s walk through the slide from left to right.
First, Angular runs the normal change detection pass.
It reads the binding:

`{{ name }}`

At this moment, the value is `John`.
So Angular remember `John`.

Then we move to the middle.
The lifecycle hook runs:
`ngAfterViewInit`
And inside that hook, we change the value:
`this.name = 'Doe'`
Now the value has changed after Angular already checked it.

Then, on the right side, development mode runs the second pass.
Angular reads the same binding again.
But this time, it gets `Doe`.
The problem is that Angular was expecting the value from the first pass: `John`

So NG0100 is basically Angular saying:
This binding changed after it was already checked.

`{{ name }}` was `John`.
Then it became `Doe`.

That is why Angular throws `ExpressionChangedAfterItHasBeenCheckedError`.

## Slide 4.4 — Why `setTimeout` “Works”

This is the part I wish I had understood earlier.

`setTimeout` does not make the mutation safer.

It simply moves the mutation out of the current change detection cycle.

During the current cycle, Angular just registers the timeout.
The callback has not run yet.

So `name` is still `John`.

Then dev mode runs the second check.

Angular reads the same binding again, and it still gets `John`.

So there is no difference, and no error.

Later, the timeout callback runs in a new browser task.

That is when we assign:

`this.name = 'Doe'`

After that task finishes, Zone.js notifies Angular.

Angular runs another `tick()`, and the UI updates.

So yes, `setTimeout` works.

But it works by escaping the current check, not by fixing the real timing problem.

## Slide 4.5 — Unidirectional Data Flow

Now we can answer the first question from the beginning:

Why does Angular throw `ExpressionChangedAfterItHasBeenCheckedError`?

The answer is **unidirectional data flow**.

Angular checks the component tree from top to bottom.

Once Angular has checked a binding and moved forward, that binding is expected to stay stable for the rest of the pass.

So Angular is not complaining because the value became `Doe`.

Changing values is normal.

The problem is that it became `Doe` after Angular had already checked that binding.

In other words, the change happened too late in the current pass.

If Angular kept going backward every time something changed behind it, one change detection pass would no longer have a clear meaning.

So in development mode, Angular runs the second check to catch this.

And when it sees that the value changed after it was checked, it throws NG0100.

That is the rule NG0100 protects.

Now this brings us to the next part.

Zone.js can tell Angular when something happened.

But it cannot tell Angular exactly what state changed, or which view depends on that state.

For that, Angular needs a different synchronization model.

## Slide 5.1 — Zone.js vs Signals

Now we can step back and compare the two models.

Zone.js gives Angular **timing information**.

It tells Angular:

Something happened.

A callback finished.

Maybe the UI needs to update.

But Zone.js does not know what state changed.

And it does not know which part of the UI depends on that state.

So Angular has to check broadly and rely on the idea that one pass should stay stable.

Signals give Angular something different.

They give Angular **dependency information**.

When a signal changes, Angular can know which views consumed that signal.

So the shift is this:

Zone.js says:

Something happened. Go check.

Signals say:

This state changed. These views are affected.

And that raises the next question:

How does Angular know which view depends on a signal?


## Slide 5.2 — Signals Build a Reactive Graph

The answer is it builds a reactive graph.

Here is the reactive graph of our example.

The first node is `name`.
This is the signal producer.

The second node is the `app-root` template.
This is the consumer of the `name` signal.

When the template runs and reads `name()`, Angular records that relationship.

It now knows:
This template depends on this signal.

So later, when `name` changes, Angular does not have to guess which part of the UI might be affected.

The graph already gives Angular the answer.
`name` changed.

And the `app-root` template is one of the consumers that depends on it.

But now we have an Angular-specific question:

How does a template become a reactive consumer in the first place?

## Slide 5.3 — Templates Run With a Reactive Consumer

This is the Angular-specific part.

When Angular refreshes a view, it runs the template with a **reactive consumer** attached to the `LView`.

So while the template is running, Angular knows:

This view has an active reactive consumer.

Then, if the template reads `name()`, the signal system sees that read.

Internally, that happens through the internal function `producerAccessed(name)`.

Because there is an active reactive consumer at that moment, Angular can record the dependency:

This reactive consumer depends on this signal producer.

So the read of `name()` is no longer just a normal function call.

It becomes dependency information.

That is how Angular creates the edge between the `name` signal producer and the reactive consumer for this view.

## Slide 5.4 — Push Dirtiness, Pull Values

What happens when the signal changes?

One thing that confused me about Signals at first is this:

When we call `.set()`, Angular does not push the new value directly into the template.

It pushes **dirtiness**.

So when we call:

`name.set('Doe')`

Angular marks the reactive consumer for this view as dirty.

It is basically saying:

This view depends on `name`, and `name` has changed.

But the new value is not written into the DOM immediately by the signal itself.

Later, when Angular refreshes the affected view, the template runs again.

Then the template calls `name()` again and pulls the latest value.

So the model is not:

Push the new value everywhere.

The model is:

Push dirtiness.

Then pull the latest value during refresh.

Now we can revisit the original example with the right mental model.

## Slide 5.5 - The Same Example with Signals

Now we can bring the original example back.

Same component. Same `ngAfterViewInit` timing. But now `name` is a signal.

In the first check, the template reads `name()`, gets 'John', and Angular stores 'John' in the `LView` binding slot. At the same time, the signal read records the edge from `name` to the `app-root` template consumer.

Then `ngAfterViewInit` runs. `name.set('Doe')` changes the signal value. The `LView` binding slot is still 'John', but now Angular also knows the template consumer is dirty.

So Angular can refresh the affected view. The template reads `name()` again, gets 'Doe', `bindingUpdated` compares old 'John' with new 'Doe', updates the `LView` slot, and writes the DOM again.

Signals do not remove `LView` or `bindingUpdated`. The difference is that the mutation is visible to Angular when it happens, so Angular can synchronize the affected view instead of only discovering a changed binding too late.

## Slide 5.6 — From One Pass to Synchronization

And this is where Angular's model changes from detection to synchronization.

And this is the answer to everything we have been building toward.

In the classic checking model, Angular runs a pass and expects the view to stay stable.

If something changes too late, Angular catches it in dev mode and throws NG0100.

But with Signals, Angular has more information.

If a signal changes during synchronization, Angular can see that change.

It can mark the affected reactive consumer dirty.

Then it can refresh that view again and continue until the UI becomes stable.

Angular still has safety limits.

It will not loop forever.

But the important difference is this:

A signal mutation is visible to Angular when it happens.

So Angular can incorporate that change into the synchronization process.

That is the shift:

From one pass that expects stability,

to a synchronization process that works until the affected views are stable.

Now let’s revisit the original NG0100 example one more time.

# Slide 5.7 — Signals Change the Timing Story

Now let’s bring everything back to the original example.

On the left, we have the class property version.

Angular checks `name`.

It gets `John`.

Then it stores `John` in `LView`.

After that, `ngAfterViewInit` runs and changes `name` to `Doe`.

But Angular only discovers that change later, during the second check.

And from Angular’s point of view, that is too late.

The binding was already checked.

So Angular throws NG0100.

On the right, we have the signal version.

The timing looks similar.

`ngAfterViewInit` still runs.

And we still change the value to `Doe`.

But this time, we call:

`name.set('Doe')`

That signal mutation is visible to Angular immediately.

Angular knows the signal changed.

It knows the affected reactive consumer.

So it marks that view dirty and synchronizes it before finishing.

That is the key difference.

With a class property, Angular discovers the change by checking again.

With a signal, Angular is told about the change when it happens.

So Signals make updates explicit.

Angular knows what changed, which view depends on it, and which view needs to refresh.

That is the shift:

From change detection that discovers changes,

to synchronization that reacts to known changes.


## Slide 5.8 - Thank You

Thank you.

I hope this was useful - not just as a list of Angular facts, but as a way to build the mental model from the ground up.

If you take one thing away: Zone.js solved the 'when' problem. Signals solve the 'what' problem. And once Angular knows what changed, it can synchronize instead of guess.

I'm Khang - author of @ng-brutalism/ui - build loud, stay sharp. Happy to take any questions.

## Optional Parking Lot / Q&A Slide

This example is useful, but I would keep it as an optional demo or Q&A slide.

It reinforces the same lesson: NG0100 is about when a mutation happens relative to Angular's checking pass.

But in the main path, it may distract from the cleaner story:

Zone.js knows when something happened, but not what changed. Signals make the mutation visible to Angular.
