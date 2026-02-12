exports.getMatchmakingPage = (req, res) => {
  res.render('matchmaking/index', { 
    title: 'Matchmaking'
  });
};

exports.getLobbyPage = (req, res) => {
  res.render('matchmaking/lobby', { 
    title: 'Multiplayer Lobby'
  });
};