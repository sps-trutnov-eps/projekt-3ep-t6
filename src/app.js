const express = require('express');
const path = require('path');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/kostky', express.static(path.join(__dirname, 'kostky')));

// Routes
const homeRoutes = require('./routes/homeRoutes');
const matchmakingRoutes = require('./routes/matchmakingRoutes');

app.use('/', homeRoutes);
app.use('/matchmaking', matchmakingRoutes);

// DATABAZE
const User = require('./models/userModel');
const Game = require('./models/hraModel');
const Room = require('./models/roomModel');

const initDb = async () => {
  try {
    // Nejdřív User (kvůli cizím klíčům v Game)
    await User.createTable();
    await Game.createTable();
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1); // Pokud se nepovede spojit s DB, zabije se to
  }
};

// Start Server
const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});