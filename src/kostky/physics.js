const g = 9.81
const rest = 0.3
const friction = 0.95
const angDamp = 0.998
const numDice = 6


function loop(DicePos)
{
  DicePos.forEach(dice => {
    dice[2]-=0.1;
  });
  //loop over dice
  //apply downward velocity
  //clamp it

  //collisions?

  //kolize - poloha kostky + jeji velikosti pro kazdy smer versus poloha ostatnich kostek v nejakym range - jejich velikosti
  //pak jeste nejaky stul coz je jen plocha na ktery se to musi zastavit
  
  return DicePos;
}


//TODO: podlaha
//TODO:fyzika
//-padání
//-kolize


export { loop };