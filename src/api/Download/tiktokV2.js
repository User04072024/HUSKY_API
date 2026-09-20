async function tiktok(url) {
  const res = await fetch('https://lovetik.com/api/ajax/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'origin': 'https://lovetik.com',
      'referer': 'https://lovetik.com/id',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: `query=${encodeURIComponent(url)}`,
  });

  const data = await res.json();

  const isSlide = Array.isArray(data.images) && data.images.length > 0;
  const cleanText = str => str.replace(/<[^>]+>/g, '').replace(/[^\w\s]/g, '').trim();

  const audio = data.links.find(l => l.ft == 3 && l.a);
  const downloads = data.links
    .filter(l => l.ft != 3 && l.a)
    .map(l => ({
      quality: l.s.replace(/\[.*?\]/g, '').trim() || cleanText(l.t),
      url: l.a,
    }));

  return {
    type: isSlide ? 'slide' : 'video',
    desc: data.desc,
    author: {
      username: data.author,
      name: data.author_name,
      avatar: data.author_a,
    },
    cover: data.cover,
    ...(isSlide
      ? { images: data.images }
      : { downloads }),
    audio: audio ? audio.a : null,
  };
}

/**
 * EXAMPLE USAGE
 * Tested with both Video and Photo Slide URLs
 */

// Example: TikTok Video
tiktok('https://vt.tiktok.com/ZSmHysmoe/')
  .then(data => console.log('Video Data:', data))
  .catch(err => console.error('Error fetching video:', err));

// Example: TikTok Photo Slide
tiktok('https://vt.tiktok.com/ZSmHfbyTx/')
  .then(data => console.log('Slide Data:', data))
  .catch(err => console.error('Error fetching slide:', err));
