async function updateGameState() {
    const dataFromServer = await fetch('/game/state').then(res => res.json());

    const playerId = document.getElementById('player-id').textContent;
    const opponentName = 'Chudý starec';
    const playerScore = dataFromServer.p1_score;
    const opponentScore = dataFromServer.p2_score;
    const currentRoll = dataFromServer.turn_score > 0 ? JSON.parse(dataFromServer.last_roll) : [];
    const winnerId = dataFromServer.winner_id;

    document.getElementById('opponent-name').textContent = opponentName;
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('opponent-score').textContent = opponentScore;
    document.getElementById('current-roll').textContent = currentRoll.join(', ');

    if (dataFromServer.currentPlayerTurn == playerId) {
        document.getElementById('roll-dice').disabled = false;
    } else {
        document.getElementById('roll-dice').disabled = true;
    }

    if (winnerId !== null) {
        document.getElementById('game-finished').style.display = 'block';
    }
}

updateGameState();