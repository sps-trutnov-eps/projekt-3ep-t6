const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

router.get('/singleplayer', gameController.getSingleplayer);
router.post('/singleplayer/new', gameController.newSingleplayerGame);

module.exports = router;