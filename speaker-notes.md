# Speaker Notes

## Slide 1.1 - Introduction

Hi everyone, I'm Khang, a software engineer from Vietnam.

This is my very first time speaking at a webinar like this, so I would like to thanks to the Angular Kenya team for setting everything up and making this happen.

So, what I want to do today is kind of take you guys along on some of the things I've learned about Angular Change Detection and Signals.

And I am not an expert in any of this, so this is going to be me taking you guys along on my learning journey and nothing more.

I would like start with the reason why I end up here talking about this topic today?

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

To answer those questions, we had to understand what Angular is actually doing during change detection by building the mental model from the ground up.

## Slide 2.1 - What Is Change Detection?

Before we talk about Signals, let's step back to a basic question "What is change detection".

At the simplest level, change detection is Angular keeping your application state and the rendered UI in sync.

When state changes, the UI should reflect that change.

This is simple idea but there are two questions that Angular need to answer when Angular should run change detection, and what part of the UI it should update.

To make that concrete, let's start with a tiny counter example.

## Slide 2.2 - Vanilla JS: State Does Not Update the UI

Here is the same idea in plain JavaScript.

We have some state: `count`.

We have some UI: this `span`.

The important thing is that there is no connection between the DOM and the count state.

So changing the state does not automatically update the screen.

That the reason why we need to have a `render()` function here to connect them together.

The only time the UI gets synchronized is when we call `render()`.

## Slide 2.3 - The Manual Render Problem

But there is a problem here, to make sure everything stays in sync, whenever state changes, we have to call the `render()` function manually.

Now imagine this in a real application.

State can change from many places, like a click event, a timer, a Promise, or an API response.

That means we have to remember to call `render()` in all of those places.

And this is the problem Angular needed to solve before Signals:

how does Angular know when the application might need to update the UI?

Transition:

Angular's first big answer was Zone.js.

## Slide 2.4 - Zone.js: Let Me Call Angular For You

This is where Zone.js comes in.

Instead of asking us to remember every place where state can change, Angular uses Zone.js to watch the common places where asynchronous work enters the app.

Things like click events, timers, Promises, and HTTP responses.

When one of those callbacks runs, Zone.js lets the callback finish first.

Then it notifies Angular.

The important detail is that Zone.js does not update the UI by itself.

And it does not tell Angular exactly what state changed.

It only tells Angular: something just happened, so something might have changed.

That gives Angular the first answer:

when to run change detection.

But it still does not answer the second question:

what actually changed?

Transition:

That notification is only the starting point.

## Slide 3.1 - `tick()` Walks the Component Tree

Once Angular receives that notification, Angular responds by running `ApplicationRef.tick()`.

Because Zone.js does not deliver any information about what changed, Angular needs to start change detection from the root component and walk down the component tree.

Parent first. Then child components. Top to bottom.

But now we can ask the more interesting question: when Angular reaches one component, what does it actually check?

## Slide 3.2 - Template Functions

When Angular reaches a component, it needs to know two things.

Which values should it read from the component?

And where should those values go in the DOM?

The thing that answers both questions is the template function: `templateFn`.

## Slide 3.4 - Template Compiler

Now let's open that `templateFn` and see how it answers those two questions.

Here is a simplified version of what the compiler generates for a tiny template.

`rf` is the render flag. For our purpose, just read it as two modes: create and update.

`ctx` is the component instance, so `ctx.name` is the `name` property from our class.

The first block is the creation block. It creates the DOM nodes once.

The second block is the update block. This is the part that runs during change detection.

And the important line is `ɵɵtextInterpolate(ctx.name)`, because this is where Angular reads the current value of the binding.

## Slide 3.5 - LView: Where Angular Remembers Values

Now we need one more piece: where does Angular keep the previous value of a binding?

Angular stores that previous value inside something called `LView`.

You can think of `LView` as Angular's internal storage for this view.

Technically, it is an array, but the important idea is what it stores.

It keeps references to DOM nodes, the component instance, and the last value Angular saw for each binding.

So for `{{ name }}`, Angular has a place where it can remember: last time, this was `"John"`.

That memory is what makes comparison possible.

## Slide 3.6 - How a Binding Update Reaches the DOM

Now let's follow the update path.

The template function calls `ɵɵtextInterpolate(ctx.name)`.

Inside that interpolation work, Angular runs a binding check with `bindingUpdated(...)`.

`bindingUpdated(...)` reads the old value from `LView` and compares it with the new value Angular just read from the template function.

If the value is unchanged, it returns `false`, and the update path stops. Nothing needs to touch the DOM.

If the value changed, Angular stores the new value in `LView` and returns `true`.

This is the core loop of change detection: read the binding, compare it with the last value, and remember the new value when it changes.

Transition:

In development mode, Angular asks one stricter question: after checking, are these binding values still stable?

## Slide 4.1 - Dev Mode and the Second Check

In development mode, Angular takes that binding check one step further.

After the normal change detection pass, it runs another pass immediately.

The first pass is allowed to update `LView` and the DOM.

The second pass is different. It re-runs the template, but it expects every binding to produce the same value as before.

If the values are the same, Angular knows the view is stable.

If a binding produces a different value, Angular throws `NG0100`.

Transition:

Now let's return to the code from the beginning.

## Slide 4.2 - Back to the Original Code

Now let's go back to the code that sent me to Stack Overflow.

At first glance, this code feels pretty normal.

We start with `name = 'John'`, the template reads `name`, and after the view initializes, we assign `name = 'Doe'`.

The final value, `Doe`, is perfectly valid. The interesting detail is where the assignment happens: inside `ngAfterViewInit`.

That hook runs after Angular has already read this template binding once in the current pass.

So to understand the error, let's trace the timeline.

## Slide 4.3 - Why NG0100 Happens

Let's walk through it slowly.

First pass: Angular reads `{{ name }}`. At this moment, `name` is `'John'`, so Angular remembers `'John'` in `LView`.

Then the lifecycle hook runs. `ngAfterViewInit` assigns `this.name = 'Doe'`.

Now dev mode does the second pass. It reads the same binding again. But this time, it gets `'Doe'`.

And that is the problem. Angular was expecting the value it had just checked: `'John'`.

So when Angular says `ExpressionChangedAfterItHasBeenCheckedError`, it is describing exactly what happened: `{{ name }}` changed after it was checked.

Transition:

This also explains why the famous `setTimeout` trick appears to fix it.

## Slide 4.4 - Why `setTimeout` "Works"

This is the part I wish I had understood from the very beginning.

`setTimeout` does not make the assignment safer. It moves the assignment out of the current change detection cycle and into a later browser task.

During the current cycle, Angular only registers the timeout. The callback has not run yet, so `name` is still `'John'`.

When `checkNoChanges` runs, it sees `'John'` again, so there is no NG0100.

Later, the timeout callback runs in a new browser task. It assigns `this.name = 'Doe'`. After that task, Zone.js triggers another `tick()`, and Angular updates the UI.

So yes, it works. But it works by escaping the current check, not by fixing the model.

## Slide 4.5 - Unidirectional Data Flow

Now we can answer the first question from the beginning: why does Angular throw `ExpressionChangedAfterItHasBeenCheckedError`?

The answer is unidirectional data flow.

Angular checks the component tree top-down. Once Angular has checked a binding and moved forward, that binding is expected to stay stable for the rest of the pass.

Angular is not complaining because the value became `Doe`. It is complaining because the binding changed in the wrong direction: after Angular had already checked it and moved forward.

If Angular kept going backward every time something changed behind it, one pass would no longer have a clear meaning.

In dev mode, Angular catches that with the second check and throws NG0100.

That is the rule NG0100 protects.

Transition:

Zone.js can tell Angular when something happened. But it cannot tell Angular exactly what state changed, or which view depends on that state. For that, Angular needs a different synchronization model.

## Slide 5.1 - Zone.js vs Signals

Okay - here's the big picture comparison. And I think once you see this it just clicks.

Zone.js gives Angular timing information. A callback finished, so something might have changed.

But Zone.js cannot tell Angular which state changed, or which view depends on that state. So conceptually, Angular has to check broadly and expect that one pass is stable.

Signals give Angular dependency information. A signal changed, and Angular can know which views consumed that signal.

That is the shift: from 'something happened, go check' to 'this state changed, and these are the affected views'.

Transition:

But that raises the real question: how can Angular know which view depends on a signal?

## Slide 5.2 - Signals Build a Reactive Graph

Here's how Angular gets dependency information.

This graph only has two nodes, and that is enough for our example.

`name` is a signal producer. The `app-root` template is a reactive consumer.

When the template reads `name()`, Angular records the edge: this template consumer depends on this signal producer.

So when `name` changes later, Angular does not need to discover that relationship by guessing. The graph already has the answer.

Transition:

Now the Angular-specific question is: how does a template become a reactive consumer in the first place?

## Slide 5.3 - Templates Run With a Reactive Consumer

This is the Angular-specific piece.

When Angular refreshes a view, it can run the template with a reactive consumer attached to the `LView`.

Then Angular executes the template. If the template reads `name()`, the signal system sees that read through `producerAccessed(name)`.

Because Angular is currently running the template with a reactive consumer, that read creates the edge from the `name` signal producer to the `app-root` template consumer.

This is why a template read is not just a normal function call anymore. It becomes dependency information.

Transition:

Now we know how the edge is created. What happens when the signal changes?

## Slide 5.4 - Push Dirtiness, Pull Values

One thing that confused me about Signals at first: when you call `.set()`, Angular does not push the new value directly into the template.

What it pushes is dirtiness.

`name.set('Doe')` marks the `app-root` template consumer dirty. Then, when Angular refreshes that affected view, the template calls `name()` again and pulls the latest value.

So the model is not 'push the value everywhere.' It is: push dirtiness, then pull the value during refresh.

Transition:

Now we can revisit the exact example from the beginning with the right mental model.

## Slide 5.5 - The Same Example with Signals

Now we can bring the original example back.

Same component. Same `ngAfterViewInit` timing. But now `name` is a signal.

In the first check, the template reads `name()`, gets 'John', and Angular stores 'John' in the `LView` binding slot. At the same time, the signal read records the edge from `name` to the `app-root` template consumer.

Then `ngAfterViewInit` runs. `name.set('Doe')` changes the signal value. The `LView` binding slot is still 'John', but now Angular also knows the template consumer is dirty.

So Angular can refresh the affected view. The template reads `name()` again, gets 'Doe', `bindingUpdated` compares old 'John' with new 'Doe', updates the `LView` slot, and writes the DOM.

Signals do not remove `LView` or `bindingUpdated`. The difference is that the mutation is visible to Angular when it happens, so Angular can synchronize the affected view instead of only discovering a changed binding too late.

Transition:

And this is where Angular's model changes from detection to synchronization.

## Slide 5.6 - From One Pass to Synchronization

And this is the answer to everything we've been building toward.

Old model: Angular runs one pass, expects it to be stable, and throws NG0100 if anything changes too late.

Signal model: if a signal changes during synchronization, Angular can honor it. It marks the affected view dirty and loops until everything stabilizes.

Angular still has safety limits - it won't loop forever. But late mutations via signals aren't violations anymore. Angular knows about them. It can incorporate them.

The model went from 'one pass, hope for the best' to 'synchronize until stable'.

Transition:

Now let's revisit the original NG0100 example one more time.

## Slide 5.7 - Signals Change the Timing Story

Let's bring this back to where we started.

On the left: the class property version. Angular checks `name`, gets 'John', stores it. Then `ngAfterViewInit` runs and mutates `name` to 'Doe'. Angular discovers the change too late - after the check has already moved past it. NG0100.

On the right: the signal version. `name.set('Doe')` runs. Angular is notified at that exact moment. The view is marked dirty. Angular synchronizes it before finishing the pass.

The bottom line on the slide says it: signals make updates explicit. Angular doesn't have to discover the change by checking. It is told about the change when it happens.

With a class property, Angular is always guessing - scanning the tree, hoping nothing changed too late.

With a signal, Angular knows. It knows what changed, which view consumed it, and when to refresh it.

That is the shift from change detection to synchronization.

Transition to Q&A:

And that's the whole story - from a vanilla JavaScript counter that needed a manual render(), through Zone.js telling Angular when to check, through LView and templateFn and bindingUpdated, through NG0100 and unidirectional data flow, all the way to Signals giving Angular the information it was always missing.

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
