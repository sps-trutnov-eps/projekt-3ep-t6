//  scoreEngine — kopie /shared/scoreEngine.js pro frontend
function checkCurrentScore(chosenDice) {
    let diceLeft = [0, 0, 0, 0, 0, 0];
    let score = 0;

    for (let die of chosenDice) {
        diceLeft[die - 1]++;
    }

    if (diceLeft.every(c => c >= 1)) {
        score += 1500;
        diceLeft = [0, 0, 0, 0, 0, 0];
    } else if (diceLeft.slice(1).every(c => c >= 1)) {
        score += 750;
        for (let i = 1; i < 6; i++) diceLeft[i]--;
    } else if (diceLeft.slice(0, 5).every(c => c >= 1)) {
        score += 500;
        for (let i = 0; i < 5; i++) diceLeft[i]--;
    }

    if (diceLeft[0] >= 3) {
        score += 1000 * Math.pow(2, diceLeft[0] - 3);
        diceLeft[0] = 0;
    }
    for (let i = 1; i < 6; i++) {
        if (diceLeft[i] >= 3) {
            score += (i + 1) * 100 * Math.pow(2, diceLeft[i] - 3);
            diceLeft[i] = 0;
        }
    }

    score += diceLeft[0] * 100;
    score += diceLeft[4] * 50;

    return score;
}

function isSelectionValid(chosenDice) {
    if (!chosenDice || chosenDice.length === 0) return false;
    let diceLeft = [0, 0, 0, 0, 0, 0];
    for (let die of chosenDice) diceLeft[die - 1]++;

    // 1. Postupky (odečteme je, pokud existují)
    if (diceLeft.every(c => c >= 1)) {
        for (let i = 0; i < 6; i++) diceLeft[i]--;
    } else if (diceLeft.slice(1).every(c => c >= 1)) {
        for (let i = 1; i < 6; i++) diceLeft[i]--;
    } else if (diceLeft.slice(0, 5).every(c => c >= 1)) {
        for (let i = 0; i < 5; i++) diceLeft[i]--;
    }

    for (let i = 0; i < 6; i++) {
        if (diceLeft[i] >= 3) diceLeft[i] = 0;
    }
    diceLeft[0] = 0;
    diceLeft[4] = 0;

    return diceLeft.every(c => c === 0);
}

//  Stav frontendu
let currentRoll     = [];
let selectedDice    = [];
let selectionLocked = false;

//  Renderování kostek
function getDiceFaceHTML(value) {
    const dotPositions = {
        1: [4],
        2: [2, 6],
        3: [2, 4, 6],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8],
    };
    const positions = dotPositions[value] || [];
    let dots = '';
    for (let i = 0; i < 9; i++) {
        dots += `<div class="dot-cell">${positions.includes(i) ? '<div class="dot"></div>' : ''}</div>`;
    }
    return `<div class="dice-face-grid">${dots}</div>`;
}

function renderDice(rollValues) {
    const area = document.getElementById('dice-area');
    area.innerHTML = '';
    rollValues.forEach((val, idx) => {
        const div = document.createElement('div');
        div.className = 'dice-die';
        div.dataset.index = idx;
        div.innerHTML = getDiceFaceHTML(val);
        div.addEventListener('click', () => {
            if (selectionLocked) return;
            toggleDie(idx);
        });
        area.appendChild(div);
    });
}

function toggleDie(idx) {
    selectedDice[idx] = !selectedDice[idx];
    const dice = document.querySelectorAll('.dice-die');
    dice[idx].classList.toggle('selected', selectedDice[idx]);
    updateSelectionScore();
}

function updateSelectionScore() {
    const chosen = currentRoll.filter((_, i) => selectedDice[i]);
    const score  = chosen.length > 0 ? checkCurrentScore(chosen) : 0;
    const valid  = chosen.length > 0 ? isSelectionValid(chosen) : false;
    
    document.getElementById('selection-score').textContent = score;
    document.getElementById('btn-confirm').disabled = !valid;

    // Vizuální zpětná vazba pro nevalidní výběr
    const span = document.getElementById('selection-score');
    span.style.color = valid ? '#cf763b' : '#7f3004';
}

//  Aktualizace stavu hry
function updateGameState(gameState) {
    document.getElementById('player-score').textContent    = gameState.p1_score   ?? 0;
    document.getElementById('opponent-score').textContent  = gameState.p2_score   ?? 0;
    document.getElementById('target-score').textContent    = gameState.target_score ?? 3000;
    document.getElementById('turn-score').textContent      = gameState.turn_score  ?? 0;
    document.getElementById('dice-left-count').textContent = gameState.dice_left   ?? 6;

    if (gameState.status === 'FINISHED') {
        showFinished(gameState);
    }
}

function showFinished(gameState) {
    const banner = document.querySelector('.finished-banner p');
    if (gameState.winner_id === null && gameState.p2_score >= gameState.target_score) {
        banner.textContent = '💀 Prohráli jste! Stařec byl lepší.';
    } else if (gameState.winner_id == document.getElementById('player-id').textContent) {
        banner.textContent = '🏆 Vyhráli jste! Gratulujeme!';
    }
    
    document.getElementById('game-finished').style.display = 'block';
    document.getElementById('action-area').style.display   = 'none';
    document.getElementById('dice-area').innerHTML = '';
}

//  Fáze hry
async function rollDice() {
    setButtonsDisabled(true);
    try {
        const res  = await fetch('/game/roll', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            alert('Chyba při házení: ' + (data.error ?? 'neznámá chyba'));
            setButtonsDisabled(false);
            return;
        }

        const gameState = data.gameState;
        updateGameState(gameState);

        currentRoll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');

        if (data.bust) {
            renderDice(currentRoll);
            showBustMessage();
            enterRollPhase();
            return;
        }

        if (gameState.status === 'FINISHED') {
            renderDice(currentRoll);
            return;
        }

        selectedDice    = new Array(currentRoll.length).fill(false);
        selectionLocked = false;
        renderDice(currentRoll);
        enterSelectPhase();

    } catch (err) {
        console.error(err);
        alert('Nepodařilo se spojit se serverem.');
        setButtonsDisabled(false);
    }
}

function enterSelectPhase() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'inline-block';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
    document.getElementById('btn-confirm').disabled      = true;
    document.getElementById('selection-score-row').style.display = 'flex';
    document.getElementById('bust-msg').style.display    = 'none';
}

async function confirmSelection() {
    const chosen     = currentRoll.filter((_, i) => selectedDice[i]);
    const localScore = checkCurrentScore(chosen);

    if (localScore === 0) {
        alert('Vybraná kombinace nemá žádné body!');
        return;
    }

    setButtonsDisabled(true);
    try {
        const res  = await fetch('/game/select', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ selectedDice: chosen }),
        });
        const data = await res.json();

        if (!data.success) {
            alert('Chyba: ' + (data.error ?? 'neznámá chyba'));
            setButtonsDisabled(false);
            return;
        }

        updateGameState(data.gameState);
        if (data.gameState.status === 'FINISHED') return;

        const notChosen = currentRoll.filter((_, i) => !selectedDice[i]);
        selectionLocked = true;
        renderLockedDice(currentRoll, selectedDice, notChosen);
        enterPostConfirmPhase(data.gameState.dice_left);

    } catch (err) {
        console.error(err);
        alert('Nepodařilo se spojit se serverem.');
        setButtonsDisabled(false);
    }
}

function renderLockedDice(roll, selected, remaining) {
    const area = document.getElementById('dice-area');
    area.innerHTML = '';

    roll.forEach((val, idx) => {
        if (!selected[idx]) return;
        const div = document.createElement('div');
        div.className = 'dice-die locked';
        div.innerHTML = getDiceFaceHTML(val);
        area.appendChild(div);
    });

    remaining.forEach(() => {
        const div = document.createElement('div');
        div.className = 'dice-die empty';
        div.innerHTML = '<div class="dice-face-grid"></div>';
        area.appendChild(div);
    });
}

function enterPostConfirmPhase(diceLeft) {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'inline-block';
    document.getElementById('btn-bank').style.display    = 'inline-block';

    const d = diceLeft;
    document.getElementById('btn-reroll').textContent =
        `Hodit znovu (${d} ${d === 1 ? 'kostka' : d < 5 ? 'kostky' : 'kostek'})`;

    setButtonsDisabled(false);
}

async function rerollDice() {
    selectionLocked = false;
    document.getElementById('btn-reroll').style.display = 'none';
    document.getElementById('btn-bank').style.display   = 'none';
    await rollDice();
}

async function bankPoints() {
    setButtonsDisabled(true);
    try {
        const res  = await fetch('/game/bank', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            alert('Chyba při bankování: ' + (data.error ?? 'neznámá chyba'));
            setButtonsDisabled(false);
            return;
        }

        updateGameState(data.gameState);
        if (data.gameState.status === 'FINISHED') return;

        document.getElementById('dice-area').innerHTML = '';
        document.getElementById('selection-score').textContent = 0;
        document.getElementById('selection-score-row').style.display = 'none';
        enterRollPhase();

    } catch (err) {
        console.error(err);
        alert('Nepodařilo se spojit se serverem.');
        setButtonsDisabled(false);
    }
}

function enterRollPhase() {
    document.getElementById('btn-roll').style.display    = 'inline-block';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
    setButtonsDisabled(false);
}

function showBustMessage() {
    document.getElementById('bust-msg').style.display            = 'block';
    document.getElementById('selection-score-row').style.display = 'none';
    document.getElementById('selection-score').textContent       = 0;
}

function setButtonsDisabled(state) {
    ['btn-roll', 'btn-confirm', 'btn-reroll', 'btn-bank'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = state;
    });
}

async function getGameState() {
    try {
        const res  = await fetch('/game/state');
        const data = await res.json();
        if (data.error) { console.warn('Stav hry:', data.error); return; }
        updateGameState(data);
    }
    catch (err) {
        console.error('Nepodařilo se načíst stav hry:', err);
    }
}

getGameState();

async function startNewSingleplayerGame(event) {
    event.preventDefault(); // Prevent default form submission

    // Make sure we get the target score from the UI if it's there, otherwise default
    const targetScoreElement = document.getElementById('target-score');
    const targetScore = targetScoreElement ? targetScoreElement.textContent : '3000';
    
    try {
        const res = await fetch('/game/singleplayer/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetScore })
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = '/game/singleplayer'; // Redirect to start a new game
        } else {
            alert('Nepodařilo se vytvořit novou hru: ' + (data.error || 'Neznámá chyba'));
        }
    } catch (err) {
        console.error('Error starting new singleplayer game:', err);
        alert('Chyba spojení se serverem při pokusu o novou hru.');
    }
}
