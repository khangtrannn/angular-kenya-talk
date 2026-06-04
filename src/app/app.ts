import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SLIDES, findSlideIndex } from './slides';

const SITE_URL = 'https://angular-kenya-talk.khangtran.dev';
const OG_IMAGE = `${SITE_URL}/slides/introduction.png`;
const DESCRIPTION = 'The Beauties of Angular Signals — talk at Angular Kenya 2026.';
const SWIPE_THRESHOLD_PX = 50;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />

    <button
      type="button"
      class="zone zone-prev"
      (click)="prev()"
      aria-label="Previous slide"
      tabindex="-1"
    ></button>
    <button
      type="button"
      class="zone zone-next"
      (click)="next()"
      aria-label="Next slide"
      tabindex="-1"
    ></button>

    <footer class="tag">Khang Tran · Angular Kenya 2026</footer>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        width: 100vw;
        height: 100dvh;
        overflow: hidden;
        background: #f9eeda;
      }
      .zone {
        position: fixed;
        top: 0;
        bottom: 0;
        width: 35vw;
        background: transparent;
        border: 0;
        padding: 0;
        margin: 0;
        cursor: pointer;
        z-index: 5;
        -webkit-tap-highlight-color: transparent;
      }
      .zone:focus-visible {
        outline: 2px solid #f6c945;
        outline-offset: -4px;
      }
      .zone-prev {
        left: 0;
      }
      .zone-next {
        right: 0;
      }
      .tag {
        position: fixed;
        right: 0.75rem;
        bottom: 0.5rem;
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.35);
        letter-spacing: 0.02em;
        pointer-events: none;
        z-index: 10;
      }
    `,
  ],
})
export class App {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly slug = computed(() => this.url().split('?')[0].split('#')[0].replace(/^\//, ''));
  private readonly index = computed(() => findSlideIndex(this.slug()));

  private touchStartX = 0;

  constructor() {
    this.meta.addTags([
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1672' },
      { property: 'og:image:height', content: '941' },
      { property: 'og:type', content: 'website' },
      { property: 'og:description', content: DESCRIPTION },
      { name: 'description', content: DESCRIPTION },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ]);

    effect(() => {
      const i = this.index();
      const slide = i >= 0 ? SLIDES[i] : null;
      const title = slide
        ? `${slide.title} — Angular Kenya 2026`
        : 'The Beauties of Angular Signals — Angular Kenya 2026';
      this.title.setTitle(title);
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ name: 'twitter:title', content: title });

      const url = `${SITE_URL}/${this.slug()}`;
      this.meta.updateTag({ property: 'og:url', content: url });
      this.setCanonical(url);
    });
  }

  prev(): void {
    const i = this.index();
    if (i > 0) {
      this.router.navigate([SLIDES[i - 1].slug]);
    }
  }

  next(): void {
    const i = this.index();
    if (i >= 0 && i < SLIDES.length - 1) {
      this.router.navigate([SLIDES[i + 1].slug]);
    }
  }

  first(): void {
    this.router.navigate([SLIDES[0].slug]);
  }

  last(): void {
    this.router.navigate([SLIDES[SLIDES.length - 1].slug]);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        this.prev();
        break;
      case 'Home':
        event.preventDefault();
        this.first();
        break;
      case 'End':
        event.preventDefault();
        this.last();
        break;
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].clientX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    dx < 0 ? this.next() : this.prev();
  }

  private setCanonical(url: string): void {
    if (!this.isBrowser) return;
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
