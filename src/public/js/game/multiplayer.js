const GAME_ID   = document.getElementById('game-id').textContent.trim();
const MY_ID     = parseInt(document.getElementById('player-id').textContent.trim());

let gameState       = null;
let selectedDice    = [];
let pollInterval    = null;
let waitingForOther = false;

// init 
document.addEventListener('DOMContentLoaded', async () => {
    await fetchState();
});

// polling (když čekáme na soupeře) 
function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
        await fetchState();
    }, 2500);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// fetch stavu hry 
async function fetchState() {
    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/state`);
        gameState  = await res.json();
        renderState(gameState);
    } catch (err) {
        console.error('fetchState error:', err);
    }
}

// render 
function renderState(g) {
    const isMyTurn  = g.current_turn_id === MY_ID;
    const isPlayer1 = g.player1_id === MY_ID;
    const myScore   = isPlayer1 ? g.p1_score : g.p2_score;
    const oppScore  = isPlayer1 ? g.p2_score : g.p1_score;

    document.getElementById('player-score').textContent  = myScore;
    document.getElementById('opponent-score').textContent = oppScore;
    document.getElementById('turn-score').textContent    = g.turn_score;
    document.getElementById('dice-left-count').textContent = g.dice_left;

    // Indikátor tahu
    const indicator = document.getElementById('turn-indicator');
    indicator.textContent = isMyTurn ? '🎲 Jsi na tahu' : '⏳ Čekám na soupeře…';
    indicator.style.color = isMyTurn ? '#8d8638' : '#7a665d';

    // Hra skončila
    if (g.status === 'FINISHED') {
        stopPolling();
        const won = g.winner_id === MY_ID;
        document.getElementById('finished-text').textContent = won ? '🏆 Vyhráli jste!' : '😞 Prohráli jste.';
        document.getElementById('game-finished').style.display = 'block';
        document.getElementById('action-area').style.display   = 'none';
        return;
    }

    // Přepnutí polling / aktivní UI
    if (!isMyTurn) {
        waitingForOther = true;
        startPolling();
        setButtonsWaiting();

        // Zobraz bust soupeře pokud padlo
        const lastRoll = Array.isArray(g.last_roll) ? g.last_roll : JSON.parse(g.last_roll ?? '[]');
        renderDicePassive(lastRoll);
        return;
    }

    // Je můj tah
    stopPolling();
waitingForOther = false;

const lastRoll = Array.isArray(g.last_roll) ? g.last_roll : JSON.parse(g.last_roll ?? '[]');

if (lastRoll.length > 0) {
    // Hod proběhl — čeká se na výběr
    renderDiceActive(lastRoll);
    showButtonsAfterRoll();
} else {
    // Nové kolo — čeká se na hod
    renderDiceEmpty(g.dice_left);
    showButtonsBeforeRoll(); 
}

    hideBust();
}

// dice rendering 
function renderDiceActive(roll) {
    selectedDice = [];
    const area   = document.getElementById('dice-area');
    area.innerHTML = '';
    roll.forEach((val, idx) => {
        const die = makeDie(val, idx, true);
        area.appendChild(die);
    });
    updateSelectionScore();
}

function renderDicePassive(roll) {
    const area = document.getElementById('dice-area');
    area.innerHTML = '';
    roll.forEach((val, idx) => {
        const die = makeDie(val, idx, false);
        area.appendChild(die);
    });
}

function renderDiceEmpty(count) {
    const area = document.getElementById('dice-area');
    area.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const die = document.createElement('div');
        die.className = 'dice-die empty';
        die.appendChild(makeDiceFace(0));
        area.appendChild(die);
    }
}

function makeDie(value, idx, clickable) {
    const die = document.createElement('div');
    die.className = 'dice-die';
    die.dataset.idx = idx;
    die.dataset.val = value;
    die.appendChild(makeDiceFace(value));
    if (clickable) {
        die.addEventListener('click', () => toggleDie(die));
    }
    return die;
}

function makeDiceFace(value) {
    // Stejná implementace jako v singleplayer.js
    const grid = document.createElement('div');
    grid.className = 'dice-face-grid';

    const positions = {
        1: [4],
        2: [2, 6],
        3: [2, 4, 6],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8],
    };

    const dots = positions[value] || [];
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'dot-cell';
        if (dots.includes(i)) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            cell.appendChild(dot);
        }
        grid.appendChild(cell);
    }
    return grid;
}

function toggleDie(die) {
    if (!gameState || gameState.current_turn_id !== MY_ID) return;
    const val = parseInt(die.dataset.val);
    const idx = parseInt(die.dataset.idx);

    if (die.classList.contains('selected')) {
        die.classList.remove('selected');
        const pos = selectedDice.findIndex(d => d.idx === idx);
        if (pos !== -1) selectedDice.splice(pos, 1);
    } else {
        die.classList.add('selected');
        selectedDice.push({ idx, val });
    }
    updateSelectionScore();
}

function updateSelectionScore() {
    const vals   = selectedDice.map(d => d.val);
    const points = vals.length > 0 ? checkScore(vals) : 0;
    const row    = document.getElementById('selection-score-row');
    const span   = document.getElementById('selection-score');

    if (vals.length > 0) {
        row.style.display  = 'flex';
        span.textContent   = points;
        span.style.color   = points > 0 ? '#cf763b' : '#7f3004';
    } else {
        row.style.display  = 'none';
    }

    const btnConfirm = document.getElementById('btn-confirm');
    if (btnConfirm) btnConfirm.disabled = points === 0 || vals.length === 0;
}

// score engine (mirror ze serveru) 
function checkScore(dice) {
    let counts = [0,0,0,0,0,0];
    let score  = 0;
    for (const d of dice) counts[d - 1]++;

    if (counts.every(c => c >= 1))                    { score += 1500; counts = [0,0,0,0,0,0]; }
    else if (counts.slice(1).every(c => c >= 1))       { score += 750;  for (let i=1;i<6;i++) counts[i]--; }
    else if (counts.slice(0,5).every(c => c >= 1))     { score += 500;  for (let i=0;i<5;i++) counts[i]--; }

    if (counts[0] >= 3) { score += 1000 * Math.pow(2, counts[0]-3); counts[0] = 0; }
    for (let i=1;i<6;i++) {
        if (counts[i] >= 3) { score += (i+1)*100 * Math.pow(2, counts[i]-3); counts[i] = 0; }
    }
    score += counts[0] * 100;
    score += counts[4] * 50;
    return score;
}

// akce 
async function rollDice() {
    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/roll`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) return alert(data.error);

        if (data.bust) {
            showBust();
            gameState = data.gameState;
            renderState(gameState);
            return;
        }

        gameState = data.gameState;
        const roll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');

        renderDiceActive(roll);
        showButtonsAfterRoll();
    } catch (err) {
        console.error('rollDice error:', err);
    }
}

async function confirmSelection() {
    if (selectedDice.length === 0) return;
    const vals = selectedDice.map(d => d.val);

    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/select`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedDice: vals }),
        });
        const data = await res.json();
        if (!data.success) return alert(data.error);

        gameState = data.gameState;
        renderState(gameState);
    } catch (err) {
        console.error('confirmSelection error:', err);
    }
}

async function rerollDice() {
    await rollDice();
}

async function bankPoints() {
    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/bank`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) return alert(data.error);

        gameState = data.gameState;
        renderState(gameState);
    } catch (err) {
        console.error('bankPoints error:', err);
    }
}

// UI helpers
function showButtonsBeforeRoll() {
    document.getElementById('btn-roll').style.display    = 'block';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
}

function showButtonsAfterRoll() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'block';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = gameState?.turn_score > 0 ? 'block' : 'none';
}

function setButtonsWaiting() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
}

function showBust() {
    document.getElementById('bust-msg').style.display = 'block';
}

function hideBust() {
    document.getElementById('bust-msg').style.display = 'none';
}