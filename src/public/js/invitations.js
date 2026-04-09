let _invPollInterval = null;

function startInvitationPolling() {
    fetchInvitations();
    _invPollInterval = setInterval(fetchInvitations, 10000);
}

async function fetchInvitations() {
    try {
        const res  = await fetch('/matchmaking/invitations');
        const data = await res.json();
        if (!data.success) return;

        const badge = document.getElementById('inv-badge');
        const list  = document.getElementById('inv-list');
        if (!badge || !list) return;

        const invitations = data.invitations;

        if (invitations.length === 0) {
            badge.style.display = 'none';
            list.innerHTML = '<p style="padding:1rem; color:#7a665d; font-size:0.9rem;">Žádné pozvánky</p>';
            return;
        }

        badge.style.display  = 'flex';
        badge.textContent    = invitations.length;
        list.innerHTML       = '';

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

    } catch (err) {
        console.error('fetchInvitations error:', err);
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

        // presmerovani na cekaci mistnost
        window.location.href = `/matchmaking/waiting/${data.roomCode}`;
    } catch (err) {
        console.error('acceptInvitation error:', err);
        btn.disabled    = false;
        btn.textContent = 'Přijmout';
    }
}

function toggleInvitations(e) {
    e.preventDefault();
    const dropdown = document.getElementById('inv-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// zavreni dropdownu kliknutim mimo nej
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