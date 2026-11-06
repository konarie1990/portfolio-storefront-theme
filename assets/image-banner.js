(() => {
  const DEFAULT_SCROLL_DISTANCE = 400;
  const DEFAULT_HEADER_OFFSET = 106;
  const STICKY_MAX_SCALE = 1.25;
  const FALLBACK_MAX_SCALE = 1.15;
  let ticking = false;

  const updateScrollZoom = () => {
    // 1. Sticky scroll zoom wrappers (.sticky-zoom-wrapper)
    const stickyWrappers = document.querySelectorAll('.sticky-zoom-wrapper');
    stickyWrappers.forEach((wrapper) => {
      const parsedDistance = parseFloat(wrapper.dataset.scrollDistance);
      const scrollDistance = Number.isFinite(parsedDistance) && parsedDistance > 0
        ? parsedDistance
        : DEFAULT_SCROLL_DISTANCE;

      const parsedOffset = parseFloat(wrapper.dataset.headerOffset);
      const offset = Number.isFinite(parsedOffset)
        ? parsedOffset
        : DEFAULT_HEADER_OFFSET;

      const wrapperRect = wrapper.getBoundingClientRect();
      const distanceScrolled = offset - wrapperRect.top;
      const progress = Math.max(0, Math.min(1, distanceScrolled / scrollDistance));
      const scale = 1 + progress * (STICKY_MAX_SCALE - 1);

      const images = wrapper.querySelectorAll('.banner__media img');
      images.forEach((img) => {
        img.style.transform = `scale(${scale})`;
      });
    });

    // 2. Non-sticky scroll zoom fallback ([data-scroll-zoom] outside .sticky-zoom-wrapper)
    const scrollY = Math.max(window.scrollY || window.pageYOffset || 0, 0);
    const fallbackProgress = Math.min(scrollY / DEFAULT_SCROLL_DISTANCE, 1);
    const fallbackScale = 1 + fallbackProgress * (FALLBACK_MAX_SCALE - 1);

    const standaloneZoomImages = document.querySelectorAll(
      '.banner:not(.sticky-zoom-wrapper .banner) [data-scroll-zoom] img'
    );
    standaloneZoomImages.forEach((img) => {
      img.style.transform = `scale(${fallbackScale})`;
    });

    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollZoom);
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateScrollZoom);
  } else {
    updateScrollZoom();
  }

  document.addEventListener('shopify:section:load', updateScrollZoom);
})();
