document.addEventListener('DOMContentLoaded', () => {
  const title = document.querySelector('.glitch-title');
  if (!title) return;

  title.classList.add('glitch-active');

  const burst = () => {
    title.classList.add('glitch-burst');
    const duration = 180 + Math.random() * 260;
    setTimeout(() => title.classList.remove('glitch-burst'), duration);
  };

  burst();
  setInterval(() => {
    if (Math.random() > 0.35) burst();
  }, 900);
});
