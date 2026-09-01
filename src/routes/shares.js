const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const shareService = require('../services/shareService');

const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const shares = await shareService.getUserShares(req.user.id);
  res.json({ shares });
}));

router.get('/:shareId', authenticate, asyncHandler(async (req, res) => {
  const share = await shareService.getShare(req.params.shareId, req.user.id);
  res.json({ share });
}));

router.put('/:shareId', authenticate, asyncHandler(async (req, res) => {
  const share = await shareService.updateShare(req.params.shareId, req.user.id, req.body || {});
  res.json({ share });
}));

router.delete('/:shareId', authenticate, asyncHandler(async (req, res) => {
  await shareService.revokeShare(req.params.shareId, req.user.id);
  res.json({ success: true });
}));

router.get('/:shareId/analytics', authenticate, asyncHandler(async (req, res) => {
  if (req.query.format === 'csv') {
    const csv = await shareService.exportShareAnalyticsCsv(req.params.shareId, req.user.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="share-${req.params.shareId}-analytics.csv"`);
    return res.send(csv);
  }

  const analytics = await shareService.getShareAnalytics(req.params.shareId, req.user.id);
  res.json({ analytics });
}));

router.get('/:shareId/comments', authenticate, asyncHandler(async (req, res) => {
  const comments = await shareService.getShareComments(req.params.shareId, req.user.id);
  res.json({ comments });
}));

router.put('/comments/:commentId/approve', authenticate, asyncHandler(async (req, res) => {
  const comment = await shareService.approveComment(req.params.commentId, req.user.id);
  res.json({ success: true, comment });
}));

router.put('/comments/:commentId/spam', authenticate, asyncHandler(async (req, res) => {
  const comment = await shareService.markCommentAsSpam(req.params.commentId, req.user.id);
  res.json({ success: true, comment });
}));

router.delete('/comments/:commentId', authenticate, asyncHandler(async (req, res) => {
  await shareService.deleteComment(req.params.commentId, req.user.id);
  res.json({ success: true });
}));

module.exports = router;
