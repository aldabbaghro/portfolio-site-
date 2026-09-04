// Shared site behavior: mobile nav, scroll reveal, flipbook viewer, BTS loop.

document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  initLightbox();
  initScrollTop();
  initLeadPhotoAlign();
});

/**
 * The small lead-in photo above the headline is meant to sit with its
 * left-most (rotated) corner flush against the right edge of the "r" in
 * "Designer". A fixed CSS gap can only get this right at one viewport
 * width, since the headline reflows non-linearly while the photo's
 * position moves linearly — so instead we measure the actual rendered
 * position of that glyph and nudge the photo to meet it, live, in
 * whatever width the page is actually being viewed at. Re-runs on font
 * load (metrics change once the webfont swaps in) and on resize.
 */
function initLeadPhotoAlign() {
  const h1 = document.querySelector('.mega-title');
  const lm = document.querySelector('.lead-medium');
  const ls = document.querySelector('.lead-small');
  if (!h1 || !lm || !ls) return;

  function align() {
    // Below this width the photos already shrink/stack tightly via flex;
    // leave the CSS default alone rather than fighting for space.
    if (window.innerWidth < 640) {
      ls.style.marginLeft = '';
      return;
    }

    const text = h1.textContent;
    const idx = text.lastIndexOf('Designer');
    if (idx === -1) { ls.style.marginLeft = ''; return; }
    const rEndIdx = idx + 'Designer'.length;
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) return;

    // Reset any previous offset before measuring, so we never compound.
    ls.style.marginLeft = '0px';

    const range = document.createRange();
    range.setStart(node, rEndIdx - 1);
    range.setEnd(node, rEndIdx);
    const rRect = range.getBoundingClientRect();
    const lsRect = ls.getBoundingClientRect();
    const lmRect = lm.getBoundingClientRect();

    let delta = rRect.right - lsRect.left;

    // Never let it creep left into the medium photo — keep at least a
    // 24px clearance from its (rotated) right-most extent.
    const minLeft = lmRect.right + 24;
    if (lsRect.left + delta < minLeft) {
      delta = minLeft - lsRect.left;
    }
    // Never push it past the text column's right edge.
    const container = document.querySelector('.hero-interact-text');
    if (container) {
      const maxRight = container.getBoundingClientRect().right;
      if (lsRect.right + delta > maxRight) {
        delta -= (lsRect.right + delta) - maxRight;
      }
    }

    ls.style.marginLeft = delta + 'px';
  }

  align();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(align);
  }
  window.addEventListener('load', align);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(align, 120);
  });
}

/**
 * Fixed circular "back to top" button — fades in once the page has been
 * scrolled past one viewport height, scrolls smoothly to top on click.
 */
function initScrollTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;

  function toggle() {
    if (window.scrollY > window.innerHeight * 0.6) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }
  toggle();
  window.addEventListener('scroll', toggle, { passive: true });

  const icon = btn.querySelector('.mark-icon');
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (icon) {
      icon.classList.remove('spin');
      // force reflow so the animation restarts even on rapid re-clicks
      void icon.offsetWidth;
      icon.classList.add('spin');
    }
  });
  if (icon) {
    icon.addEventListener('animationend', () => icon.classList.remove('spin'));
  }
}

/**
 * Initialize click-to-enlarge lightbox for any <a class="lightbox-trigger">
 * wrapping an <img>. Works regardless of whether the href is a real file
 * path or an inlined data: URI (unlike target="_blank", which browsers
 * block for data: URI navigation).
 */
function initLightbox() {
  const triggers = document.querySelectorAll('.lightbox-trigger');
  if (!triggers.length) return;

  let overlay = document.getElementById('siteLightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'siteLightbox';
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = '<button class="lightbox-close" type="button" aria-label="Close">&times;</button><img class="lightbox-img" alt="">';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  const imgEl = overlay.querySelector('.lightbox-img');

  function openLightbox(src, alt) {
    imgEl.src = src;
    imgEl.alt = alt || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  triggers.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const img = a.querySelector('img');
      const full = a.getAttribute('data-full') || a.getAttribute('href');
      openLightbox(full, img ? img.alt : '');
    });
  });
}

/**
 * Initialize a flipbook viewer.
 * @param {string} containerId - id of the .flipbook element
 * @param {string[]} images - ordered list of image paths (empty array = show placeholder)
 * @param {string} placeholderText - shown when images is empty
 */
function initFlipbook(containerId, images, placeholderText) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const countEl = document.getElementById(containerId + '-count');
  const prevBtn = document.getElementById(containerId + '-prev');
  const nextBtn = document.getElementById(containerId + '-next');

  if (!images || images.length === 0) {
    el.innerHTML = '<div class="flipbook-placeholder"><p>' + (placeholderText || 'Pages coming soon.') + '</p></div>';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (countEl) countEl.textContent = '0 / 0';
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let animating = false;

  // Base layer: always shows the current/destination page, sitting under
  // everything else. Leaf: a second copy of the *outgoing* page that lifts
  // and rotates away on a hinge, revealing the base page beneath it: an
  // actual page turning over, rather than one flat image swapping for
  // another mid-rotation.
  const baseWrap = document.createElement('div');
  baseWrap.className = 'flipbook-base';
  const baseImg = document.createElement('img');
  baseImg.className = 'flipbook-page';
  baseImg.loading = 'eager';
  baseWrap.appendChild(baseImg);

  const leafImg = document.createElement('img');
  leafImg.className = 'flipbook-page flipbook-leaf';
  leafImg.loading = 'eager';
  leafImg.setAttribute('aria-hidden', 'true');

  const shade = document.createElement('div');
  shade.className = 'flipbook-shade';

  const spine = document.createElement('div');
  spine.className = 'flipbook-spine';

  el.innerHTML = '';
  el.appendChild(baseWrap);
  el.appendChild(leafImg);
  el.appendChild(shade);
  el.appendChild(spine);

  // A "spread" (two facing pages photographed as one wide image) gets the
  // center gutter shadow; a single page (cover, opening/closing text) does
  // not, since there's no real seam to fake there.
  function updateSpine() {
    if (baseImg.naturalWidth && baseImg.naturalHeight && (baseImg.naturalWidth / baseImg.naturalHeight) > 1.3) {
      spine.classList.add('visible');
    } else {
      spine.classList.remove('visible');
    }
  }
  baseImg.addEventListener('load', updateSpine);

  function updateChrome() {
    if (countEl) countEl.textContent = (index + 1) + ' / ' + images.length;
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === images.length - 1;
  }

  function render() {
    baseImg.src = images[index];
    baseImg.alt = 'Page ' + (index + 1) + ' of ' + images.length;
    updateChrome();
  }

  // Turns the visible page like a real leaf, hinged on the edge you're
  // advancing toward: the outgoing page (on the leaf) lifts off that hinge,
  // darkens slightly as it foreshortens, and rotates past edge-on, while
  // the destination page (already loaded on the base layer beneath it) is
  // revealed underneath as it clears. A soft shadow sweeps across the base
  // page in sync, like the cast shadow of a turning leaf.
  function go(newIndex, direction) {
    if (animating || newIndex < 0 || newIndex >= images.length) return;
    const outgoing = index;
    index = newIndex;
    updateChrome();

    if (reduceMotion) { render(); return; }

    animating = true;

    leafImg.src = images[outgoing];
    leafImg.alt = '';
    leafImg.className = 'flipbook-page flipbook-leaf turning';

    baseImg.src = images[index];
    baseImg.alt = 'Page ' + (index + 1) + ' of ' + images.length;

    const dirClass = direction === 'next' ? 'turning-next' : 'turning-prev';
    shade.className = 'flipbook-shade';

    // Force layout so the reset (flat, no transition) is committed before
    // the transition-bearing classes are added on the next frame: otherwise
    // the browser can collapse both states into a single jump.
    void leafImg.offsetWidth;

    window.requestAnimationFrame(() => {
      leafImg.classList.add(dirClass);
      shade.classList.add('turning');
    });

    window.setTimeout(() => {
      leafImg.className = 'flipbook-page flipbook-leaf';
      shade.className = 'flipbook-shade';
      animating = false;
    }, 540);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => go(index - 1, 'prev'));
  if (nextBtn) nextBtn.addEventListener('click', () => go(index + 1, 'next'));

  el.setAttribute('tabindex', '0');
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1, 'next');
    if (e.key === 'ArrowLeft') go(index - 1, 'prev');
  });

  render();
}

/**
 * Initialize a looping BTS image square.
 * @param {string} containerId - id of the .bts-square element
 * @param {string[]} images - ordered list of image paths
 * @param {number} intervalMs - time between frames
 */
function initBTSLoop(containerId, images, intervalMs) {
  const el = document.getElementById(containerId);
  if (!el || !images || images.length === 0) return;
  el.innerHTML = images.map((src, i) =>
    '<img src="' + src + '" alt="Behind the scenes photo ' + (i + 1) + '" class="' + (i === 0 ? 'active' : '') + '">'
  ).join('');
  const imgs = el.querySelectorAll('img');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || imgs.length < 2) return;
  let i = 0;
  setInterval(() => {
    imgs[i].classList.remove('active');
    i = (i + 1) % imgs.length;
    imgs[i].classList.add('active');
  }, intervalMs || 2200);
}

/**
 * Initialize one panel of a borderless photo collage: a shuffled,
 * crossfading set of images that auto-advances and loops on its own, with
 * no buttons or counter: clicking the panel jumps straight to the next
 * image and resets the auto-advance timer. Images are shown with
 * object-fit:contain (via CSS) so nothing is cropped or stretched.
 * @param {string} containerId - id of the panel element
 * @param {string[]} images - image paths for this panel (already grouped
 *   by orientation by the caller)
 * @param {number} intervalMs - time between auto-advances
 */
function initCollagePanel(containerId, images, intervalMs) {
  const el = document.getElementById(containerId);
  if (!el || !images || images.length === 0) return;

  const shuffled = images.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }

  el.innerHTML = shuffled.map((src, i) =>
    '<img src="' + src + '" alt="Between Blooms photo" class="' + (i === 0 ? 'active' : '') + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">'
  ).join('');
  const imgs = el.querySelectorAll('img');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let timer = null;

  function show(newIndex) {
    imgs[index].classList.remove('active');
    index = (newIndex + shuffled.length) % shuffled.length;
    imgs[index].classList.add('active');
  }

  function startAuto() {
    if (reduceMotion || imgs.length < 2) return;
    stopAuto();
    timer = window.setInterval(() => show(index + 1), intervalMs || 4000);
  }
  function stopAuto() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }

  if (imgs.length > 1) {
    el.addEventListener('click', () => { show(index + 1); startAuto(); });
  }

  startAuto();
}
