const Room = require('../models/roomModel');

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