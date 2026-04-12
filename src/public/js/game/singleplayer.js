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

//  Stav frontendu
let currentRoll     = [];
let selectedDice    = [];
let selectionLocked = false;

// Wire up 3D selection callback
function setup3DSelection() {
    if (!window.diceRenderer) return;
    window.diceRenderer.onSelect((idx, selectedSet) => {
        if (selectionLocked) return;
        selectedDice = new Array(currentRoll.length).fill(false);
        for (const i of selectedSet) selectedDice[i] = true;
        updateSelectionScore();
    });
}

// Try immediately, retry after module loads
setup3DSelection();
window.addEventListener('load', setup3DSelection);

function updateSelectionScore() {
    const chosen = currentRoll.filter((_, i) => selectedDice[i]);
    const score  = chosen.length > 0 ? checkCurrentScore(chosen) : 0;
    document.getElementById('selection-score').textContent = score;
    document.getElementById('btn-confirm').disabled = score === 0;
}

//  Aktualizace stavu hry
function updateGameState(gameState) {
    document.getElementById('player-score').textContent    = gameState.p1_score   ?? 0;
    document.getElementById('turn-score').textContent      = gameState.turn_score  ?? 0;
    document.getElementById('dice-left-count').textContent = gameState.dice_left   ?? 6;

    if (gameState.status === 'FINISHED') {
        showFinished();
    }
}

function showFinished() {
    document.getElementById('game-finished').style.display = 'block';
    document.getElementById('action-area').style.display   = 'none';
    if (window.diceRenderer) window.diceRenderer.hideLabels();
}

//  Fáze hry
async function rollDice() {
    setButtonsDisabled(true);

    // Trigger 3D dice animation
    const diceLeft = parseInt(document.getElementById('dice-left-count').textContent) || 6;
    if (window.diceRenderer) {
        window.diceRenderer.roll(diceLeft);
    }

    try {
        const res  = await fetch('/game/roll', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            alert('Chyba pri hazeni: ' + (data.error ?? 'neznama chyba'));
            setButtonsDisabled(false);
            return;
        }

        const gameState = data.gameState;
        updateGameState(gameState);

        currentRoll = Array.isArray(gameState.last_roll)
            ? gameState.last_roll
            : JSON.parse(gameState.last_roll ?? '[]');

        if (data.bust) {
            // Show values on 3D labels briefly, then bust
            waitForSettleThenShow(currentRoll, () => {
                showBustMessage();
                setTimeout(() => {
                    if (window.diceRenderer) window.diceRenderer.hideLabels();
                    enterRollPhase();
                }, 1500);
            });
            return;
        }

        if (gameState.status === 'FINISHED') {
            waitForSettleThenShow(currentRoll, () => {});
            return;
        }

        selectedDice    = new Array(currentRoll.length).fill(false);
        selectionLocked = false;

        // Wait for 3D dice to settle, then show values and enable selection
        waitForSettleThenShow(currentRoll, () => {
            enterSelectPhase();
        });

    } catch (err) {
        console.error(err);
        alert('Nepodarilo se spojit se serverem.');
        setButtonsDisabled(false);
    }
}

function waitForSettleThenShow(values, callback) {
    if (window.diceRenderer) {
        window.diceRenderer.onSettle(() => {
            window.diceRenderer.showValues(values);
            callback();
        });
    } else {
        callback();
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
        alert('Vybrana kombinace nema zadne body!');
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
            alert('Chyba: ' + (data.error ?? 'neznama chyba'));
            setButtonsDisabled(false);
            return;
        }

        updateGameState(data.gameState);
        if (data.gameState.status === 'FINISHED') return;

        selectionLocked = true;
        if (window.diceRenderer) window.diceRenderer.hideLabels();
        enterPostConfirmPhase(data.gameState.dice_left);

    } catch (err) {
        console.error(err);
        alert('Nepodarilo se spojit se serverem.');
        setButtonsDisabled(false);
    }
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
            alert('Chyba pri bankovani: ' + (data.error ?? 'neznama chyba'));
            setButtonsDisabled(false);
            return;
        }

        updateGameState(data.gameState);
        if (data.gameState.status === 'FINISHED') return;

        if (window.diceRenderer) window.diceRenderer.hideLabels();
        document.getElementById('selection-score').textContent = 0;
        document.getElementById('selection-score-row').style.display = 'none';
        enterRollPhase();

    } catch (err) {
        console.error(err);
        alert('Nepodarilo se spojit se serverem.');
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
    } catch (err) {
        console.error('Nepodarilo se nacist stav hry:', err);
    }
}

getGameState();
