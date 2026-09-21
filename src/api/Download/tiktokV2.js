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
    id: data.id || null,
    region: data.region || null,
    title: data.title || '',
    description: data.content_desc || [],
    desc: data.title || '',
    author: data.author || {},
    cover: data.cover || null,
    covers: {
      standard: data.cover || null,
      dynamic: data.ai_dynamic_cover || null,
      original: data.origin_cover || null,
    },
    duration: data.duration || 0,
    sizes: {
      standard: data.size || 0,
      watermark: data.wm_size || 0,
      hd: data.hd_size || 0,
    },
    downloads: [
      data.hdplay && { quality: 'HD', url: data.hdplay },
      data.play && { quality: 'SD', url: data.play },
      data.wmplay && { quality: 'Watermark', url: data.wmplay },
    ].filter(Boolean),
    audio: data.music || null,
    music: data.music_info || null,
    statistics: {
      views: data.play_count || 0,
      likes: data.digg_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0,
      downloads: data.download_count || 0,
      collects: data.collect_count || 0,
    },
    createdAt: data.create_time || null,
    isAd: Boolean(data.is_ad),
    commerce: data.commerce_info || null,
    commercialVideo: data.commercial_video_info || null,
    commentSettings: data.item_comment_settings || null,
    mentionedUsers: data.mentioned_users || [],
    anchors: data.anchors || null,
    anchorsExtras: data.anchors_extras || null,
    flags: {
      isNffOrNr: Boolean(data.is_nff_or_nr),
    },
  };
}

const CREATOR = 'Husky API';
const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

async function tiktok(url) {
  try {
    return await fetchTikWm(url);
  } catch {
    // Lovetik remains a secondary provider if TikWM is unavailable.
  }

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
