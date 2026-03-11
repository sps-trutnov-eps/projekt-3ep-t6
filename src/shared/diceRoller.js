function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rollDice(seed, count) {
  const rng = mulberry32(seed);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(rng() * 6) + 1);
  }
  return results;
}

module.exports = { mulberry32, rollDice };
