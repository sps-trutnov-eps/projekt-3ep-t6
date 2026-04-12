let _invPollInterval = null;

function startInvitationPolling() {
    fetchNotifications();
    _invPollInterval = setInterval(fetchNotifications, 10000);
}

async function fetchNotifications() {
    try {
        const res  = await fetch('/matchmaking/notifications');
        const data = await res.json();
        if (!data.success) return;

        const badge = document.getElementById('inv-badge');
        const list  = document.getElementById('inv-list');
        if (!badge || !list) return;

        const invitations = data.invitations || [];
        const friendRequests = data.friendRequests || [];
        const totalCount = invitations.length + friendRequests.length;

        if (totalCount === 0) {
            badge.style.display = 'none';
            list.innerHTML = '<p style="padding:1rem; color:#7a665d; font-size:0.9rem;">Žádné pozvánky</p>';
            return;
        }

        badge.style.display  = 'flex';
        badge.textContent    = totalCount;
        list.innerHTML       = '';

        // Render Game Invitations
        invitations.forEach(inv => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:0.75rem 1rem; border-bottom:1px solid #e8ddd0; display:flex; justify-content:space-between; align-items:center;';
            item.innerHTML = `
                <span style="font-size:0.9rem; color:#2c3e50;">
                    <strong>${inv.sender_name}</strong> tě zve do hry
                </span>
                <button
                    onclick="acceptInvitation(${inv.id}, this)"
                    style="padding:4px 10px; font-size:0.8rem; background:#cf763b; color:#f5efe8; border:none; border-radius:4px; cursor:pointer; font-family:'MedievalSharp', serif;"
                >
                    Přijmout
                </button>
            `;
            list.appendChild(item);
        });

        // Render Friend Requests
        friendRequests.forEach(req => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:0.75rem 1rem; border-bottom:1px solid #e8ddd0; display:flex; justify-content:space-between; align-items:center; background: #fdfaf6;';
            item.innerHTML = `
                <span style="font-size:0.9rem; color:#2c3e50;">
                    <strong>${req.username}</strong> ti poslal žádost o přátelství
                </span>
                <button
                    onclick="acceptFriendRequest(${req.id}, this)"
                    style="padding:4px 10px; font-size:0.8rem; background:#8d8638; color:#f5efe8; border:none; border-radius:4px; cursor:pointer; font-family:'MedievalSharp', serif;"
                >
                    Přijmout
                </button>
            `;
            list.appendChild(item);
        });

    } catch (err) {
        console.error('fetchNotifications error:', err);
    }
}

async function acceptInvitation(invitationId, btn) {
    btn.disabled    = true;
    btn.textContent = '…';

    try {
        const res  = await fetch('/matchmaking/invitations/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitationId }),
        });
        const data = await res.json();

        if (!data.success) {
            alert(data.error || 'Chyba při přijímání pozvánky');
            btn.disabled    = false;
            btn.textContent = 'Přijmout';
            return;
        }

        window.location.href = `/matchmaking/waiting/${data.roomCode}`;
    } catch (err) {
        console.error('acceptInvitation error:', err);
        btn.disabled    = false;
        btn.textContent = 'Přijmout';
    }
}

async function acceptFriendRequest(friendId, btn) {
    btn.disabled = true;
    btn.textContent = '…';

    try {
        const res = await fetch('/friends/accept-ajax', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId }),
        });
        const data = await res.json();

        if (!data.success) {
            alert(data.error || 'Chyba při přijímání žádosti o přátelství');
            btn.disabled = false;
            btn.textContent = 'Přijmout';
            return;
        }

        // Refresh notifications to remove the accepted request
        fetchNotifications();
    } catch (err) {
        console.error('acceptFriendRequest error:', err);
        btn.disabled = false;
        btn.textContent = 'Přijmout';
    }
}

function toggleInvitations(e) {
    e.preventDefault();
    const dropdown = document.getElementById('inv-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('inv-dropdown');
    if (!dropdown) return;
    if (!dropdown.contains(e.target) && !e.target.closest('a[onclick="toggleInvitations(event)"]')) {
        dropdown.style.display = 'none';
    }
});

if (document.getElementById('inv-badge')) {
    startInvitationPolling();
}
