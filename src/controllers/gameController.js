const gameModel   = require('../models/hraModel');
const scoreEngine = require('../shared/scoreEngine');
const roller      = require('../shared/diceRoller');

const randomIntFromInterval = (min, max) =>
    Math.floor(Math.random() * (max - min + 1) + min);

exports.getSingleplayer = (req, res) => {
    res.render('game/singleplayer', {
        title:   'Kostky s chudým starcem',
        message: 'Kostky s chudým starcem',
    });
};

exports.postNewSingleplayerGame = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const newGame = await gameModel.createSingleplayerGame(req.session.user.id);
        req.session.gameId = newGame.id;
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create game' });
    }
};

exports.getGameState = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });
    try {
        const gameState = await gameModel.findById(req.session.gameId);
        res.json(gameState);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get game state' });
    }
};

// Hodí kostkami — pouze uloží hod, nechá hráče vybrat
exports.postThrowDice = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });
    try {
        const gameState = await gameModel.findById(req.session.gameId);

        if (gameState.status === 'FINISHED')
            return res.status(400).json({ error: 'Game is already finished' });

        const seed = randomIntFromInterval(1, 10000);
        const roll = roller.rollDice(seed, gameState.dice_left);
        const pointsThisRoll = scoreEngine.checkCurrentScore(roll);

        if (pointsThisRoll === 0) {
            let updatedGame = await gameModel.bust(
                gameState.id, gameState.player1_id, roll
            );

            if (gameState.game_mode === 'SINGLEPLAYER') {
                updatedGame = await singleplayerNpcPoints(updatedGame);
            }

            return res.json({ success: true, bust: true, gameState: updatedGame });
        }

        // Jen uložíme hod — turn_score se mění až po potvrzení výběru
        const updatedGame = await gameModel.saveRoll(gameState.id, roll);
        res.json({ success: true, bust: false, gameState: updatedGame });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to throw dice' });
    }
};

// Hráč potvrdí výběr kostek — backend zvaliduje a přičte body
exports.postSelectDice = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });

    const { selectedDice } = req.body;

    if (!Array.isArray(selectedDice) || selectedDice.length === 0)
        return res.status(400).json({ error: 'Žádné kostky nevybrány' });

    try {
        const gameState = await gameModel.findById(req.session.gameId);

        if (gameState.status === 'FINISHED')
            return res.status(400).json({ error: 'Game is already finished' });

        // Ověř, že vybrané kostky jsou podmnožinou hozených
        const lastRoll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');

        const rollCopy = [...lastRoll];
        for (const die of selectedDice) {
            const idx = rollCopy.indexOf(die);
            if (idx === -1)
                return res.status(400).json({ error: 'Vybrané kostky neodpovídají hozeným' });
            rollCopy.splice(idx, 1);
        }

        // Ověř, že výběr přináší body
        const points = scoreEngine.checkCurrentScore(selectedDice);
        if (points === 0)
            return res.status(400).json({ error: 'Vybraná kombinace nemá žádné body' });

        const diceRemaining = gameState.dice_left - selectedDice.length;
        const nextDiceCount = diceRemaining === 0 ? 6 : diceRemaining; // Hot Dice

        const WIN_SCORE    = 10000;
        const newTurnScore = gameState.turn_score + points;
        const newTotal     = gameState.p1_score + newTurnScore;

        let updatedGame = await gameModel.updateTurn(
            gameState.id, points, nextDiceCount, lastRoll
        );

        if (newTotal >= WIN_SCORE) {
            await gameModel.bankPoints(gameState.id, gameState.player1_id, gameState.player1_id);
            const finishedGame = await gameModel.finishGame(gameState.id, gameState.player1_id);
            return res.json({ success: true, gameState: finishedGame });
        }

        res.json({ success: true, gameState: updatedGame });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to select dice' });
    }
};

// Bankovat — uloží turn_score, začne nové kolo
exports.postBankPoints = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });
    try {
        const gameState = await gameModel.findById(req.session.gameId);

        if (gameState.status === 'FINISHED')
            return res.status(400).json({ error: 'Game is already finished' });
        if (gameState.turn_score === 0)
            return res.status(400).json({ error: 'Nejsou žádné body k bankování' });

        const WIN_SCORE = 10000;
        const newTotal  = gameState.p1_score + gameState.turn_score;

        let updatedGame = await gameModel.bankPoints(
            gameState.id, gameState.player1_id, gameState.player1_id
        );

        if (newTotal >= WIN_SCORE) {
            const finishedGame = await gameModel.finishGame(gameState.id, gameState.player1_id);
            return res.json({ success: true, gameState: finishedGame });
        }

        if (gameState.game_mode === 'SINGLEPLAYER') {
            updatedGame = await singleplayerNpcPoints(updatedGame);
        }

        res.json({ success: true, gameState: updatedGame });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to bank points' });
    }
};

async function singleplayerNpcPoints(gameState) {
    if (gameState.game_mode !== 'SINGLEPLAYER') return gameState;

    // Chudý stařec hraje opatrně: hodí jednou a pokud má body, bankuje.
    const seed = randomIntFromInterval(1, 10000);
    const roll = roller.rollDice(seed, 6);
    const points = scoreEngine.checkCurrentScore(roll);
    
    let updatedGame = await gameModel.bankNpcPoints(gameState.id, points);
    
    if (updatedGame.p2_score >= 10000) {
        updatedGame = await gameModel.finishGame(updatedGame.id, null);
    }
    
    return updatedGame;
}

exports.getMultiplayer = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const game = await gameModel.findById(req.params.gameId);
        if (!game) return res.redirect('/matchmaking/lobby');

        // Jen hráči v téhle hře mají přístup
        const userId = req.session.user.id;
        if (game.player1_id !== userId && game.player2_id !== userId) {
            return res.redirect('/matchmaking/lobby');
        }

        res.render('game/multiplayer', {
            title: 'Multiplayer',
            gameId: game.id,
            userId,
        });
    } catch (err) {
        console.error('getMultiplayer error:', err);
        res.redirect('/matchmaking/lobby');
    }
};

exports.getMultiplayerState = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
        const game = await gameModel.findById(req.params.gameId);
        if (!game) return res.status(404).json({ error: 'Hra nenalezena' });
        res.json(game);
    } catch (err) {
        console.error('getMultiplayerState error:', err);
        res.status(500).json({ error: 'Chyba serveru' });
    }
};

exports.postMultiplayerRoll = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
        const game = await gameModel.findById(req.params.gameId);
        if (!game) return res.status(404).json({ error: 'Hra nenalezena' });
        if (game.status === 'FINISHED') return res.status(400).json({ error: 'Hra skončila' });
        if (game.current_turn_id !== req.session.user.id) return res.status(403).json({ error: 'Není tvůj tah' });

        const seed = Math.floor(Math.random() * 10000) + 1;
        const roll = roller.rollDice(seed, game.dice_left);
        const points = scoreEngine.checkCurrentScore(roll);

        if (points === 0) {
            const nextPlayer = game.player1_id === req.session.user.id ? game.player2_id : game.player1_id;
            const updated = await gameModel.bust(game.id, nextPlayer, roll);
            return res.json({ success: true, bust: true, gameState: updated });
        }

        const updated = await gameModel.saveRoll(game.id, roll);
        res.json({ success: true, bust: false, gameState: updated });
    } catch (err) {
        console.error('postMultiplayerRoll error:', err);
        res.status(500).json({ error: 'Chyba serveru' });
    }
};

exports.postMultiplayerSelect = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
        const { selectedDice } = req.body;
        if (!Array.isArray(selectedDice) || selectedDice.length === 0) {
            return res.status(400).json({ error: 'Žádné kostky nevybrány' });
        }

        const game = await gameModel.findById(req.params.gameId);
        if (!game) return res.status(404).json({ error: 'Hra nenalezena' });
        if (game.status === 'FINISHED') return res.status(400).json({ error: 'Hra skončila' });
        if (game.current_turn_id !== req.session.user.id) return res.status(403).json({ error: 'Není tvůj tah' });

        const lastRoll = Array.isArray(game.last_roll) ? game.last_roll : JSON.parse(game.last_roll ?? '[]');
        const rollCopy = [...lastRoll];
        for (const die of selectedDice) {
            const idx = rollCopy.indexOf(die);
            if (idx === -1) return res.status(400).json({ error: 'Vybrané kostky neodpovídají hozeným' });
            rollCopy.splice(idx, 1);
        }

        const points = scoreEngine.checkCurrentScore(selectedDice);
        if (points === 0) return res.status(400).json({ error: 'Vybraná kombinace nemá žádné body' });

        const diceRemaining = game.dice_left - selectedDice.length;
        const nextDiceCount = diceRemaining === 0 ? 6 : diceRemaining;
        const newTurnScore  = game.turn_score + points;
        const isPlayer1     = game.player1_id === req.session.user.id;
        const myScore       = isPlayer1 ? game.p1_score : game.p2_score;
        const newTotal      = myScore + newTurnScore;

        const WIN_SCORE = 10000;
        let updated = await gameModel.updateTurn(game.id, points, nextDiceCount, lastRoll);

        if (newTotal >= WIN_SCORE) {
            await gameModel.bankPoints(game.id, req.session.user.id, req.session.user.id);
            const finished = await gameModel.finishGame(game.id, req.session.user.id);
            return res.json({ success: true, gameState: finished });
        }

        res.json({ success: true, gameState: updated });
    } catch (err) {
        console.error('postMultiplayerSelect error:', err);
        res.status(500).json({ error: 'Chyba serveru' });
    }
};

exports.postMultiplayerBank = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
        const game = await gameModel.findById(req.params.gameId);
        if (!game) return res.status(404).json({ error: 'Hra nenalezena' });
        if (game.status === 'FINISHED') return res.status(400).json({ error: 'Hra skončila' });
        if (game.current_turn_id !== req.session.user.id) return res.status(403).json({ error: 'Není tvůj tah' });
        if (game.turn_score === 0) return res.status(400).json({ error: 'Nejsou žádné body k bankování' });

        const isPlayer1 = game.player1_id === req.session.user.id;
        const myScore   = isPlayer1 ? game.p1_score : game.p2_score;
        const newTotal  = myScore + game.turn_score;
        const nextPlayer = isPlayer1 ? game.player2_id : game.player1_id;

        const WIN_SCORE = 10000;
        let updated = await gameModel.bankPoints(game.id, req.session.user.id, nextPlayer);

        if (newTotal >= WIN_SCORE) {
            const finished = await gameModel.finishGame(game.id, req.session.user.id);
            return res.json({ success: true, gameState: finished });
        }

        res.json({ success: true, gameState: updated });
    } catch (err) {
        console.error('postMultiplayerBank error:', err);
        res.status(500).json({ error: 'Chyba serveru' });
    }
};