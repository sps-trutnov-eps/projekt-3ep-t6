const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', friendController.getFriendsPage);
router.post('/request', friendController.sendFriendRequest);
router.post('/accept', friendController.acceptFriendRequest);
router.post('/remove', friendController.removeFriend);

module.exports = router;
