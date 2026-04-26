//  scoreEngine — kopie /shared/scoreEngine.js pro frontend
function checkCurrentScore(chosenDice) {
    let diceLeft = [0, 0, 0, 0, 0, 0];
    let wilds = 0;
    let score = 0;

    for (let die of chosenDice) {
        if (die === 0) wilds++;
        else diceLeft[die - 1]++;
    }

    // 1. Postupky
    if (canMakeStraight(diceLeft, wilds, 0, 6)) {
        score += 1500;
        wilds -= useForStraight(diceLeft, wilds, 0, 6);
    } else if (canMakeStraight(diceLeft, wilds, 1, 5)) {
        score += 750;
        wilds -= useForStraight(diceLeft, wilds, 1, 5);
    } else if (canMakeStraight(diceLeft, wilds, 0, 5)) {
        score += 500;
        wilds -= useForStraight(diceLeft, wilds, 0, 5);
    }

    // 2. Trojice a více
    for (let i = 0; i < 6; i++) {
        let count = diceLeft[i];
        if (count > 0 || (i === 0 || i === 4)) {
             if (count < 3 && count > 0 && (count + wilds) >= 3) {
                 let need = 3 - count;
                 wilds -= need;
                 count = 3;
                 diceLeft[i] = 0;
             } else if (count >= 3) {
                 diceLeft[i] = 0;
             }
             if (count >= 3) {
                 let base = (i === 0) ? 1000 : (i + 1) * 100;
                 score += base * Math.pow(2, count - 3);
             }
        }
    }

    // 3. Zbylé jedničky a pětky
    score += diceLeft[0] * 100;
    score += diceLeft[4] * 50;
    score += wilds * 100;
    return score;
}

function canMakeStraight(diceLeft, wilds, start, length) {
    let needed = 0;
    for (let i = start; i < start + length; i++) {
        if (diceLeft[i] === 0) needed++;
    }
    return wilds >= needed;
}

function useForStraight(diceLeft, wilds, start, length) {
    let used = 0;
    for (let i = start; i < start + length; i++) {
        if (diceLeft[i] > 0) diceLeft[i]--;
        else used++;
    }
    return used;
}

function isSelectionValid(chosenDice) {
    if (!chosenDice || chosenDice.length === 0) return false;
    let diceLeft = [0, 0, 0, 0, 0, 0];
    let wilds = 0;
    for (let die of chosenDice) {
        if (die === 0) wilds++;
        else diceLeft[die - 1]++;
    }

    if (canMakeStraight(diceLeft, wilds, 0, 6)) {
        wilds -= useForStraight(diceLeft, wilds, 0, 6);
    } else if (canMakeStraight(diceLeft, wilds, 1, 5)) {
        wilds -= useForStraight(diceLeft, wilds, 1, 5);
    } else if (canMakeStraight(diceLeft, wilds, 0, 5)) {
        wilds -= useForStraight(diceLeft, wilds, 0, 5);
    }

    for (let i = 0; i < 6; i++) {
        if (diceLeft[i] >= 3) {
            diceLeft[i] = 0;
        } else if (diceLeft[i] > 0 && (diceLeft[i] + wilds) >= 3) {
            wilds -= (3 - diceLeft[i]);
            diceLeft[i] = 0;
        }
    }
    diceLeft[0] = 0; 
    diceLeft[4] = 0;
    return diceLeft.every(c => c === 0);
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
    document.getElementById('opponent-score').textContent  = gameState.p2_score   ?? 0;

    if (gameState.status === 'FINISHED') {
        showFinished(gameState);
    }
}

function showFinished(gameState) {
    const banner = document.querySelector('.finished-banner p');
    if (gameState.winner_id === null && gameState.p2_score >= gameState.target_score) {
        banner.textContent = 'Prohráli jste! Stařec byl lepší.';
    } else if (gameState.winner_id == document.getElementById('player-id').textContent) {
        banner.textContent = 'Vyhráli jste! Gratulujeme!';
    }
    
    document.getElementById('game-finished').style.display = 'block';
    document.getElementById('action-area').style.display   = 'none';
    if (window.diceRenderer) window.diceRenderer.hideLabels();
}

//  Fáze hry
async function rollDice() {
    setButtonsDisabled(true);

    const diceLeft = parseInt(document.getElementById('dice-left-count').textContent) || 6;

    // Cheat override: skip physics, send pre-determined values
    if (cheatOverride) {
        const values = cheatOverride;
        cheatOverride = null;
        if (window.diceRenderer) {
            window.diceRenderer.roll(diceLeft);
            window.diceRenderer.onSettle(async () => {
                await executeServerRoll(values);
            });
        } else {
            await executeServerRoll(values);
        }
        return;
    }

    if (window.diceRenderer) {
        window.diceRenderer.roll(diceLeft);
        window.diceRenderer.onSettle(async () => {
            const physicsValues = window.diceRenderer.getValues().slice(0, diceLeft);
            await executeServerRoll(physicsValues);
        });
    } else {
        const fallback = [];
        for (let i = 0; i < diceLeft; i++) fallback.push(Math.floor(Math.random() * 6) + 1);
        await executeServerRoll(fallback);
    }
}

async function executeServerRoll(diceValues) {
    try {
        const res  = await fetch('/game/roll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diceValues }),
        });
        const data = await res.json();

        if (!data.success) {
            alert('Chyba pri hazeni: ' + (data.error ?? 'neznama chyba'));
            setButtonsDisabled(false);
            return;
        }

        const gameState = data.gameState;
        updateGameState(gameState);

        currentRoll = data.bustRoll || diceValues;

        if (data.bust) {
            if (window.diceRenderer) window.diceRenderer.showValues(currentRoll);
            showBustMessage();
            setTimeout(() => {
                if (window.diceRenderer) window.diceRenderer.hideLabels();
                executeNpcTurn();
            }, 1500);
            return;
        }

        if (gameState.status === 'FINISHED') {
            if (window.diceRenderer) window.diceRenderer.showValues(currentRoll);
            return;
        }

        selectedDice    = new Array(currentRoll.length).fill(false);
        selectionLocked = false;

        if (window.diceRenderer) window.diceRenderer.showValues(currentRoll);
        enterSelectPhase();

    } catch (err) {
        console.error(err);
        alert('Nepodarilo se spojit se serverem.');
        setButtonsDisabled(false);
    }
}

// remove waitForSettleThenShow

function enterSelectPhase() {
    document.getElementById('btn-roll').style.display    = 'none';
    document.getElementById('btn-confirm').style.display = 'inline-block';
    document.getElementById('btn-reroll').style.display  = 'none';
    document.getElementById('btn-bank').style.display    = 'none';
    document.getElementById('btn-confirm').disabled      = true;
    document.getElementById('selection-score-row').style.display = 'block';
    document.getElementById('bust-msg').style.display    = 'none';
}

async function confirmSelection() {
    const chosen     = currentRoll.filter((_, i) => selectedDice[i]);
    const localScore = checkCurrentScore(chosen, true);

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
        if (window.diceRenderer) {
            window.diceRenderer.hideLabels();
            const hideIndices = [];
            for (let i = 0; i < selectedDice.length; i++) {
                if (selectedDice[i]) hideIndices.push(i);
            }
            window.diceRenderer.hideDice(hideIndices);
        }
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
        executeNpcTurn();

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

async function executeNpcTurn() {
    setButtonsDisabled(true);
    
    try {
        const res = await fetch('/game/npc-turn', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            console.error('NPC turn failed:', data.error);
            enterRollPhase();
            return;
        }

        // NPC dice animation using server values
        if (window.diceRenderer) {
            window.diceRenderer.rollToValues(data.npcRoll, 'far');
        }

        const handleNpcResult = () => {
            updateGameState(data.gameState);
            
            if (data.npcBust) {
                document.getElementById('bust-msg').style.display = 'block';
                document.getElementById('bust-msg').textContent = 'Chudý starec hodil Farkle! (0 bodů)';
            } else {
                document.getElementById('bust-msg').style.display = 'block';
                document.getElementById('bust-msg').textContent = `Chudý starec bankoval ${data.npcScore} bodů!`;
            }

            setTimeout(() => {
                document.getElementById('bust-msg').style.display = 'none';
                document.getElementById('bust-msg').textContent = 'Farkle! Přišel jsi o body v tomto kole.';
                if (window.diceRenderer) window.diceRenderer.hideLabels();
                
                if (data.gameState.status !== 'FINISHED') {
                    enterRollPhase();
                }
            }, 3000);
        };

        if (window.diceRenderer) {
            window.diceRenderer.onSettle(handleNpcResult);
        } else {
            handleNpcResult();
        }

    } catch (err) {
        console.error('NPC turn request failed:', err);
        enterRollPhase();
    }
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
        console.error('Nepodařilo se načíst stav hry:', err);
    }
}

getGameState();

// Cheat function — overrides next roll with server-generated values
let cheatOverride = null;

window.gimme = async function(score) {
    try {
        const res = await fetch('/game/cheat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetScore: score })
        });
        const data = await res.json();
        if (data.success) {
            console.log('%c CHEAT ACTIVATED: ' + data.message, 'color: #cf763b; font-weight: bold; font-size: 14px;');
            cheatOverride = data.cheatRoll;
            if (!document.getElementById('btn-roll').disabled && document.getElementById('btn-roll').style.display !== 'none') {
                rollDice();
            } else if (!document.getElementById('btn-reroll').disabled && document.getElementById('btn-reroll').style.display !== 'none') {
                rerollDice();
            } else {
                console.log('Click Roll to see your dice!');
            }
        } else {
            console.error('Cheat failed:', data.error);
        }
    } catch (err) {
        console.error('Cheat request failed:', err);
    }
};

async function startNewSingleplayerGame(event) {
    event.preventDefault();

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
            window.location.href = '/game/singleplayer';
        } else {
            alert('Nepodařilo se vytvořit novou hru: ' + (data.error || 'Neznámá chyba'));
        }
    } catch (err) {
        console.error('Error starting new singleplayer game:', err);
        alert('Chyba spojení se serverem při pokusu o novou hru.');
    }
}
