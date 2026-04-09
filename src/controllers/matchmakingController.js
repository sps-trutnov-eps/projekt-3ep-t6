const Room = require('../models/roomModel');
const Friend = require('../models/friendModel');
const Invitation = require('../models/invitationModel');
const Game = require('../models/hraModel');

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

exports.createRoom = async (req, res) => {
  try {
    // zatim jen pro prihlasene uzivatele
    if (!req.session.user) {
      return res.status(401).json({ error: 'Nejsi přihlášen' });
    }

    const room = await Room.create(req.session.user.id, true); // vychozi je private

    res.json({
      success: true,
      room: {
        id: room.id,
        code: room.invite_code,
        type: room.room_type
      }
    });
  } catch (err) {
    console.error('createRoom error:', err);
    res.status(500).json({ error: 'Nepodařilo se vytvořit místnost' });
  }
};

exports.setVisibility = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Nejsi přihlášen' });
    }

    const { roomId, isPublic } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Místnost nenalezena' });
    }

    if (room.creator_id !== req.session.user.id) {
      return res.status(403).json({ error: 'Nejsi tvůrce této místnosti' });
    }

    const updated = await Room.setVisibility(roomId, isPublic);
    res.json({ success: true, type: updated.room_type });
  } catch (err) {
    console.error('setVisibility error:', err);
    res.status(500).json({ error: 'Nepodařilo se změnit viditelnost' });
  }
};

exports.getRoomByCode = async (req, res) => {
  try {
    const room = await Room.findByCode(req.params.code);

    if (!room) {
      return res.status(404).json({ error: 'Místnost nenalezena' });
    }

    if (room.status !== 'WAITING') {
      return res.status(400).json({ error: 'Místnost je plná nebo již hra začala' });
    }

    res.json({ success: true, room });
  } catch (err) {
    console.error('getRoomByCode error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Nejsi přihlášen' });
    }

    const room = await Room.findByCode(req.params.code);

    if (!room) {
      return res.status(404).json({ error: 'Místnost nenalezena' });
    }

    if (room.status !== 'WAITING') {
      return res.status(400).json({ error: 'Místnost je plná nebo již hra začala' });
    }

    if (room.creator_id === req.session.user.id) {
      return res.status(400).json({ error: 'Nemůžeš se připojit do vlastní místnosti' });
    }

    const updated = await Room.join(room.id, req.session.user.id);
    res.json({ success: true, room: updated });
  } catch (err) {
    console.error('joinRoom error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

exports.findPublicRoom = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Nejsi přihlášen' });
    }

    const rooms = await Room.listPublic();

    const available = rooms.filter(r => r.creator_id !== req.session.user.id);

    if (available.length === 0) {
      return res.status(404).json({ error: 'Žádná veřejná místnost není dostupná' });
    }

    // vezme prvni dostupnou
    const room = available[0];
    const updated = await Room.join(room.id, req.session.user.id);

    res.json({ success: true, room: updated });
  } catch (err) {
    console.error('findPublicRoom error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

exports.getFriendsForInvite = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Nejsi přihlášen' });
        }
        const friends = await Friend.getFriends(req.session.user.id);
        res.json({ success: true, friends });
    } catch (err) {
        console.error('getFriendsForInvite error:', err);
        res.status(500).json({ error: 'Chyba serveru při načítání přátel' });
    }
};

exports.sendInvite = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Nejsi přihlášen' });
        }
        const { friendId, roomId } = req.body;
        
        const invitation = await Invitation.create(req.session.user.id, friendId, roomId);
        
        if (!invitation) {
            return res.status(400).json({ error: 'Pozvánka již byla odeslána' });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('sendInvite error:', err);
        res.status(500).json({ error: 'Chyba serveru při odesílání pozvánky' });
    }
};

// Polling
exports.getRoomStatus = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Místnost nenalezena' });
    res.json({ success: true, status: room.status, gameId: room.game_id });
  } catch (err) {
    console.error('getRoomStatus error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

exports.startGame = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
    const room = await Room.findById(req.body.roomId);
    if (!room) return res.status(404).json({ error: 'Místnost nenalezena' });
    if (room.creator_id !== req.session.user.id) return res.status(403).json({ error: 'Nejsi tvůrce' });
    if (room.status !== 'READY') return res.status(400).json({ error: 'Čeká se na druhého hráče' });

    const game = await Game.create(room.creator_id, room.player2_id);
    await Room.startGame(room.id, game.id);

    res.json({ success: true, gameId: game.id });
  } catch (err) {
    console.error('startGame error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

// Čekací stránka pro joineera
exports.getWaitingPage = async (req, res) => {
  try {
    const room = await Room.findByCode(req.params.code);
    if (!room) return res.redirect('/matchmaking/lobby');

    res.render('matchmaking/waiting', {
      title: 'Čekám na hru',
      roomCode: room.invite_code,
    });
  } catch (err) {
    console.error('getWaitingPage error:', err);
    res.redirect('/matchmaking/lobby');
  }
};

// joineer se ptá jestli tvůrce spustil hru
exports.waitForGame = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
    const room = await Room.findByCode(req.params.code);
    if (!room) return res.status(404).json({ error: 'Místnost nenalezena' });
    res.json({ success: true, status: room.status, gameId: room.game_id });
  } catch (err) {
    console.error('waitForGame error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

// pending pozvanky pro prihlaseneho uzivatele
exports.getMyInvitations = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
    const invitations = await Invitation.listByReceiver(req.session.user.id);
    res.json({ success: true, invitations });
  } catch (err) {
    console.error('getMyInvitations error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};

// prijmout pozvanku
exports.acceptInvite = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Nejsi přihlášen' });
    const { invitationId } = req.body;

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) return res.status(404).json({ error: 'Pozvánka nenalezena' });
    if (invitation.receiver_id !== req.session.user.id) return res.status(403).json({ error: 'Není tvoje pozvánka' });

    const room = await Room.findById(invitation.room_id);
    if (!room || room.status !== 'WAITING') {
      return res.status(400).json({ error: 'Místnost již není dostupná' });
    }

    await Room.join(room.id, req.session.user.id);
    await Invitation.updateStatus(invitationId, 'ACCEPTED');

    res.json({ success: true, roomCode: room.invite_code });
  } catch (err) {
    console.error('acceptInvite error:', err);
    res.status(500).json({ error: 'Chyba serveru' });
  }
};