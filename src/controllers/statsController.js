const User = require('../models/userModel');

exports.getStatsPage = async (req, res) => {
    try {
        const players = await User.getTopPlayers();
        res.render('stats/index', {
            title: 'Globální statistiky',
            players
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};