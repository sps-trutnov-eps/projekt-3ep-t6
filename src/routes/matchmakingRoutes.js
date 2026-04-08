const express = require('express');
const router = express.Router();
const matchmakingController = require('../controllers/matchmakingController');

router.get('/', matchmakingController.getMatchmakingPage);
router.get('/lobby', matchmakingController.getLobbyPage);
router.post('/create', matchmakingController.createRoom);
router.patch('/room/visibility', matchmakingController.setVisibility);
router.get('/room/:code', matchmakingController.getRoomByCode);
router.post('/join/:code', matchmakingController.joinRoom);
router.post('/public', matchmakingController.findPublicRoom);
router.get('/friends', matchmakingController.getFriendsForInvite);
router.post('/invite', matchmakingController.sendInvite);

router.get('/room-status/:roomId', matchmakingController.getRoomStatus);
router.post('/start', matchmakingController.startGame);

module.exports = router;