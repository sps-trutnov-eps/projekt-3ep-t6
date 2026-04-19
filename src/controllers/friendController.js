const Friend = require('../models/friendModel');
const User = require('../models/userModel');

exports.getFriendsPage = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const friends = await Friend.getFriends(userId);
        const pendingRequests = await Friend.getPendingRequests(userId);

        res.render('friends/index', {
            title: 'Přátelé',
            friends,
            pendingRequests,
            error: req.query.error,
            success: req.query.success
        });
    } catch (err) {
        console.error('Error loading friends page:', err);
        res.status(500).send('Internal Server Error');
    }
};

exports.sendFriendRequest = async (req, res) => {
    const { username } = req.body;
    const userId = req.session.user.id;

    if (!username) {
        return res.redirect('/friends?error=Zadejte uživatelské jméno');
    }

    try {
        const friend = await User.findByUsername(username);

        if (!friend) {
            return res.redirect('/friends?error=Uživatel nenalezen');
        }

        if (friend.id === userId) {
            return res.redirect('/friends?error=Nemůžete si přidat sami sebe');
        }

        const existing = await Friend.getFriendshipStatus(userId, friend.id);
        if (existing) {
            return res.redirect('/friends?error=Žádost již existuje nebo jste již přátelé');
        }

        await Friend.sendRequest(userId, friend.id);
        res.redirect('/friends?success=Žádost o přátelství odeslána');
    } catch (err) {
        console.error('Error sending friend request:', err);
        res.redirect('/friends?error=Chyba při odesílání žádosti');
    }
};

exports.acceptFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.session.user.id;

    try {
        await Friend.acceptRequest(userId, friendId);
        res.redirect('/friends?success=Žádost přijata');
    } catch (err) {
        console.error('Error accepting friend request:', err);
        res.redirect('/friends?error=Chyba při přijímání žádosti');
    }
};

exports.acceptFriendRequestAjax = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.session.user.id;

    try {
        await Friend.acceptRequest(userId, friendId);
        res.json({ success: true });
    } catch (err) {
        console.error('Error accepting friend request ajax:', err);
        res.status(500).json({ success: false, error: 'Chyba při přijímání žádosti' });
    }
};

exports.removeFriend = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.session.user.id;

    try {
        await Friend.removeFriendship(userId, friendId);
        res.redirect('/friends?success=Přátelství ukončeno');
    } catch (err) {
        console.error('Error removing friend:', err);
        res.redirect('/friends?error=Chyba při odebírání přítele');
    }
};
