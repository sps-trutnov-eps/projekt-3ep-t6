// TODO: vrátit skóre

// přijímá např [1, 1, 5, 2, 3, 5] a vrací skóre a kolik kostek zůstává
function checkCurrentScore(chosenDice, strict = false) {
    // počet daného čísla, např 3 na druhém místě znamená, že máme tři dvojky
    let diceLeft = [0,0,0,0,0,0]; 
    let score = 0;

    // přeložení parametru chosenDice na proměnou diceLeft
    for (let die of chosenDice) {
        diceLeft[die - 1]++;
    }

    // postupky
    // 1-6
    if (diceLeft.every(c => c >= 1)) {
        score += 1500;
        diceLeft = [0, 0, 0, 0, 0, 0];
    }
    // 2-6
    else if (diceLeft.slice(1).every(c => c >= 1)) {
        score += 750;
        for (let i = 1; i < 6; i++) diceLeft[i]--;
    }
    // 1-5
    else if (diceLeft.slice(0, 5).every(c => c >= 1)) {
        score += 500;
        for (let i = 0; i < 5; i++) diceLeft[i]--;
    }

    // několik stejných
    // tři je základ, jakákoliv další zdvojnásobí počet bodů

    // tři a více jedniček, základní počet bodů je 1000
    if (diceLeft[0] >= 3) {
        score += 1000 * Math.pow(2, diceLeft[0] - 3);
        diceLeft[0] = 0;
    }

    // tři a více stejné čísla kromě jedniček, základní počet bodů je číslo * 100
    for (let i = 1; i < 6; i++) {
        if (diceLeft[i] >= 3) {
            score += (i + 1) * 100 * Math.pow(2, diceLeft[i] - 3);
            diceLeft[i] = 0;
        }
    }

    // jedničky a pětky
    score += diceLeft[0] * 100; // každá jednička stojí 100 bodů
    diceLeft[0] = 0;
    score += diceLeft[4] * 50;  // každá pětka stojí 50 bodů
    diceLeft[4] = 0;

    // Zkontrolujeme, jestli zbyly nějaké kostky, které nepřinesly body
    if (strict) {
        const remaining = diceLeft.reduce((sum, count) => sum + count, 0);
        if (remaining > 0) {
            return 0; // Neplatný výběr (obsahuje kostky bez bodů)
        }
    }

    return score;
};

/**
 * Ověří, zda všechny vybrané kostky přispívají ke skóre.
 * Farkle pravidla: hráč smí odložit jen ty kostky, které samy o sobě nebo v kombinaci skórují.
 */
function isSelectionValid(chosenDice) {
    if (!chosenDice || chosenDice.length === 0) return false;
    
    let diceLeft = [0, 0, 0, 0, 0, 0];
    for (let die of chosenDice) {
        diceLeft[die - 1]++;
    }

    // 1. Postupky (všechny kostky se spotřebují)
    if (diceLeft.every(c => c >= 1)) return true; // 1-6
    if (diceLeft.slice(1).every(c => c >= 1) && chosenDice.length === 5) return true; // 2-6
    if (diceLeft.slice(0, 5).every(c => c >= 1) && chosenDice.length === 5) return true; // 1-5

    // 2. Trojice a více (tyto kostky skórují)
    for (let i = 0; i < 6; i++) {
        if (diceLeft[i] >= 3) {
            diceLeft[i] = 0; // Tyto jsou validní, vynulujeme je
        }
    }

    // 3. Zbylé jedničky a pětky skórují
    diceLeft[0] = 0; // Jedničky
    diceLeft[4] = 0; // Pětky

    // Pokud po odečtení všech skórujících kombinací/kostek něco zbylo, výběr je nevalidní
    return diceLeft.every(c => c === 0);
}

module.exports = { checkCurrentScore, isSelectionValid };