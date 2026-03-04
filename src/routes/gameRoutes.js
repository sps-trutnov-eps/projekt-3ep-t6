const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// vrátí stránku pro singleplayer hru
router.get('/singleplayer', gameController.getSingleplayer); 
// vytvoří novou singleplayer hru a přesměruje na stránku s hrou
router.post('/singleplayer/new', gameController.newSingleplayerGame); 
// ajax endpoint pro získání stavu hry
router.get('/state', gameController.getGameState); 

module.exports = router;