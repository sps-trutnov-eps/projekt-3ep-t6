exports.getMatchmakingPage = (req, res) => {
  res.render('matchmaking/index', { 
    title: 'Matchmaking'
  });
};