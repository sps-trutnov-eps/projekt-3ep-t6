exports.index = (req, res) => {
  res.render('home/index', {
    title: 'Farkle',
    message: 'Farkle'
  });
};

// tady muzes volat databazi (priklad: SELECT * FROM Users)