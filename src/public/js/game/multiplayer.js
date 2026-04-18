const GAME_ID   = document.getElementById('game-id').textContent.trim();
const MY_ID     = parseInt(document.getElementById('player-id').textContent.trim());

let gameState        = null;
let selectedDice     = [];
let pollInterval     = null;
let waitingForOther  = false;
let awaitingReroll   = false;  // true po confirmSelection, dokud nepřijde nový hod

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

    document.getElementById('player-score').textContent   = myScore;
    document.getElementById('opponent-score').textContent = oppScore;
    document.getElementById('target-score').textContent = g.target_score ?? 3000;
    document.getElementById('turn-score').textContent    = g.turn_score;
    document.getElementById('dice-left-count').textContent = g.dice_left;

    // Indikátor tahu
    const indicator = document.getElementById('turn-indicator');
    if (isMyTurn) {
        indicator.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8d8638" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="3"/>
                <circle cx="12" cy="12" r="1.5" fill="#8d8638"/>
            </svg>
            Jsi na tahu`;
        indicator.style.color = '#8d8638';
    } else {
        indicator.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a665d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            Čekám na soupeře…`;
        indicator.style.color = '#7a665d';
    }

    // Výsledek hry
    if (g.status === 'FINISHED') {
        const won = g.winner_id === MY_ID;
        document.getElementById('finished-text').innerHTML = won
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b4901e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            Vyhráli jste!`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7f3004" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Prohráli jste.`;

        document.getElementById('game-finished').style.display = 'block';
        document.getElementById('action-area').style.display   = 'none';
        document.getElementById('dice-area').innerHTML         = '';
        stopPolling();
        return;
    }

    // Přepnutí polling / aktivní UI
    if (!isMyTurn) {
        waitingForOther = true;
        startPolling();
        setButtonsWaiting();

        const lastRoll = Array.isArray(g.last_roll) ? g.last_roll : JSON.parse(g.last_roll ?? '[]');
        renderDicePassive(lastRoll);
        return;
    }

    // Je můj tah
    stopPolling();
    waitingForOther = false;

    const lastRoll = Array.isArray(g.last_roll) ? g.last_roll : JSON.parse(g.last_roll ?? '[]');

    if (lastRoll.length > 0 && !awaitingReroll) {
        // Hod proběhl — čeká se na výběr
        renderDiceActive(lastRoll);
        enterSelectPhase();
    } else if (awaitingReroll) {
        // Po confirmSelection — čekáme na další hod, UI řídí enterPostConfirmPhase
    } else {
        // Nové kolo — čeká se na hod
        renderDiceEmpty(g.dice_left);
        enterRollPhase();
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

function renderLockedDice(roll, selected, remaining) {
    const area = document.getElementById('dice-area');
    area.innerHTML = '';

    roll.forEach((val, idx) => {
        if (!selected.find(d => d.idx === idx)) return;
        const div = document.createElement('div');
        div.className = 'dice-die locked';
        div.appendChild(makeDiceFace(val));
        area.appendChild(div);
    });

    for (let i = 0; i < remaining; i++) {
        const div = document.createElement('div');
        div.className = 'dice-die empty';
        div.appendChild(makeDiceFace(0));
        area.appendChild(div);
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
    const valid  = vals.length > 0 ? isSelectionValid(vals) : false;
    const row    = document.getElementById('selection-score-row');
    const span   = document.getElementById('selection-score');

    if (vals.length > 0) {
        row.style.display  = 'flex';
        span.textContent   = points;
        span.style.color   = valid ? '#cf763b' : '#7f3004';
    } else {
        row.style.display = 'none';
    }

    const btnConfirm = document.getElementById('btn-confirm');
    if (btnConfirm) btnConfirm.disabled = !valid;
}

// score engine (mirror ze serveru)
function checkScore(dice) {
    let counts = [0,0,0,0,0,0];
    let score  = 0;
    for (const d of dice) counts[d - 1]++;

    if (counts.every(c => c >= 1))                { score += 1500; counts = [0,0,0,0,0,0]; }
    else if (counts.slice(1).every(c => c >= 1))  { score += 750;  for (let i=1;i<6;i++) counts[i]--; }
    else if (counts.slice(0,5).every(c => c >= 1)){ score += 500;  for (let i=0;i<5;i++) counts[i]--; }

    if (counts[0] >= 3) { score += 1000 * Math.pow(2, counts[0]-3); counts[0] = 0; }
    for (let i=1;i<6;i++) {
        if (counts[i] >= 3) { score += (i+1)*100 * Math.pow(2, counts[i]-3); counts[i] = 0; }
    }
    score += counts[0] * 100;
    score += counts[4] * 50;
    return score;
}

function isSelectionValid(chosenDice) {
    if (!chosenDice || chosenDice.length === 0) return false;
    let diceLeft = [0, 0, 0, 0, 0, 0];
    for (let die of chosenDice) diceLeft[die - 1]++;

    if (diceLeft.every(c => c >= 1)) return true;
    if (diceLeft.slice(1).every(c => c >= 1) && chosenDice.length === 5) return true;
    if (diceLeft.slice(0, 5).every(c => c >= 1) && chosenDice.length === 5) return true;

    for (let i = 0; i < 6; i++) {
        if (diceLeft[i] >= 3) diceLeft[i] = 0;
    }
    diceLeft[0] = 0;
    diceLeft[4] = 0;

    return diceLeft.every(c => c === 0);
}

// akce 
async function rollDice() {
    awaitingReroll = false;
    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/roll`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) return alert(data.error);

        gameState = data.gameState;

        if (data.bust) {
            const roll = Array.isArray(gameState.last_roll)
                ? gameState.last_roll
                : JSON.parse(gameState.last_roll ?? '[]');
            renderDicePassive(roll);
            showBust();
            enterRollPhase();   // tah přešel na soupeře — polling se spustí přes renderState
            renderState(gameState);
            return;
        }

        const roll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');

        renderDiceActive(roll);
        enterSelectPhase();
        hideBust();
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

        if (gameState.status === 'FINISHED') {
            renderState(gameState);
            return;
        }

        const remaining = gameState.dice_left;

        // Zobraz zamčené (vybrané) kostky + prázdné zbývající
        const lastRoll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');
        renderLockedDice(lastRoll, selectedDice, remaining);

        selectedDice = [];
        awaitingReroll = true;
        document.getElementById('selection-score-row').style.display = 'none';
        document.getElementById('turn-score').textContent = gameState.turn_score;

        enterPostConfirmPhase(remaining);

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

// UI helpers — fáze shodné se singleplayerem
function enterRollPhase() {
    document.getElementById('btn-roll').style.display    = 'inline-block';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
    document.getElementById('selection-score-row').style.display = 'none';
}

function enterSelectPhase() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'inline-block';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
    document.getElementById('btn-confirm').disabled      = true;
    document.getElementById('selection-score-row').style.display = 'flex';
    hideBust();
}

function enterPostConfirmPhase(diceLeft) {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'inline-block';
    document.getElementById('btn-bank').style.display    = 'inline-block';

    const d = diceLeft;
    document.getElementById('btn-reroll').textContent =
        `Hodit znovu (${d} ${d === 1 ? 'kostka' : d < 5 ? 'kostky' : 'kostek'})`;
}

function setButtonsWaiting() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
    document.getElementById('selection-score-row').style.display = 'none';
}

function showBust() {
    document.getElementById('bust-msg').style.display = 'flex';
}

function hideBust() {
    document.getElementById('bust-msg').style.display = 'none';
}