async function updateGameState(gameState) {
    const playerScore  = gameState.p1_score   ?? 0;
    const turnScore    = gameState.turn_score  ?? 0;
    const diceLeft     = gameState.dice_left   ?? 6;
    const opponentScore = gameState.p2_score   ?? 0;

    const lastRoll = Array.isArray(gameState.last_roll)
        ? gameState.last_roll
        : (gameState.last_roll ? JSON.parse(gameState.last_roll) : []);

    document.getElementById('player-score').textContent  = playerScore;
    document.getElementById('opponent-score').textContent = opponentScore;
    document.getElementById('opponent-name').textContent  = 'Chudý starec';
    document.getElementById('current-roll').textContent   = lastRoll.length ? lastRoll.join(', ') : 0;
    document.getElementById('turn-score').textContent     = turnScore;
    document.getElementById('dice').textContent           = diceLeft;

    const rollBtn = document.getElementById('roll-dice');
    rollBtn.disabled = gameState.status === 'FINISHED';

    if (gameState.status === 'FINISHED') {
        document.getElementById('game-finished').style.display = 'block';
    }
}

async function rollDice() {
    const rollBtn = document.getElementById('roll-dice');
    rollBtn.disabled = true;

    try {
        const res  = await fetch('/game/roll', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            alert('Chyba při házení kostkami: ' + data.error);
            rollBtn.disabled = false;
            return;
        }

        if (data.bust) {
            alert('Farkle! Přišel jsi o body v tomto kole.');
        }

        await updateGameState(data.gameState);
    } catch (err) {
        console.error(err);
        alert('Nepodařilo se spojit se serverem.');
        rollBtn.disabled = false;
    }
}

async function getGameState() {
    try {
        const res  = await fetch('/game/state');
        const data = await res.json();
        if (data.error) {
            console.warn('Stav hry:', data.error);
            return;
        }
        await updateGameState(data);
    } catch (err) {
        console.error('Nepodařilo se načíst stav hry:', err);
    }
}

getGameState();