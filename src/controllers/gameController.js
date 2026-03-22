const gameModel = require('../models/hraModel');

exports.getSingleplayer = (req, res) => {
    res.render('game/singleplayer', {
        title: 'Kostky s chudým starcem',
        message: 'Kostky s chudým starcem'
    });
}

exports.postNewSingleplayerGame = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }

        const newGame = await gameModel.createSingleplayerGame(req.session.user.id);
        req.session.gameId = newGame.id;
        res.status(200).json({ success: true });
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

exports.postThrowDice = async (req, res) => {
    if (!req.session.gameId) {
        return res.status(400).json({ error: 'No active game' });
    }

    try {
        let gameState = await gameModel.findById(req.session.gameId);

        gameState.last_seed = randomIntFromInterval(1, 10000);

        await gameModel.updateGameAfterRoll(gameState);

        res.json({ success: true, gameState: gameState });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to throw dice' });
    }
};