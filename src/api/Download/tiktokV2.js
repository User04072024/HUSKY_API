async function fetchTikWm(url) {
  const params = new URLSearchParams({ url, hd: '1' });
  const response = await fetch('https://tikwm.com/api/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': 'Mozilla/5.0',
    },
    body: params,
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 0 || !payload.data) throw new Error(payload.msg || 'TikWM no devolvió datos');

  const data = payload.data;
  return {
    type: 'video',
    desc: data.title || '',
    author: data.author || {},
    cover: data.cover || null,
    downloads: [
      data.hdplay && { quality: 'HD', url: data.hdplay },
      data.play && { quality: 'SD', url: data.play },
      data.wmplay && { quality: 'Watermark', url: data.wmplay },
    ].filter(Boolean),
    audio: data.music || null,
  };
}

const CREATOR = 'Husky API';
const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

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

  const links = Array.isArray(data.links) ? data.links : [];
  if (!isSlide && !links.some(link => link.a)) return fetchTikWm(url);
  const audio = links.find(l => l.ft == 3 && l.a);
  const downloads = links
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

module.exports = function (app) {
  app.post('/download/tiktokV2', async (req, res) => {
    const url = req.body?.url || req.query.url;
    if (!url) return res.status(400).json({ status: false, creator: CREATOR, author: AUTHOR, error: 'Url is required' });

    try {
      const result = await tiktok(url);
      return res.json({ status: true, creator: CREATOR, author: AUTHOR, result });
    } catch (error) {
      return res.status(500).json({ status: false, creator: CREATOR, author: AUTHOR, error: error.message || 'Error al obtener TikTok' });
    }
  });

  app.post('/download/tiktokv2', async (req, res) => {
    const url = req.body?.url || req.query.url;
    if (!url) return res.status(400).json({ status: false, creator: CREATOR, author: AUTHOR, error: 'Url is required' });

    try {
      const result = await tiktok(url);
      return res.json({ status: true, creator: CREATOR, author: AUTHOR, result });
    } catch (error) {
      return res.status(500).json({ status: false, creator: CREATOR, author: AUTHOR, error: error.message || 'Error al obtener TikTok' });
    }
  });
};
