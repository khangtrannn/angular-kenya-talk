export interface Slide {
  slug: string;
  title: string;
  image: string;
}

export const SLIDES: Slide[] = [
  { slug: 'introduction', title: 'The Beauties of Angular Signals', image: 'introduction.png' },
  { slug: 'the-error-message', title: 'The Error Message', image: 'the-error-message.png' },
  { slug: 'setTimeout', title: 'setTimeout', image: 'setTimeout.png' },
  { slug: 'rfc', title: 'Signals RFC', image: 'rfc.png' },
  { slug: 'two-important-questions', title: 'Two Important Questions', image: 'two-important-questions.png' },
  { slug: 'what-is-change-detection', title: 'What Is Change Detection?', image: 'what-is-change-detection.png' },
  { slug: 'vanilla-js-state-does-not-update-the-ui', title: 'Vanilla JS: State Does Not Update the UI', image: 'vanilla-js-state-does-not-update-the-ui.png' },
  { slug: 'the-manual-render-problem', title: 'The Manual Render Problem', image: 'the-manual-render-problem.png' },
  { slug: 'zone-js-let-me-call-angular-for-you', title: 'Zone.js: Let Me Call Angular For You', image: 'zone-js-let-me-call-angular-for-you.png' },
  { slug: 'from-something-happened-to-tick', title: 'From "Something Happened" to tick()', image: 'from-something-happened-to-tick.png' },
  { slug: 'tick-walks-the-component-tree', title: 'tick() Walks the Component Tree', image: 'tick-walks-the-component-tree.png' },
  { slug: 'every-binding-has-memory', title: 'Every Binding Has Memory', image: 'every-binding-has-memory.png' },
  { slug: 'the-binding-check', title: 'The Binding Check', image: 'the-binding-check.png' },
  { slug: 'dev-mode-double-check-stability', title: 'Dev Mode Double Checks Stability', image: 'dev-mode-double-check-stability.png' },
  { slug: 'back-to-the-original-code', title: 'Back to the Original Code', image: 'back-to-the-original-code.png' },
  { slug: 'why-ng0100-happens', title: 'Why NG0100 Happens', image: 'why-ng0100-happens.png' },
  { slug: 'why-setTimeout-works', title: 'Why setTimeout "Works"', image: 'why-setTimeout-works.png' },
  { slug: 'the-real-lesson', title: 'The Real Lesson', image: 'the-real-lesson.png' },
  { slug: 'zonejs-vs-signals', title: 'Zone.js vs Signals', image: 'zonejs-vs-signals.png' },
  { slug: 'the-same-example-with-signals', title: 'The Same Example with Signals', image: 'the-same-example-with-signals.png' },
  { slug: 'signals-build-a-reactive-graph', title: 'Signals Build a Reactive Graph', image: 'signals-build-a-reactive-graph.png' },
  { slug: 'push-poll-pull', title: 'Push, Poll, Pull', image: 'push-poll-pull.png' },
  { slug: 'the-templates-become-reactive-consumers', title: 'Templates Become Reactive Consumers', image: 'the-templates-become-reactive-consumers.png' },
  { slug: 'from-one-pass-to-synchronization', title: 'From One Pass to Synchronization', image: 'from-one-pass-to-synchronization.png' },
  { slug: 'ng0100-revisited-with-signals', title: 'NG0100 Revisited with Signals', image: 'ng0100-revisited-with-signals.png' },
  { slug: 'thank-you', title: 'Thank You', image: 'thank-you.png' },
];

export const SLIDE_BY_SLUG = new Map(SLIDES.map((s) => [s.slug, s]));

export function findSlideIndex(slug: string): number {
  return SLIDES.findIndex((s) => s.slug === slug);
}
