const GAME_ID   = document.getElementById('game-id').textContent.trim();
const MY_ID     = parseInt(document.getElementById('player-id').textContent.trim());

let gameState       = null;
let selectedDice    = [];   // { idx, val, mappedTo }
let pollInterval    = null;
let waitingForOther = false;
let currentRoll     = [];   // raw roll from server (may contain 0 for wild)
let wildPickerCallback = null; // callback when wild value is chosen

// init — wait for renderer module to be ready
document.addEventListener('DOMContentLoaded', async () => {
    setupWildPicker();
    // Renderer loads as a module; wait until it's available
    while (!window.diceRenderer) await new Promise(r => setTimeout(r, 50));
    await fetchState();
});

// --- Wild picker (inline 1-6 bar) ---
function setupWildPicker() {
    const picker = document.getElementById('wild-picker');
    picker.querySelectorAll('.wild-pick-btn').forEach(btn => {
        btn.onclick = () => {
            const val = parseInt(btn.dataset.val);
            hideWildPicker();
            if (wildPickerCallback) wildPickerCallback(val);
            wildPickerCallback = null;
        };
    });
    document.getElementById('wild-pick-cancel').onclick = () => {
        hideWildPicker();
        wildPickerCallback = null;
    };
}

function showWildPicker(callback) {
    wildPickerCallback = callback;
    document.getElementById('wild-picker').classList.add('visible');
}

function hideWildPicker() {
    document.getElementById('wild-picker').classList.remove('visible');
}

// --- Polling ---
function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
        await fetchState();
    }, 1000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// --- Fetch state ---
async function fetchState() {
    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/state`);
        gameState  = await res.json();
        renderState(gameState);
    } catch (err) {
        console.error('fetchState error:', err);
    }
}

// --- Render state ---
function renderState(g) {
    const isMyTurn  = g.current_turn_id === MY_ID;
    const isPlayer1 = g.player1_id === MY_ID;
    const myScore   = isPlayer1 ? g.p1_score : g.p2_score;
    const oppScore  = isPlayer1 ? g.p2_score : g.p1_score;

    if (window.previousOpponentScore !== undefined && window.previousOpponentScore !== null && oppScore > window.previousOpponentScore) {
        const diff = oppScore - window.previousOpponentScore;
        const flashWrap = document.getElementById('enemy-turn-score-flash');
        const flashVal = document.getElementById('enemy-turn-score-value');
        if (flashWrap && flashVal) {
            flashVal.textContent = diff;
            flashWrap.style.opacity = '1';
            setTimeout(() => {
                flashWrap.style.opacity = '0';
            }, 2000);
        }
    }
    window.previousOpponentScore = oppScore;

    const oppName = isPlayer1 ? g.p2_username : g.p1_username;
    document.getElementById('opponent-name').textContent = oppName || '...';

    document.getElementById('player-score').textContent  = myScore;
    document.getElementById('opponent-score').textContent = oppScore;
    document.getElementById('target-score').textContent = g.target_score ?? 3000;
    document.getElementById('turn-score').textContent    = g.turn_score;

    // Turn indicator
    const indicator = document.getElementById('turn-indicator');
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.gap = '0.4rem';
    
    if (isMyTurn) {
        indicator.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="3"/>
                <circle cx="12" cy="12" r="1.5" fill="#f0c040"/>
            </svg>
            Jsi na tahu`;
        indicator.style.color = '#f0c040';
    } else {
        indicator.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            Cekam na soupere...`;
        indicator.style.color = '#ccc';
    }

    // Game finished
    if (g.status === 'FINISHED') {
        stopPolling();
        const won = g.winner_id === MY_ID;
        document.getElementById('finished-text').innerHTML = won
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b4901e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            Vyhrali jste!`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7f3004" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Prohrali jste.`;
        document.getElementById('game-finished').style.display = 'block';
        document.querySelector('.game-layout').style.display = 'none';
        if (window.diceRenderer) window.diceRenderer.hideLabels();
        return;
    }

    // Opponent's turn — poll
    if (!isMyTurn) {
        waitingForOther = true;
        startPolling();
        setButtonsWaiting();
        if (window.diceRenderer) window.diceRenderer.hideLabels();
        return;
    }

    // My turn
    stopPolling();
    waitingForOther = false;

    const lastRoll = Array.isArray(g.last_roll) ? g.last_roll : JSON.parse(g.last_roll ?? '[]');

    if (lastRoll.length > 0) {
        // Roll happened — waiting for selection
        showDiceForSelection(lastRoll);
        showButtonsAfterRoll();
        hideBust();
    } else {
        if (window.diceRenderer) window.diceRenderer.hideLabels();
        if (g.turn_score > 0) {
            showButtonsMiddleOfTurn();
        } else {
            showButtonsBeforeRoll();
            hideBust();
        }
    }
}

// --- 3D dice display ---

function showDiceForSelection(roll) {
    currentRoll = roll;
    selectedDice = [];
    hideWildPicker();

    if (!window.diceRenderer) return;

    // Start 3D animation — dice land on server values
    window.diceRenderer.rollToValues(roll, 'near');

    // Show values on labels (wild=0 shows as "?" via renderer)
    const displayValues = roll.map(v => v === 0 ? '?' : v);

    // Wait for dice to settle before enabling selection
    window.diceRenderer.onSettle(() => {
        window.diceRenderer.showValues(displayValues);
        setupSelectionHandler();
    });

    updateSelectionScore();
}

function setupSelectionHandler() {
    window.diceRenderer.onSelect((clickedIdx, allSelected) => {
        if (!gameState || gameState.current_turn_id !== MY_ID) return;

        const val = currentRoll[clickedIdx];

        // Check if deselecting
        const existingIdx = selectedDice.findIndex(d => d.idx === clickedIdx);
        if (existingIdx !== -1) {
            // Deselecting
            selectedDice.splice(existingIdx, 1);
            updateSelectionScore();
            return;
        }

        // Selecting
        if (val === 0) {
            // Wild die — show inline picker
            showWildPicker((choice) => {
                selectedDice.push({ idx: clickedIdx, val: 0, mappedTo: choice });
                // Update label to show chosen value
                const label = document.querySelector(`.dice-label[data-index="${clickedIdx}"] .dice-value`);
                if (label) label.textContent = choice;
                updateSelectionScore();
            });
        } else {
            selectedDice.push({ idx: clickedIdx, val, mappedTo: val });
            updateSelectionScore();
        }
    });

    updateSelectionScore();
}

function animateRoll(roll, onDone) {
    if (!window.diceRenderer) {
        if (onDone) onDone();
        return;
    }

    window.diceRenderer.rollToValues(roll, 'near');
    window.diceRenderer.onSettle(() => {
        if (onDone) onDone();
    });
}

// --- Selection score ---
function updateSelectionScore() {
    const effectiveVals = selectedDice.map(d => d.mappedTo);
    const points = effectiveVals.length > 0 ? checkScore(effectiveVals) : 0;
    const valid  = effectiveVals.length > 0 ? isSelectionValid(effectiveVals) : false;
    const row    = document.getElementById('selection-score-row');
    const span   = document.getElementById('selection-score');

    if (effectiveVals.length > 0) {
        row.style.display  = 'inline';
        span.textContent   = points;
        span.style.color   = valid ? '#cf763b' : '#7f3004';
    } else {
        row.style.display  = 'none';
    }

    const btnConfirm = document.getElementById('btn-confirm');
    if (btnConfirm) btnConfirm.disabled = !valid;
}

// --- Score engine (mirror from server) ---
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

function isSelectionValid(chosenDice) {
    if (!chosenDice || chosenDice.length === 0) return false;
    let diceLeft = [0, 0, 0, 0, 0, 0];
    for (let die of chosenDice) diceLeft[die - 1]++;

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

// --- Actions ---
async function rollDice(useWild = false) {
    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ useWild })
        });
        const data = await res.json();
        if (!data.success) return alert(data.error);

        gameState = data.gameState;

        if (data.bust) {
            // Bust roll is in data.roll (not in gameState.last_roll which is cleared)
            const bustRoll = data.roll || [];
            animateRoll(bustRoll, () => {
                showBust();
                setTimeout(() => {
                    renderState(gameState);
                }, 1500);
            });
            return;
        }

        const roll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');

        // Animate roll, then enable selection on settle
        showDiceForSelection(roll);
        showButtonsAfterRoll();
    } catch (err) {
        console.error('rollDice error:', err);
    }
}

async function confirmSelection() {
    if (selectedDice.length === 0) return;

    try {
        const res  = await fetch(`/game/multiplayer/${GAME_ID}/select`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedDice }),
        });
        const data = await res.json();
        if (!data.success) return alert(data.error);

        gameState = data.gameState;
        selectedDice = [];
        currentRoll = [];
        hideWildPicker();
        document.getElementById('selection-score-row').style.display = 'none';
        document.getElementById('turn-score').textContent = gameState.turn_score;

        if (window.diceRenderer) window.diceRenderer.hideLabels();

        if (gameState.status === 'FINISHED') {
            renderState(gameState);
            return;
        }

        // Show reroll + bank buttons
        showButtonsMiddleOfTurn();
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
        if (window.diceRenderer) window.diceRenderer.hideLabels();
        renderState(gameState);
    } catch (err) {
        console.error('bankPoints error:', err);
    }
}

// --- Button states ---
function showButtonsBeforeRoll() {
    document.getElementById('btn-roll').style.display    = 'block';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';

    const btnWild = document.getElementById('btn-wild');
    if (btnWild && gameState) {
        const isPlayer1 = gameState.player1_id === MY_ID;
        const wildUsed = isPlayer1 ? gameState.p1_wild_used : gameState.p2_wild_used;

        if (!wildUsed && gameState.user_streak >= 3) {
            btnWild.style.display = 'block';
        } else {
            btnWild.style.display = 'none';
        }
    }
}

function showButtonsAfterRoll() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-wild').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'block';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
}

function showButtonsMiddleOfTurn() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-wild').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'block';
    document.getElementById('btn-bank').style.display    = 'block';
}

function setButtonsWaiting() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-wild').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
}

function showBust() {
    document.getElementById('bust-msg').style.display = 'block';
    document.getElementById('selection-score-row').style.display = 'none';
    document.getElementById('selection-score').textContent = 0;
}

function hideBust() {
    document.getElementById('bust-msg').style.display = 'none';
}
