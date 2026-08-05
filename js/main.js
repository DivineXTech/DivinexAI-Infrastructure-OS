(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal sections as they enter the viewport. Reduced motion still
  // fades content in via CSS; JS just triggers the class either way.
  const revealTargets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealTargets.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealTargets.forEach((el) => observer.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  // Nav gains a stronger material once the page has scrolled past the hero.
  const nav = document.getElementById('nav');
  if (nav) {
    const setScrolledState = () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > 8);
    };
    setScrolledState();
    window.addEventListener('scroll', setScrolledState, { passive: true });
  }

  // Count up stat numbers once visible. Skipped under reduced motion —
  // the final value is shown immediately instead of animating toward it.
  const statNodes = document.querySelectorAll('.stat__num[data-count]');
  if (statNodes.length) {
    const animateCount = (el) => {
      const target = parseFloat(el.dataset.count);
      const isDecimal = el.dataset.count.includes('.');

      if (reduceMotion) {
        el.textContent = el.dataset.count;
        return;
      }

      const duration = 1200;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        // ease-out cubic — decelerates into the target, spring-adjacent feel
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = target * eased;
        el.textContent = isDecimal ? value.toFixed(2) : Math.round(value).toString();
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      const statObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              statObserver.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.6 }
      );
      statNodes.forEach((el) => statObserver.observe(el));
    } else {
      statNodes.forEach(animateCount);
    }
  }
})();
