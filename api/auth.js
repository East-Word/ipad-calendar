export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code, action } = req.query;
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.REDIRECT_URI;

  if (action === 'url') {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}` +
      `&access_type=offline` +
      `&prompt=consent`;
    return res.json({ url: authUrl });
  }

  if (action === 'token' && code) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const data = await response.json();
      if (data.access_token) {
        const params = new URLSearchParams({
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
          expires_in: data.expires_in || 3600,
        });
        return res.redirect(302, `/?${params.toString()}`);
      }
      return res.status(400).json({ error: 'Token exchange failed', detail: data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (action === 'refresh') {
    try {
      const body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => raw += chunk);
        req.on('end', () => resolve(JSON.parse(raw || '{}')));
      });
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: body.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const data = await response.json();
      return res.json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: 'Invalid request' });
}
