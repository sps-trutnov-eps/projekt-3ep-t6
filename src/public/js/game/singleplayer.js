async function updateGameState(dataFromServer) {
    console.log(dataFromServer)

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

async function rollDice() {
    await fetch('/game/roll', { 
        method: 'POST' 
    })
    .then(res => res.json())
    .then(data => {
        if (data.success === true) {
            updateGameState(data.gameState);
        } else {
            alert('Chyba při házení kostkami: ' + data.error);
        }
    });
}

async function getGameState() {
    const dataFromServer = await fetch('/game/state').then(res => res.json());
    updateGameState(dataFromServer);
}

getGameState();