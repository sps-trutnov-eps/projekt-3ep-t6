const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// vrátí stránku pro singleplayer hru
router.get('/singleplayer', gameController.getSingleplayer); 
// vytvoří novou singleplayer hru a přesměruje na stránku s hrou
router.post('/singleplayer/new', gameController.postNewSingleplayerGame); 
// ajax endpoint pro získání stavu hry
router.get('/state', gameController.getGameState); 
// ajax endpoint pro hod kostkami
router.post('/roll', gameController.postThrowDice); 

router.post('/select', gameController.postSelectDice);
router.post('/bank', gameController.postBankPoints);

router.get('/multiplayer/:gameId', gameController.getMultiplayer);
router.get('/multiplayer/:gameId/state', gameController.getMultiplayerState);
router.post('/multiplayer/:gameId/roll', gameController.postMultiplayerRoll);
router.post('/multiplayer/:gameId/select', gameController.postMultiplayerSelect);
router.post('/multiplayer/:gameId/bank', gameController.postMultiplayerBank);

module.exports = router;