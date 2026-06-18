import crypto from 'crypto';

const SECRET = process.env.RL_SECRET || 'pixel-fighter-rl-secret';

/**
 * Express middleware to verify HMAC SHA-256 signature of request body.
 */
export function verifySignature(req, res, next) {
  // If no secret is set or if we want to bypass in local/test without signature,
  // we could. But to be secure, we enforce it.
  const signature = req.headers['x-rl-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing x-rl-signature header' });
  }

  try {
    // stringify the body exactly as it was received.
    // Note: express.json() parses body to object. Since it was parsed from JSON,
    // JSON.stringify(req.body) should match the client's payload.
    const bodyStr = JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(bodyStr)
      .digest('hex');

    if (signature !== expected) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
    next();
  } catch (err) {
    console.error('[verifySignature] Error:', err);
    return res.status(500).json({ error: 'Failed to verify signature' });
  }
}
