exports.index = (req, res) => {
  res.render('home/index', {
    title: 'Dice Game',
  });
};

// tady muzes volat databazi (priklad: SELECT * FROM Users)