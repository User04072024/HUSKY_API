document.addEventListener('DOMContentLoaded', () => {
  const title = document.querySelector('.glitch-title');
  if (!title) return;

  title.classList.add('glitch-active');

  const burst = () => {
    title.classList.add('glitch-burst');
    const duration = 220 + Math.random() * 380;
    setTimeout(() => title.classList.remove('glitch-burst'), duration);
  };

  burst();

  setInterval(() => {
    burst();
  }, 850);
});
