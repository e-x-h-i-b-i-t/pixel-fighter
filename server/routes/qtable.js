import express from 'express';
import {
  loadQTable,
  validateQTableDelta,
  mergeContribution
} from '../storage/qtableStore.js';
import { verifySignature } from '../middleware/verifySignature.js';

export const router = express.Router();

// ── GET /api/ai/qtable ────────────────────────────────────────────────────────
// Returns the global Q-table for clients to seed their local agent before a match.
// Global agent always uses minimum exploration (exploit what we know).
router.get('/qtable', async (_req, res) => {
  try {
    const data = await loadQTable();
    res.json({
      qTable:          data.qTable,
      totalMatchCount: data.totalMatchCount,
      // Server-side epsilon is fixed at minimum — exploitation mode
      epsilon:         0.05
    });
  } catch (err) {
    console.error('[API] GET /qtable error:', err);
    res.status(500).json({ error: 'Failed to load Q-table' });
  }
});

// ── POST /api/ai/contribute ────────────────────────────────────────────────────
// Players upload their local Q-table delta after a match.
// Body: { qTable: { stateKey: { action: number } }, matchCount: number }
router.post('/contribute', verifySignature, async (req, res) => {
  const { qTable, matchCount } = req.body;

  // Validate & sanitize the incoming delta
  const validation = validateQTableDelta(qTable);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const result = await mergeContribution(validation.sanitized, matchCount || 1);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] POST /contribute error:', err);
    res.status(500).json({ error: 'Failed to merge contribution' });
  }
});

// ── GET /api/ai/stats ─────────────────────────────────────────────────────────
// Global training statistics — useful for a leaderboard/debug panel.
router.get('/stats', async (_req, res) => {
  try {
    const data = await loadQTable();
    res.json({
      totalMatchCount:   data.totalMatchCount,
      totalContributors: data.totalContributors,
      statesKnown:       Object.keys(data.qTable).length,
      lastUpdated:       data.lastUpdated
    });
  } catch (err) {
    console.error('[API] GET /stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});
