exports.index = (req, res) => {
  res.render('home/index', {
    title: 'Home Page',
    message: 'Welcome to Express MVC!'
  });
};
