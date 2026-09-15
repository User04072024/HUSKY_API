document.addEventListener('DOMContentLoaded', () => {
  const cat = document.querySelector('.docs-cat-photo-wrap');
  if (!cat) return;

  const leftPupil = cat.querySelector('#pupilLeft');
  const rightPupil = cat.querySelector('#pupilRight');
  const leftHighlight = cat.querySelector('#highlightLeft');
  const rightHighlight = cat.querySelector('#highlightRight');
  if (!leftPupil || !rightPupil) return;

  const resetEyes = () => {
    leftPupil.style.transform = '';
    rightPupil.style.transform = '';
    if (leftHighlight) leftHighlight.style.transform = '';
    if (rightHighlight) rightHighlight.style.transform = '';
  };

  const track = (clientX, clientY) => {
    if (cat.classList.contains('is-sleeping')) return;

    const rect = cat.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width * 0.5)) / (rect.width * 0.5)));
    const y = Math.max(-1, Math.min(1, (clientY - (rect.top + rect.height * 0.45)) / (rect.height * 0.55)));
    const pupilX = (x * 2.2).toFixed(2);
    const pupilY = (y * 1.7).toFixed(2);
    const highlightX = (x * 0.8).toFixed(2);
    const highlightY = (y * 0.6).toFixed(2);

    leftPupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
    rightPupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
    if (leftHighlight) leftHighlight.style.transform = `translate(${highlightX}px, ${highlightY}px)`;
    if (rightHighlight) rightHighlight.style.transform = `translate(${highlightX}px, ${highlightY}px)`;

    const near = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2)) < 145;
    cat.classList.toggle('is-near', near);
    cat.classList.toggle('is-awake', !near);
  };

  cat.classList.add('is-awake');
  document.addEventListener('pointermove', (event) => track(event.clientX, event.clientY), { passive: true });
  document.addEventListener('touchmove', (event) => {
    const touch = event.touches && event.touches[0];
    if (touch) track(touch.clientX, touch.clientY);
  }, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (cat.contains(event.target)) {
      cat.classList.toggle('is-sleeping');
      if (cat.classList.contains('is-sleeping')) resetEyes();
    }
  });
});
