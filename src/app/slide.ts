import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { SLIDE_BY_SLUG, SLIDES, findSlideIndex } from './slides';

@Component({
  selector: 'app-slide',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = slide();
    @if (s) {
      <picture class="slide">
        <source [srcset]="webpFor(s.image)" type="image/webp" />
        <img [src]="'slides/' + s.image" [alt]="s.title" fetchpriority="high" />
      </picture>
    } @else {
      <div class="missing">
        <p>Slide not found.</p>
        <a routerLink="/introduction">Back to start</a>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100vw;
        height: 100dvh;
      }
      .slide {
        display: block;
        width: 100%;
        height: 100%;
      }
      .slide img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .missing {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        height: 100%;
        color: #d4d4d4;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .missing a {
        color: #f6c945;
      }
    `,
  ],
})
export class SlideComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: '',
  });

  readonly slide = computed(() => SLIDE_BY_SLUG.get(this.slug()));

  constructor() {
    effect(() => {
      if (!this.isBrowser) return;
      const i = findSlideIndex(this.slug());
      if (i < 0 || i >= SLIDES.length - 1) return;
      new Image().src = this.webpFor(SLIDES[i + 1].image);
    });
  }

  webpFor(image: string): string {
    return `slides/webp/${image.replace(/\.png$/i, '.webp')}`;
  }
}
