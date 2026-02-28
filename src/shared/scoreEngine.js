// TODO: vrátit skóre

// přijímá např [1, 1, 5, 2, 3, 5] a vrací skóre a kolik kostek zůstává
function checkCurrentScore(chosenDice) {
    // počet daného čísla, např 3 na druhém místě znamená, že máme tři dvojky
    let diceLeft = [0,0,0,0,0,0]; 
    let maxScore = 0;

    // přeložení parametru chosenDice na proměnou diceLeft
    for (let die of chosenDice) {
        diceLeft[die - 1]++;
    }

    // postupky
    // 1-6
    if (
        diceLeft[1] > 0 && diceLeft[2] > 0 && diceLeft[3] > 0
        && diceLeft[4] > 0 && diceLeft[5] > 0 && diceLeft[0] > 0
    ) {

        maxScore += 1500;
        diceLeft = [0,0,0,0,0,0]; // všechny kostky se počítají
    }
    // 2-6
    else if (
        diceLeft[1] > 0 && diceLeft[2] > 0 && diceLeft[3] > 0 
        && diceLeft[4] > 0 && diceLeft[5] > 0
    ) {
        maxScore += 750;
        for (let i = 0; i < 6; i++) {
            if (diceLeft[i] > 0) {
                diceLeft[i]--;
            }
        }
    }
    // 1-5
    else if (
        diceLeft[0] > 0 && diceLeft[1] > 0 && diceLeft[2] > 0 
        && diceLeft[3] > 0 && diceLeft[4] > 0
    ){
        maxScore += 500;
        for (let i = 0; i < 6; i++) {
            if (diceLeft[i] < 6) {
                diceLeft[i]--;
            }
        }
    }

    // několik stejných
    // tři je základ, jakákoliv další zdvojnásobí počet bodů

    // tři a více jedniček, základní počet bodů je 1000
    if (diceLeft[0] >= 3) {
        maxScore += 1000 * (diceLeft[0] - 2);
        diceLeft[0] = 0;
    }

    // tři a více stejné čísla kromě jedniček, základní počet bodů je číslo * 100
    for (let i = 1; i < 6; i++) {
        if (diceLeft[i] >= 3) {
            maxScore += (i + 1) * 100 * (diceLeft[i] - 2);
            diceLeft[i] = 0;
        }
    }

    // jedničky a pětky
    maxScore += diceLeft[0] * 100; // každá jednička stojí 100 bodů
    maxScore += diceLeft[4] * 50;  // každá pětka stojí 50 bodů

    return maxScore;
};

module.exports = {
    checkCurrentScore
};