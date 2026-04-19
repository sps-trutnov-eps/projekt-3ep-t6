// přijímá např [1, 1, 5, 2, 3, 5] a vrací skóre a kolik kostek zůstává
function checkCurrentScore(chosenDice) {
    let diceLeft = [0, 0, 0, 0, 0, 0];
    let wilds = 0;
    let score = 0;

    for (let die of chosenDice) {
        if (die === 0) wilds++;
        else diceLeft[die - 1]++;
    }

    // 1. Postupky
    // 1-6
    if (canMakeStraight(diceLeft, wilds, 0, 6)) {
        score += 1500;
        let usedWilds = useForStraight(diceLeft, wilds, 0, 6);
        wilds -= usedWilds;
    } 
    // 2-6
    else if (canMakeStraight(diceLeft, wilds, 1, 5)) {
        score += 750;
        let usedWilds = useForStraight(diceLeft, wilds, 1, 5);
        wilds -= usedWilds;
    }
    // 1-5
    else if (canMakeStraight(diceLeft, wilds, 0, 5)) {
        score += 500;
        let usedWilds = useForStraight(diceLeft, wilds, 0, 5);
        wilds -= usedWilds;
    }

    // 2. Trojice a více
    for (let i = 0; i < 6; i++) {
        // Zkusíme doplnit trojici pomocí wild dice pokud jich máme málo
        let count = diceLeft[i];
        if (count > 0 || (i === 0 || i === 4)) { // jen pro skórující nebo existující
             // Pokud máme aspoň 1 a chceme do 3
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

    // 4. Pokud zbyly wild dice, každá je za 100 (jako jednička)
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

    // 1. Postupky
    if (canMakeStraight(diceLeft, wilds, 0, 6)) {
        wilds -= useForStraight(diceLeft, wilds, 0, 6);
    } else if (canMakeStraight(diceLeft, wilds, 1, 5)) {
        wilds -= useForStraight(diceLeft, wilds, 1, 5);
    } else if (canMakeStraight(diceLeft, wilds, 0, 5)) {
        wilds -= useForStraight(diceLeft, wilds, 0, 5);
    }

    // 2. Trojice a více
    for (let i = 0; i < 6; i++) {
        if (diceLeft[i] >= 3) {
            diceLeft[i] = 0;
        } else if (diceLeft[i] > 0 && (diceLeft[i] + wilds) >= 3) {
            wilds -= (3 - diceLeft[i]);
            diceLeft[i] = 0;
        }
    }

    // 3. Zbylé jedničky a pětky
    diceLeft[0] = 0; 
    diceLeft[4] = 0;
    
    // 4. Wild dice mohou být cokoli, takže pokud zbyly, jsou validní (jako 1 nebo 5)
    wilds = 0;

    return diceLeft.every(c => c === 0);
}

module.exports = { checkCurrentScore, isSelectionValid };