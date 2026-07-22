const body = document.body;
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
const menuClosers = document.querySelectorAll('[data-menu-close], .drawer-nav a');
const languageButton = document.querySelector('[data-language]');
const filters = document.querySelectorAll('[data-filter]');
const projects = document.querySelectorAll('[data-category]');

function setMenu(open) {
  body.classList.toggle('menu-open', open);
  menuToggle?.setAttribute('aria-expanded', String(open));
  mobileMenu?.setAttribute('aria-hidden', String(!open));
}

menuToggle?.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
menuClosers.forEach((control) => control.addEventListener('click', () => setMenu(false)));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

languageButton?.addEventListener('click', () => {
  const isIndonesian = languageButton.getAttribute('aria-pressed') === 'true';
  languageButton.setAttribute('aria-pressed', String(!isIndonesian));
  languageButton.innerHTML = isIndonesian ? '◎&nbsp; <span>ID /</span> EN' : '◎&nbsp; ID <span>/ EN</span>';
});

filters.forEach((filter) => {
  filter.addEventListener('click', () => {
    const activeFilter = filter.dataset.filter;
    filters.forEach((button) => button.classList.toggle('is-active', button === filter));
    projects.forEach((project) => {
      project.hidden = activeFilter !== 'all' && project.dataset.category !== activeFilter;
    });
  });
});
