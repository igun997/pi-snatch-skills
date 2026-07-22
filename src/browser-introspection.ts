export const BROWSER_INTROSPECTION_SCRIPT = `(() => {
  const styleProperties = [
    'display', 'position', 'color', 'backgroundColor', 'fontFamily', 'fontSize',
    'fontWeight', 'lineHeight', 'letterSpacing', 'borderRadius', 'gap', 'opacity', 'transform', 'position', 'paddingTop',
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
  const safeIconName = (value) => {
    const normalized = value.trim().toLowerCase().replace(/[_\\s]+/g, '-');
    return /^[a-z0-9-]{1,80}$/.test(normalized) ? normalized : null;
  };
  const iconClass = (value) => /^(?:fa-(?:solid|regular|brands|light|thin|duotone|[a-z0-9-]+)|lucide(?:-[a-z0-9-]+)?|material-(?:icons|symbols(?:-[a-z0-9-]+)?)|heroicon-(?:outline|solid|mini|micro)-[a-z0-9-]+|bi(?:-[a-z0-9-]+)?|ti(?:-[a-z0-9-]+)?)$/.test(value);
  const iconCandidates = Array.from(document.querySelectorAll('i, svg, [data-lucide], .material-icons, [class*="fa-"], [class*="lucide"], [class*="heroicon"], [class*="bi-"], [class*="ti-"]'))
    .filter(visible)
    .slice(0, 200)
    .map((element) => {
      const dataLucide = safeIconName(element.getAttribute('data-lucide') ?? '');
      const dataIcon = safeIconName(element.getAttribute('data-icon') ?? '');
      const text = element.matches('.material-icons, [class*="material-symbols"]')
        ? safeIconName(element.textContent ?? '')
        : null;
      return {
        tag: element.tagName.toLowerCase(),
        classTokens: Array.from(element.classList).filter(iconClass).slice(0, 8),
        attributes: Object.fromEntries([
          ...(dataLucide ? [['data-lucide', dataLucide]] : []),
          ...(dataIcon ? [['data-icon', dataIcon]] : []),
          ...(text ? [['text', text]] : []),
        ]),
      };
    })
    .filter((candidate) => candidate.classTokens.length > 0 || Object.keys(candidate.attributes).length > 0 || candidate.tag === 'svg');
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
      iterations: timing?.iterations === Infinity ? 'infinite' : timing?.iterations ?? null,
    };
  });
  const videos = Array.from(document.querySelectorAll('video')).slice(0, 50).map((video) => ({
    currentTime: Number(video.currentTime.toFixed(3)),
    duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : null,
    paused: video.paused,
  }));
  return JSON.stringify({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    regions: elements,
    animations,
    icons: iconCandidates,
    videos,
    media: { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches },
  });
})()`;
