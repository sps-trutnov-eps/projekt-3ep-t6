const gameModel = require('../models/hraModel');
const scoreEngine = require('../shared/scoreEngine');
const roller = require('../shared/diceRoller');

randomIntFromInterval = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

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
        const gameState = await gameModel.findById(req.session.gameId);
 
        if (gameState.status === 'FINISHED') {
            return res.status(400).json({ error: 'Game is already finished' });
        }
 
        // Generate a fresh seed and roll
        const seed = randomIntFromInterval(1, 10000);
        const roll = roller.rollDice(seed, gameState.dice_left);
        const pointsThisRoll = scoreEngine.checkCurrentScore(roll);
 
        // Bust — player loses all turn points, pass turn back to themselves (singleplayer)
        if (pointsThisRoll === 0) {
            const nextPlayerId = gameState.player1_id; // singleplayer: same player keeps the turn
            const updatedGame = await gameModel.bust(gameState.id, nextPlayerId, roll);
            return res.json({ success: true, bust: true, gameState: updatedGame });
        }
 
        // Bank check — has the player reached the winning score?
        const newTotalScore = gameState.p1_score + gameState.turn_score + pointsThisRoll;
        const WIN_SCORE = 10000;
 
        // Pass 0 as diceRemaining so the model's hot-dice logic resets to 6
        const updatedGame = await gameModel.updateTurn(gameState.id, pointsThisRoll, 0, roll);
 
        if (newTotalScore >= WIN_SCORE) {
            await gameModel.bankPoints(gameState.id, gameState.player1_id, gameState.player1_id);
            const finishedGame = await gameModel.finishGame(gameState.id, gameState.player1_id);
            return res.json({ success: true, bust: false, gameState: finishedGame });
        }
 
        res.json({ success: true, bust: false, gameState: updatedGame });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to throw dice' });
    }
};