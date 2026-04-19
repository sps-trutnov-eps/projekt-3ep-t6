// game.js
// -------
// Farkle game state machine, scoring logic, and AI opponent.
// Pure JS — no DOM, no physics dependency.

const WIN_SCORE = 10000;

const state = {
  playerScore: 0,
  aiScore: 0,
  turnScore: 0,
  diceValues: [0, 0, 0, 0, 0, 0],
  selected: [false, false, false, false, false, false],
  kept: [false, false, false, false, false, false],
  phase: 'READY',
  // READY | ROLLING | SELECTING | FARKLE | WIN | LOSE
  // AI phases: AI_ROLLING | AI_SELECTING | AI_DECIDING | AI_FARKLE
  currentPlayer: 'human', // 'human' | 'ai'
};

// --- Scoring ---

function calculateScore(values) {
  if (values.length === 0) return { score: 0, allScoring: true };

  const counts = [0, 0, 0, 0, 0, 0];
  for (const v of values) counts[v - 1]++;

  let score = 0;
  let diceUsed = 0;

  // Straight: 1-2-3-4-5-6
  if (values.length === 6 && counts.every(c => c === 1)) {
    return { score: 1500, allScoring: true };
  }

  // Three pairs
  if (values.length === 6 && counts.filter(c => c === 2).length === 3) {
    return { score: 750, allScoring: true };
  }

  // N-of-a-kind
  for (let face = 1; face <= 6; face++) {
    const c = counts[face - 1];
    if (c >= 3) {
      const base = face === 1 ? 1000 : face * 100;
      if (c === 6) { score += base * 8; diceUsed += 6; }
      else if (c === 5) { score += base * 4; diceUsed += 5; }
      else if (c === 4) { score += base * 2; diceUsed += 4; }
      else { score += base; diceUsed += 3; }
      counts[face - 1] -= (c >= 6 ? 6 : c >= 5 ? 5 : c >= 4 ? 4 : 3);
    }
  }

  // Remaining 1s and 5s
  score += counts[0] * 100;
  diceUsed += counts[0];
  score += counts[4] * 50;
  diceUsed += counts[4];

  return { score, allScoring: diceUsed === values.length };
}

function canScore(values) {
  return calculateScore(values).score > 0;
}

// --- AI Logic ---

// Find which dice the AI should keep (greedy: keep all scoring dice)
function aiPickScoringDice(diceValues, kept) {
  const available = [];
  for (let i = 0; i < 6; i++) {
    if (!kept[i]) available.push(i);
  }

  // Try keeping all available scoring dice — greedy approach
  // First find the best scoring combo from available dice
  const availValues = available.map(i => diceValues[i]);
  const fullResult = calculateScore(availValues);

  if (fullResult.allScoring) {
    // All available dice score — keep them all
    return available;
  }

  // Otherwise, figure out which dice contribute to scoring.
  // Strategy: keep triplets first, then individual 1s and 5s
  const counts = [0, 0, 0, 0, 0, 0];
  for (const v of availValues) counts[v - 1]++;

  const toKeep = [];
  const used = [0, 0, 0, 0, 0, 0]; // track how many of each face we've assigned

  // Keep N-of-a-kind groups (3+)
  for (let face = 1; face <= 6; face++) {
    const c = counts[face - 1];
    if (c >= 3) {
      const keepCount = c >= 6 ? 6 : c >= 5 ? 5 : c >= 4 ? 4 : 3;
      let assigned = 0;
      for (const i of available) {
        if (diceValues[i] === face && assigned < keepCount && !toKeep.includes(i)) {
          toKeep.push(i);
          assigned++;
        }
      }
      used[face - 1] = keepCount;
    }
  }

  // Keep remaining 1s and 5s
  for (const i of available) {
    if (toKeep.includes(i)) continue;
    const face = diceValues[i];
    if (face === 1 && used[0] < counts[0]) {
      toKeep.push(i);
      used[0]++;
    } else if (face === 5 && used[4] < counts[4]) {
      toKeep.push(i);
      used[4]++;
    }
  }

  return toKeep;
}

// Decide whether to bank or roll again
function aiShouldBank() {
  const diceLeft = state.kept.filter(k => !k).length;
  const gap = state.playerScore - state.aiScore; // positive = player ahead

  // Base threshold — bank if turn score is high enough
  let threshold = 300;

  // Adjust based on game state
  if (gap > 2000) {
    // Behind — push harder
    threshold = 500;
  } else if (gap < -2000) {
    // Ahead — play safe
    threshold = 200;
  }

  // If player is near winning, push very hard
  if (state.playerScore >= 8000) {
    threshold = 600;
  }

  // Fewer dice left = higher risk of farkle, lower threshold
  if (diceLeft <= 2) {
    threshold = Math.min(threshold, 250);
  }

  // Hot Dice (0 dice left = all scored) — always roll again
  if (diceLeft === 0) return false;

  // If turn score could win the game, always bank
  if (state.aiScore + state.turnScore >= WIN_SCORE) return true;

  return state.turnScore >= threshold;
}

// --- Game flow ---

function newGame() {
  state.playerScore = 0;
  state.aiScore = 0;
  state.turnScore = 0;
  state.diceValues = [0, 0, 0, 0, 0, 0];
  state.selected = [false, false, false, false, false, false];
  state.kept = [false, false, false, false, false, false];
  state.phase = 'READY';
  state.currentPlayer = 'human';
  return { ...state };
}

function startRoll() {
  state.selected = [false, false, false, false, false, false];
  const indices = [];
  for (let i = 0; i < 6; i++) {
    if (!state.kept[i]) indices.push(i);
  }
  state.phase = state.currentPlayer === 'human' ? 'ROLLING' : 'AI_ROLLING';
  return indices;
}

function onDiceSettled(values) {
  state.diceValues = values;
  const rolledValues = [];
  for (let i = 0; i < 6; i++) {
    if (!state.kept[i]) rolledValues.push(values[i]);
  }

  if (!canScore(rolledValues)) {
    state.phase = state.currentPlayer === 'human' ? 'FARKLE' : 'AI_FARKLE';
    return { ...state };
  }

  state.phase = state.currentPlayer === 'human' ? 'SELECTING' : 'AI_SELECTING';
  return { ...state };
}

function toggleSelect(index) {
  if (state.phase !== 'SELECTING') return { ...state };
  if (state.kept[index]) return { ...state };
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
  if (state.phase !== 'SELECTING' && state.phase !== 'AI_SELECTING') return null;

  const result = getSelectedScore();
  if (result.score === 0) return null;

  for (let i = 0; i < 6; i++) {
    if (state.selected[i]) state.kept[i] = true;
  }

  state.turnScore += result.score;
  state.selected = [false, false, false, false, false, false];

  // Hot Dice
  if (state.kept.every(k => k)) {
    state.kept = [false, false, false, false, false, false];
  }

  return { ...state, confirmed: true };
}

function bank() {
  if (state.currentPlayer === 'human') {
    state.playerScore += state.turnScore;
  } else {
    state.aiScore += state.turnScore;
  }

  state.turnScore = 0;
  state.kept = [false, false, false, false, false, false];
  state.selected = [false, false, false, false, false, false];

  const totalForCurrent = state.currentPlayer === 'human' ? state.playerScore : state.aiScore;

  if (totalForCurrent >= WIN_SCORE) {
    state.phase = state.currentPlayer === 'human' ? 'WIN' : 'LOSE';
    return { ...state };
  }

  // Switch turns
  state.currentPlayer = state.currentPlayer === 'human' ? 'ai' : 'human';
  state.phase = state.currentPlayer === 'human' ? 'READY' : 'AI_READY';
  return { ...state };
}

function resetTurn() {
  state.turnScore = 0;
  state.kept = [false, false, false, false, false, false];
  state.selected = [false, false, false, false, false, false];

  // Switch turns
  state.currentPlayer = state.currentPlayer === 'human' ? 'ai' : 'human';
  state.phase = state.currentPlayer === 'human' ? 'READY' : 'AI_READY';
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
  aiPickScoringDice,
  aiShouldBank,
};
