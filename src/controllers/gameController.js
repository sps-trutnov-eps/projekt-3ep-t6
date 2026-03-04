const gameModel = require('../models/hraModel');

exports.getSingleplayer = (req, res) => {
    res.render('game/singleplayer', {
        title: 'Kostky s chudým starcem',
        message: 'Kostky s chudým starcem'
    });
}

exports.newSingleplayerGame = async (req, res) => {
    try {
        const newGame = await gameModel.createSingleplayerGame(req.session.userId);
        req.session.gameId = newGame.id;
        res.redirect('/game/singleplayer');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create game' });
    }
}

exports.getGameState = async (req, res) => {
    if (!req.session.gameId) {
        return res.status(400).json({ error: 'No active game' });
    }

    try {
        const gameState = await gameModel.findById(req.session.gameId);
        res.json(gameState);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get game state' });
    }
}