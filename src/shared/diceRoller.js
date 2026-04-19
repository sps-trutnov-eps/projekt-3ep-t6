function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rollDice(seed, count, includeWild = false) {
  const rng = mulberry32(seed);
  const results = [];
  
  let diceToRoll = count;
  if (includeWild && count > 0) {
    results.push(0); // 0 representuje Wild Dice
    diceToRoll--;
  }

  for (let i = 0; i < diceToRoll; i++) {
    results.push(Math.floor(rng() * 6) + 1);
  }
  return results;
}

module.exports = { mulberry32, rollDice };