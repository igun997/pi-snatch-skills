export const BROWSER_INTROSPECTION_SCRIPT = `(() => {
  const styleProperties = [
    'display', 'position', 'color', 'backgroundColor', 'fontFamily', 'fontSize',
    'fontWeight', 'lineHeight', 'letterSpacing', 'borderRadius', 'gap', 'paddingTop',
    'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom',
  ];
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const elements = Array.from(document.querySelectorAll('header, main, footer, [role], section, nav'))
    .filter(visible)
    .slice(0, 200)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        styles: Object.fromEntries(styleProperties.map((property) => [property, style[property]])),
      };
    });
  const animations = document.getAnimations().slice(0, 200).map((animation) => {
    const timing = animation.effect?.getTiming();
    const target = animation.effect?.target;
    return {
      target: target instanceof Element ? target.tagName.toLowerCase() : null,
      currentTime: animation.currentTime,
      playState: animation.playState,
      duration: timing?.duration ?? null,
      delay: timing?.delay ?? null,
      easing: timing?.easing ?? null,
      iterations: timing?.iterations ?? null,
    };
  });
  return JSON.stringify({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    regions: elements,
    animations,
    media: { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches },
  });
})()`;
