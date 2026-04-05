// game.js
// -------
// Farkle game state machine and scoring logic.
// Pure JS — no DOM, no physics dependency.

const WIN_SCORE = 10000;

const state = {
  totalScore: 0,
  turnScore: 0,
  diceValues: [0, 0, 0, 0, 0, 0],
  // Which dice are kept THIS sub-roll (toggled by player before confirm)
  selected: [false, false, false, false, false, false],
  // Which dice are kept for the entire turn (accumulated across sub-rolls)
  kept: [false, false, false, false, false, false],
  phase: 'READY', // READY | ROLLING | SELECTING | FARKLE | WIN
};

// --- Scoring ---

function calculateScore(values) {
  if (values.length === 0) return { score: 0, allScoring: true };

  const counts = [0, 0, 0, 0, 0, 0]; // index 0 = face 1, index 5 = face 6
  for (const v of values) counts[v - 1]++;

  let score = 0;
  let diceUsed = 0;

  // Straight: 1-2-3-4-5-6
  if (values.length === 6 && counts.every(c => c === 1)) {
    return { score: 1500, allScoring: true };
  }

  // Three pairs (e.g. 2-2-3-3-5-5)
  if (values.length === 6 && counts.filter(c => c === 2).length === 3) {
    return { score: 750, allScoring: true };
  }

  // N-of-a-kind (process from 6 down)
  for (let face = 1; face <= 6; face++) {
    const c = counts[face - 1];
    if (c >= 3) {
      const base = face === 1 ? 1000 : face * 100;
      if (c === 6) { score += base * 8; diceUsed += 6; }
      else if (c === 5) { score += base * 4; diceUsed += 5; }
      else if (c === 4) { score += base * 2; diceUsed += 4; }
      else { score += base; diceUsed += 3; }
      counts[face - 1] -= c >= 3 ? (c >= 6 ? 6 : c >= 5 ? 5 : c >= 4 ? 4 : 3) : 0;
    }
  }

  // Remaining 1s and 5s
  score += counts[0] * 100; // 1s
  diceUsed += counts[0];
  score += counts[4] * 50;  // 5s
  diceUsed += counts[4];

  return { score, allScoring: diceUsed === values.length };
}

// Check if ANY scoring is possible from these values
function canScore(values) {
  return calculateScore(values).score > 0;
}

// --- Game flow ---

function newGame() {
  state.totalScore = 0;
  state.turnScore = 0;
  state.diceValues = [0, 0, 0, 0, 0, 0];
  state.selected = [false, false, false, false, false, false];
  state.kept = [false, false, false, false, false, false];
  state.phase = 'READY';
  return { ...state };
}

function startRoll() {
  // Clear selections from last sub-roll
  state.selected = [false, false, false, false, false, false];

  // Determine which dice to roll (non-kept)
  const indices = [];
  for (let i = 0; i < 6; i++) {
    if (!state.kept[i]) indices.push(i);
  }

  state.phase = 'ROLLING';
  return indices;
}

function onDiceSettled(values) {
  state.diceValues = values;

  // Check only the dice that were just rolled (not kept)
  const rolledValues = [];
  for (let i = 0; i < 6; i++) {
    if (!state.kept[i]) rolledValues.push(values[i]);
  }

  if (!canScore(rolledValues)) {
    state.phase = 'FARKLE';
    return { ...state };
  }

  state.phase = 'SELECTING';
  return { ...state };
}

function toggleSelect(index) {
  if (state.phase !== 'SELECTING') return { ...state };
  if (state.kept[index]) return { ...state }; // can't toggle already-kept dice
  state.selected[index] = !state.selected[index];
  return { ...state };
}

function getSelectedScore() {
  const selectedValues = [];
  for (let i = 0; i < 6; i++) {
    if (state.selected[i]) selectedValues.push(state.diceValues[i]);
  }
  return calculateScore(selectedValues);
}

function confirmKeep() {
  if (state.phase !== 'SELECTING') return null;

  const result = getSelectedScore();
  if (result.score === 0) return null; // invalid selection

  // Mark selected dice as kept
  for (let i = 0; i < 6; i++) {
    if (state.selected[i]) state.kept[i] = true;
  }

  state.turnScore += result.score;
  state.selected = [false, false, false, false, false, false];

  // Hot Dice: all 6 dice are kept → fresh set of 6
  if (state.kept.every(k => k)) {
    state.kept = [false, false, false, false, false, false];
  }

  return { ...state, confirmed: true };
}

function bank() {
  state.totalScore += state.turnScore;
  state.turnScore = 0;
  state.kept = [false, false, false, false, false, false];
  state.selected = [false, false, false, false, false, false];

  if (state.totalScore >= WIN_SCORE) {
    state.phase = 'WIN';
  } else {
    state.phase = 'READY';
  }
  return { ...state };
}

function resetTurn() {
  state.turnScore = 0;
  state.kept = [false, false, false, false, false, false];
  state.selected = [false, false, false, false, false, false];
  state.phase = 'READY';
  return { ...state };
}

function getState() {
  return { ...state };
}

export {
  newGame,
  startRoll,
  onDiceSettled,
  toggleSelect,
  getSelectedScore,
  confirmKeep,
  bank,
  resetTurn,
  getState,
  calculateScore,
};
