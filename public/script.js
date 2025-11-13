// public/script.js
// Carousel + sidemenu for CRA + React
// - Initializes sidemenu and carousels
// - Wire arrow buttons
// - Supports touch/swipe (mobile) and mouse drag
// - MutationObserver to re-init when React mounts new carousels or buttons
// - Exposes window.bhInitCarousels() for manual re-init from React

(function () {
  // debounce helper
  function debounce(fn, wait = 80) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // SIDEMENU initialization
  function initSidemenu() {
    const menuBtn = document.getElementById('menuBtn');
    const sidemenu = document.getElementById('sidemenu');
    const closeBtn = document.getElementById('closeSidemenu');

    if (menuBtn && sidemenu && !menuBtn._bhSidemenuInit) {
      menuBtn._bhSidemenuInit = true;
      menuBtn.addEventListener('click', function () {
        sidemenu.classList.add('open');
        document.body.style.overflow = 'hidden';
        menuBtn.setAttribute('aria-expanded', 'true');
        sidemenu.setAttribute('aria-hidden', 'false');
      });
    }

    if (closeBtn && sidemenu && !closeBtn._bhSidemenuInit) {
      closeBtn._bhSidemenuInit = true;
      closeBtn.addEventListener('click', function () {
        sidemenu.classList.remove('open');
        document.body.style.overflow = '';
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
        sidemenu.setAttribute('aria-hidden', 'true');
      });
    }

    if (sidemenu && !sidemenu._bhOverlayInit) {
      sidemenu._bhOverlayInit = true;
      sidemenu.addEventListener('click', function (e) {
        if (e.target === sidemenu) {
          sidemenu.classList.remove('open');
          document.body.style.overflow = '';
          if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
          sidemenu.setAttribute('aria-hidden', 'true');
        }
      });
    }
  }

  // Carousel helpers
  function getVisibleCount() {
    if (window.innerWidth > 900) return 4;
    if (window.innerWidth > 600) return 3;
    return 2;
  }

  function measureCardAndGap(carousel) {
    const cards = carousel.querySelectorAll('.card');
    if (!cards.length) return { cardWidth: 0, gap: 0 };
    const first = cards[0];
    const rect = first.getBoundingClientRect();
    let cardWidth = Math.round(rect.width);

    const style = window.getComputedStyle(first);
    let gap = parseFloat(style.marginRight) || 0;

    if ((!gap || isNaN(gap)) && cards.length > 1) {
      const rect2 = cards[1].getBoundingClientRect();
      gap = Math.round(rect2.left - rect.left - rect.width);
      if (gap < 0) gap = 0;
    }

    cardWidth = Math.max(0, cardWidth);
    gap = Math.max(0, gap);
    return { cardWidth, gap };
  }

  function clampPosition(cardsLength, visibleCount, pos) {
    const maxPos = Math.max(0, cardsLength - visibleCount);
    if (pos < 0) return maxPos;
    if (pos > maxPos) return 0;
    return pos;
  }

  function updateCarousel(carousel, position) {
    const cards = carousel.querySelectorAll('.card');
    const visibleCount = getVisibleCount();
    if (!cards.length) return;

    const { cardWidth, gap } = measureCardAndGap(carousel);
    const maxPosition = Math.max(0, cards.length - visibleCount);

    let pos = position;
    pos = clampPosition(cards.length, visibleCount, pos);

    const shift = pos * (cardWidth + gap);
    const roundedShift = Math.round(shift);

    carousel.style.transform = `translate3d(${-roundedShift}px, 0, 0)`;
    carousel.dataset.position = pos;
  }

  // Wire arrow buttons (idempotent)
  function wireCarouselButtons() {
    document.querySelectorAll('.carousel-btn').forEach(btn => {
      if (btn._bhBtnInit) return;
      btn._bhBtnInit = true;
      btn.addEventListener('click', function (ev) {
        ev.preventDefault && ev.preventDefault();
        const car = btn.dataset.carousel;
        const dir = btn.dataset.dir;
        // find the matching carousel element
        const carousel = document.querySelector(`.carousel[data-carousel="${car}"]`);
        if (!carousel) return;

        const cards = carousel.querySelectorAll('.card');
        const visibleCount = getVisibleCount();
        const maxPosition = Math.max(0, cards.length - visibleCount);

        let position = Number(carousel.dataset.position) || 0;

        if (dir === "right") {
          position = position + 1;
          if (position > maxPosition) position = 0;
        } else {
          position = position - 1;
          if (position < 0) position = maxPosition;
        }
        updateCarousel(carousel, position);
      });
    });
  }

  // Touch + mouse-drag handlers (idempotent)
  function wireTouchAndDrag() {
    document.querySelectorAll('.carousel-viewport').forEach(viewport => {
      if (viewport._bhTouchInit) return;
      viewport._bhTouchInit = true;

      const carousel = viewport.querySelector('.carousel');
      if (!carousel) return;

      // Touch variables
      let startX = 0, startY = 0, dx = 0, dy = 0, touching = false;

      viewport.addEventListener('touchstart', function (e) {
        if (!e.touches || e.touches.length > 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dx = 0; dy = 0; touching = true;
      }, { passive: true });

      viewport.addEventListener('touchmove', function (e) {
        if (!touching || !e.touches || e.touches.length > 1) return;
        dx = e.touches[0].clientX - startX;
        dy = e.touches[0].clientY - startY;
      }, { passive: true });

      viewport.addEventListener('touchend', function () {
        if (!touching) return;
        touching = false;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
          const cards = carousel.querySelectorAll('.card');
          const visibleCount = getVisibleCount();
          const maxPosition = Math.max(0, cards.length - visibleCount);
          let position = Number(carousel.dataset.position) || 0;
          if (dx < 0) {
            position = position + 1;
            if (position > maxPosition) position = 0;
          } else {
            position = position - 1;
            if (position < 0) position = maxPosition;
          }
          updateCarousel(carousel, position);
        }
        dx = 0; dy = 0;
      }, { passive: true });

      // Mouse drag (desktop) - non-passive
      let mouseDown = false;
      let mStartX = 0, mDX = 0;

      viewport.addEventListener('mousedown', function (e) {
        mouseDown = true;
        mStartX = e.clientX;
        mDX = 0;
        viewport.classList.add('dragging');
        e.preventDefault && e.preventDefault();
      });

      window.addEventListener('mousemove', function (e) {
        if (!mouseDown) return;
        mDX = e.clientX - mStartX;
      });

      window.addEventListener('mouseup', function () {
        if (!mouseDown) return;
        mouseDown = false;
        viewport.classList.remove('dragging');
        if (Math.abs(mDX) > 40) {
          const cards = carousel.querySelectorAll('.card');
          const visibleCount = getVisibleCount();
          const maxPosition = Math.max(0, cards.length - visibleCount);
          let position = Number(carousel.dataset.position) || 0;
          if (mDX < 0) {
            position = position + 1;
            if (position > maxPosition) position = 0;
          } else {
            position = position - 1;
            if (position < 0) position = maxPosition;
          }
          updateCarousel(carousel, position);
        }
        mDX = 0;
      });
    });
  }

  function initCarousels() {
    document.querySelectorAll('.carousel').forEach(carousel => {
      if (typeof carousel.dataset.position === 'undefined') carousel.dataset.position = 0;
      updateCarousel(carousel, Number(carousel.dataset.position) || 0);
    });
    wireCarouselButtons();
    wireTouchAndDrag();
  }

  const debouncedReflow = debounce(() => {
    document.querySelectorAll('.carousel').forEach(carousel => {
      const pos = Number(carousel.dataset.position) || 0;
      updateCarousel(carousel, pos);
    });
  }, 100);

  function initAll() {
    try {
      initSidemenu();
      initCarousels();
      // Ensure carousels reflow after load (images)
      window.addEventListener('load', function () {
        setTimeout(initCarousels, 60);
      });
      window.addEventListener('resize', debouncedReflow);
    } catch (err) {
      console.error('Error initializing carousels/sidemenu:', err);
    }
  }

  // Expose manual init
  window.bhInitCarousels = function () {
    initCarousels();
  };

  // Run immediately if DOM ready, or on DOMContentLoaded otherwise
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Observe React mounting nodes and re-init when carousels or buttons are added
  const observer = new MutationObserver(debounce((mutations) => {
    let found = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches && (node.matches('.carousel') || node.matches('.carousel-btn') || node.matches('.carousel-controls') || node.matches('.carousel-viewport'))) { found = true; break; }
        if (node.querySelector && (node.querySelector('.carousel') || node.querySelector('.carousel-btn') || node.querySelector('.carousel-controls') || node.querySelector('.carousel-viewport'))) { found = true; break; }
      }
      if (found) break;
    }
    if (found) {
      setTimeout(initCarousels, 40);
    }
  }, 120));

  const observeTarget = document.getElementById('root') || document.body;
  if (observeTarget) {
    observer.observe(observeTarget, { childList: true, subtree: true });
  }
})();