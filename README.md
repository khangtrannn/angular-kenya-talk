# The Beauties of Angular Signals

### From Change Detection to Synchronization

A technical talk presented at **Angular Kenya** that builds a mental model of Angular's change detection from the ground up, then uses that model to explain what Signals change beneath the familiar API.

[![Watch The Beauties of Angular Signals on YouTube](https://i.ytimg.com/vi/QnzPf4nUFe0/maxresdefault.jpg)](https://www.youtube.com/watch?v=QnzPf4nUFe0)

**[Watch the talk](https://www.youtube.com/watch?v=QnzPf4nUFe0)** · **[Explore the presentation slides](https://angular-kenya-talk.khangtran.dev)**

## The technical journey

The talk begins with one of Angular's most misunderstood errors:

```text
ExpressionChangedAfterItHasBeenCheckedError
```

Rather than stopping at the usual fixes, it traces the error through Angular's internals and uses it to answer two deeper questions:

- Why does Angular throw this error?
- Why does wrapping the mutation in `setTimeout` make it disappear without fixing the underlying problem?

From there, the session follows the complete path from a state mutation to a synchronized DOM:

1. **[Zone.js and change-detection timing](https://angular-kenya-talk.khangtran.dev/zonejs-let-me-call-angular-for-you)**
   How Angular learns that application state *might* have changed, and why that notification cannot identify what changed.

2. **[`ApplicationRef.tick()` and component-tree traversal](https://angular-kenya-talk.khangtran.dev/tick-walks-the-component-tree)**
   How Angular checks views from the root and executes generated template instructions.

3. **[Template functions, binding instructions, and `LView`](https://angular-kenya-talk.khangtran.dev/how-a-binding-update-reaches-the-dom)**
   How compiled templates read component state, compare binding values, retain previous values, and update the DOM.

4. **[Development-mode stability checks and NG0100](https://angular-kenya-talk.khangtran.dev/why-ng0100-happens)**
   Why Angular performs a second check, how late mutations violate unidirectional data flow, and what the error is protecting.

5. **[Why `setTimeout` appears to work](https://angular-kenya-talk.khangtran.dev/why-setTimeout-works)**
   How moving a mutation into a later browser task escapes the current check instead of correcting the timing issue.

6. **[Signals and the reactive graph](https://angular-kenya-talk.khangtran.dev/signals-build-a-reactive-graph)**
   How producers and consumers give Angular dependency information, enabling a more precise synchronization model.

## Core idea

```text
Zone.js:  "Something happened. State might have changed."
Signals:  "This state changed, and these consumers depend on it."
```

Signals are more than a convenient state API. They give Angular the dependency information required to move from broadly detecting possible changes toward synchronizing the views that depend on changed state.

## Speaker

**Khang Tran** is a frontend engineer specializing in Angular and reactive architecture.

**[GitHub](https://github.com/khangtrannn)** · **[LinkedIn](https://linkedin.com/in/khangtrann)**
