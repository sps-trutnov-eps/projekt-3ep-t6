const gameModel   = require('../models/hraModel');
const roomModel   = require('../models/roomModel');
const userModel   = require('../models/userModel');
const scoreEngine = require('../shared/scoreEngine');

exports.getSingleplayer = (req, res) => {
    res.render('game/singleplayer', {
        title:   'Kostky s chudým starcem',
        message: 'Kostky s chudým starcem',
    });
};

exports.postNewSingleplayerGame = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
        const { targetScore } = req.body;
        const score = targetScore ? parseInt(targetScore) : 3000;
        const newGame = await gameModel.createSingleplayerGame(req.session.user.id, score);
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

        const lastRoll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');
        if (lastRoll.length > 0) {
            return res.status(400).json({ error: 'Nyní vybíráte kostky, nelze házet znovu!' });
        }

        // Client-authoritative: dice values come from client physics
        const { diceValues } = req.body;
        if (!Array.isArray(diceValues) || diceValues.length !== gameState.dice_left
            || !diceValues.every(v => Number.isInteger(v) && v >= 1 && v <= 6)) {
            return res.status(400).json({ error: 'Invalid dice values' });
        }

        const roll = diceValues;
        const pointsThisRoll = scoreEngine.checkCurrentScore(roll);

        if (pointsThisRoll === 0) {
            let updatedGame = await gameModel.bust(
                gameState.id, gameState.player1_id, roll, gameState.last_seed
            );
            return res.json({ success: true, bust: true, gameState: updatedGame, bustRoll: roll });
        }

        // Jen uložíme hod — turn_score se mění až po potvrzení výběru
        const updatedGame = await gameModel.saveRoll(gameState.id, roll, gameState.last_seed);
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

        // Ověř, že výběr přináší body a všechny vybrané kostky skórují
        if (!scoreEngine.isSelectionValid(selectedDice)) {
            return res.status(400).json({ error: 'Některé z vybraných kostek nepřispívají ke skóre!' });
        }

        const points = scoreEngine.checkCurrentScore(selectedDice);
        if (points === 0)
            return res.status(400).json({ error: 'Vybraná kombinace nemá žádné body nebo obsahuje neplatné kostky' });

        const diceRemaining = gameState.dice_left - selectedDice.length;
        const nextDiceCount = diceRemaining === 0 ? 6 : diceRemaining; // Hot Dice

        const WIN_SCORE    = gameState.target_score;
        const newTurnScore = gameState.turn_score + points;
        const newTotal     = gameState.p1_score + newTurnScore;

        let updatedGame = await gameModel.updateTurn(
            gameState.id, points, nextDiceCount, []
        );

        if (newTotal >= WIN_SCORE) {
            await gameModel.bankPoints(gameState.id, gameState.player1_id, gameState.player1_id);
            const finishedGame = await gameModel.finishGame(gameState.id, gameState.player1_id);
            
            // Statistika
            if (gameState.game_mode === 'SINGLEPLAYER') {
                await userModel.updateStats(gameState.player1_id, true);
            }
            
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

        const WIN_SCORE = gameState.target_score;
        const newTotal  = gameState.p1_score + gameState.turn_score;

        let updatedGame = await gameModel.bankPoints(
            gameState.id, gameState.player1_id, gameState.player1_id
        );

        if (newTotal >= WIN_SCORE) {
            const finishedGame = await gameModel.finishGame(gameState.id, gameState.player1_id);
            
            if (gameState.game_mode === 'SINGLEPLAYER') {
                await userModel.updateStats(gameState.player1_id, true);
            }

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

// Helper: generate random dice roll
function rollRandomDice(count) {
    const roll = [];
    for (let i = 0; i < count; i++) roll.push(Math.floor(Math.random() * 6) + 1);
    return roll;
}

// NPC auto-play after player banks or busts in singleplayer
async function singleplayerNpcPoints(gameState) {
    if (gameState.game_mode !== 'SINGLEPLAYER') return gameState;

    const roll = rollRandomDice(6);
    const points = scoreEngine.checkCurrentScore(roll);

    let updatedGame = await gameModel.bankNpcPoints(gameState.id, points);

    if (updatedGame.p2_score >= gameState.target_score) {
        updatedGame = await gameModel.finishGame(updatedGame.id, null);
        await userModel.updateStats(gameState.player1_id, false);
    }

    return updatedGame;
}

exports.postNpcTurn = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });

    try {
        const gameState = await gameModel.findById(req.session.gameId);
        if (gameState.status === 'FINISHED')
            return res.status(400).json({ error: 'Game is already finished' });

        if (gameState.game_mode !== 'SINGLEPLAYER')
            return res.status(400).json({ error: 'Není to singleplayer hra' });

        const roll = rollRandomDice(6);
        const points = scoreEngine.checkCurrentScore(roll);

        let updatedGame;
        if (points === 0) {
            updatedGame = await gameModel.bust(gameState.id, gameState.player1_id, roll, gameState.last_seed);
            return res.json({ success: true, npcRoll: roll, npcBust: true, npcScore: 0, gameState: updatedGame });
        } else {
            updatedGame = await gameModel.bankNpcPoints(gameState.id, points);

            if (updatedGame.p2_score >= gameState.target_score) {
                updatedGame = await gameModel.finishGame(updatedGame.id, null);
                await userModel.updateStats(gameState.player1_id, false);
            }

            return res.json({ success: true, npcRoll: roll, npcBust: false, npcScore: points, gameState: updatedGame });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to process NPC turn' });
    }
};

exports.postCheat = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });

    const targetScore = parseInt(req.body.targetScore) || 0;

    try {
        const gameState = await gameModel.findById(req.session.gameId);
        if (gameState.status === 'FINISHED')
            return res.status(400).json({ error: 'Game is already finished' });

        const count = gameState.dice_left;
        let bestRoll = null;
        let bestDiff = Infinity;

        for (let attempt = 0; attempt < 50000; attempt++) {
            const roll = rollRandomDice(count);
            const score = scoreEngine.checkCurrentScore(roll);
            if (score >= targetScore) {
                const diff = score - targetScore;
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestRoll = roll;
                    if (diff === 0) break;
                }
            }
        }

        if (bestRoll !== null) {
            return res.json({ success: true, cheatRoll: bestRoll, message: `Cheat activated! Roll will yield >= ${targetScore}` });
        } else {
            return res.status(400).json({ error: 'Could not find a matching roll for that score.' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Cheat failed' });
    }
};

// --- Multiplayer endpoints ---

const db = require('../db');

exports.getMultiplayer = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const game = await gameModel.findById(req.params.gameId);
        if (!game) return res.redirect('/matchmaking/lobby');

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

        const roll = rollRandomDice(game.dice_left);
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

        if (!scoreEngine.isSelectionValid(selectedDice)) {
            return res.status(400).json({ error: 'Některé z vybraných kostek nepřispívají ke skóre!' });
        }

        const points = scoreEngine.checkCurrentScore(selectedDice);
        if (points === 0) return res.status(400).json({ error: 'Vybraná kombinace nemá žádné body' });

        const diceRemaining = game.dice_left - selectedDice.length;
        const nextDiceCount = diceRemaining === 0 ? 6 : diceRemaining;
        const newTurnScore  = game.turn_score + points;
        const isPlayer1     = game.player1_id === req.session.user.id;
        const myScore       = isPlayer1 ? game.p1_score : game.p2_score;
        const newTotal      = myScore + newTurnScore;

        const WIN_SCORE = game.target_score;
        let updated = await gameModel.updateTurn(game.id, points, nextDiceCount, []);

        if (newTotal >= WIN_SCORE) {
            await gameModel.bankPoints(game.id, req.session.user.id, req.session.user.id);
            const finished = await gameModel.finishGame(game.id, req.session.user.id);

            await userModel.updateStats(req.session.user.id, true);
            const loserId = isPlayer1 ? game.player2_id : game.player1_id;
            await userModel.updateStats(loserId, false);

            const { rows } = await db.query('SELECT id FROM rooms WHERE game_id = $1', [game.id]);
            if (rows.length > 0) await roomModel.finish(rows[0].id);

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

        const WIN_SCORE = game.target_score;
        let updated = await gameModel.bankPoints(game.id, req.session.user.id, nextPlayer);

        if (newTotal >= WIN_SCORE) {
            const finished = await gameModel.finishGame(game.id, req.session.user.id);

            await userModel.updateStats(req.session.user.id, true);
            const loserId = isPlayer1 ? game.player2_id : game.player1_id;
            await userModel.updateStats(loserId, false);

            const { rows } = await db.query('SELECT id FROM rooms WHERE game_id = $1', [game.id]);
            if (rows.length > 0) await roomModel.finish(rows[0].id);

            return res.json({ success: true, gameState: finished });
        }

        res.json({ success: true, gameState: updated });
    } catch (err) {
        console.error('postMultiplayerBank error:', err);
        res.status(500).json({ error: 'Chyba serveru' });
    }
};