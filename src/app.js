const express = require('express');
const session = require("express-session");
const path = require('path');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/kostky', express.static(path.join(__dirname, 'kostky')));

app.use(session({
    secret: "some-super-secret-secret",
    resave: false,
    saveUninitialized: false
}));

// Zpristupneni usera ve views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
const homeRoutes = require('./routes/homeRoutes');
const matchmakingRoutes = require('./routes/matchmakingRoutes');
const authRoutes = require("./routes/authRoutes");
const gameRoutes = require("./routes/gameRoutes");

app.use('/', homeRoutes);
app.use('/matchmaking', matchmakingRoutes);
app.use('/auth', authRoutes);
app.use('/game', gameRoutes);

// Databaze
const User = require('./models/userModel');
const Game = require('./models/hraModel');
const Room = require('./models/roomModel');
const Friend = require('./models/friendModel');

const initDb = async () => {
  try {
    await User.createTable();
    await Game.createTable();
    await Room.createTable();
    await Friend.createTable();
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});