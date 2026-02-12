const express = require('express');
const router = express.Router();
const matchmakingController = require('../controllers/matchmakingController');

router.get('/', matchmakingController.getMatchmakingPage);
router.get('/lobby', matchmakingController.getLobbyPage);

module.exports = router;