const gameModel   = require('../models/hraModel');
const scoreEngine = require('../shared/scoreEngine');

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
            const updatedGame = await gameModel.bust(
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

        // Ověř, že výběr přináší body
        const points = scoreEngine.checkCurrentScore(selectedDice, true);
        if (points === 0)
            return res.status(400).json({ error: 'Vybraná kombinace nemá žádné body nebo obsahuje neplatné kostky' });

        const diceRemaining = gameState.dice_left - selectedDice.length;
        const nextDiceCount = diceRemaining === 0 ? 6 : diceRemaining; // Hot Dice

        const WIN_SCORE    = 10000;
        const newTurnScore = gameState.turn_score + points;
        const newTotal     = gameState.p1_score + newTurnScore;

        let updatedGame = await gameModel.updateTurn(
            gameState.id, points, nextDiceCount, []
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

        const updatedGame = await gameModel.bankPoints(
            gameState.id, gameState.player1_id, gameState.player1_id
        );

        if (newTotal >= WIN_SCORE) {
            const finishedGame = await gameModel.finishGame(gameState.id, gameState.player1_id);
            return res.json({ success: true, gameState: finishedGame });
        }

        res.json({ success: true, gameState: updatedGame });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to bank points' });
    }
};

exports.postNpcTurn = async (req, res) => {
    if (!req.session.gameId)
        return res.status(400).json({ error: 'No active game' });

    try {
        const gameState = await gameModel.findById(req.session.gameId);
        if (gameState.status === 'FINISHED')
            return res.status(400).json({ error: 'Game is already finished' });

        if (gameState.game_mode !== 'SINGLEPLAYER')
            return res.status(400).json({ error: 'Není to singleplayer hra' });

        // NPC turn logic: roll 6 dice, evaluate, and bank or bust immediately.
        const roll = [];
        for (let i = 0; i < 6; i++) roll.push(Math.floor(Math.random() * 6) + 1);

        // Strict = false for full roll evaluation to get any scoring subset
        const points = scoreEngine.checkCurrentScore(roll, false);

        let updatedGame;
        if (points === 0) {
            // Bust
            updatedGame = await gameModel.bust(gameState.id, gameState.player1_id, roll, gameState.last_seed);
            return res.json({ success: true, npcRoll: roll, npcBust: true, npcScore: 0, gameState: updatedGame });
        } else {
            const db = require('../db');
            const sql = `
                UPDATE games
                SET p2_score = p2_score + $2,
                    turn_score = 0,
                    dice_left = 6,
                    current_turn_id = $3,
                    last_roll = '[]'
                WHERE id = $1
                RETURNING *;
            `;
            const { rows } = await db.query(sql, [gameState.id, points, gameState.player1_id]);
            updatedGame = rows[0];

            if (updatedGame.p2_score >= 10000) {
                updatedGame = await gameModel.finishGame(updatedGame.id, null); // Winner is null or opponent
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

        // Client-authoritative: cheat just tells client to override next roll values
        // Generate a roll that meets the target score
        const count = gameState.dice_left;
        let bestRoll = null;
        let bestDiff = Infinity;

        for (let attempt = 0; attempt < 50000; attempt++) {
            const roll = [];
            for (let i = 0; i < count; i++) roll.push(Math.floor(Math.random() * 6) + 1);
            const score = scoreEngine.checkCurrentScore(roll, false);
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