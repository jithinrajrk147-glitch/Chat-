// State
let peer = null;
let conn = null;
let currentSpace = null;
let spaces = JSON.parse(localStorage.getItem('spaces') || '[]');
let friends = JSON.parse(localStorage.getItem('friends') || '[]');
let isDrawing = false;
let currentColor = '#000000';
let lastX = 0, lastY = 0;
let localStream = null;
let micEnabled = false;
let call = null;

// Elements
const dashboardScreen = document.getElementById('dashboardScreen');
const roomScreen = document.getElementById('roomScreen');
const createSpaceBtn = document.getElementById('createSpaceBtn');
const createModal = document.getElementById('createModal');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const confirmCreateBtn = document.getElementById('confirmCreateBtn');
const spaceNameInput = document.getElementById('spaceNameInput');
const maxPeopleInput = document.getElementById('maxPeopleInput');
const spaceDescInput = document.getElementById('spaceDescInput');
const spacesGrid = document.getElementById('spacesGrid');
const friendsGrid = document.getElementById('friendsGrid');
const backBtn = document.getElementById('backBtn');
const roomName = document.getElementById('roomName');
const peerCount = document.getElementById('peerCount');
const micBtn = document.getElementById('micBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const addFriendBtn = document.getElementById('addFriendBtn');
const shareBtn = document.getElementById('shareBtn');
const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShareBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const spaceLink = document.getElementById('spaceLink');
const messages = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');

function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height - 48;
}

window.addEventListener('resize', resizeCanvas);

// Load spaces on init
function renderSpaces() {
    if (spaces.length === 0) {
        spacesGrid.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <p>No spaces yet. Create your first space!</p>
            </div>
        `;
    } else {
        spacesGrid.innerHTML = spaces.map(space => `
            <div class="space-card" data-id="${space.id}">
                <div class="space-card-header">
                    <div>
                        <div class="space-name">${space.name}</div>
                        <div class="space-meta">
                            <span>${space.maxPeople} people max</span>
                            <span>•</span>
                            <span>${new Date(space.created).toLocaleDateString()}</span>
                        </div>
                    <div class="space-badge">Active</div>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.space-card').forEach(card => {
            card.addEventListener('click', () => {
                const space = spaces.find(s => s.id === card.dataset.id);
                enterSpace(space);
            });
        });
    }
}

renderSpaces();

// Create Space Flow
createSpaceBtn.addEventListener('click', () => {
    createModal.classList.add('active');
    spaceNameInput.value = '';
    spaceDescInput.value = '';
    maxPeopleInput.value = '5';
});

cancelCreateBtn.addEventListener('click', () => {
    createModal.classList.remove('active');
});

confirmCreateBtn.addEventListener('click', async () => {
    const name = spaceNameInput.value.trim() || 'Untitled Space';
    const maxPeople = parseInt(maxPeopleInput.value);
    const desc = spaceDescInput.value.trim();

    confirmCreateBtn.textContent = 'Creating...';
    confirmCreateBtn.disabled = true;

    const spaceId = await generateSpaceId();
    const space = {
        id: spaceId,
        name,
        desc,
        maxPeople,
        created: Date.now(),
        url: `${window.location.origin}${window.location.pathname}?space=${spaceId}`
    };

    spaces.unshift(space);
    localStorage.setItem('spaces', JSON.stringify(spaces));
    renderSpaces();

    createModal.classList.remove('active');
    confirmCreateBtn.textContent = 'Create Space';
    confirmCreateBtn.disabled = false;

    enterSpace(space);
});

async function generateSpaceId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hash = await crypto.subtle.digest('SHA-256', array);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt('0x' + hex);
    let id = '';
    while (num > 0) {
        id = BASE58[Number(num % 58n)] + id;
        num = num / 58n;
    }
    return id.slice(0, 12);
}

// Enter Space
async function enterSpace(space) {
    currentSpace = space;
    roomName.textContent = space.name;
    showScreen(roomScreen);
    setTimeout(resizeCanvas, 50);

    peer = new Peer(space.id, {
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    peer.on('open', () => {
        peerCount.textContent = 'Waiting for others';
        spaceLink.textContent = space.url;
        document.getElementById('qrcode').innerHTML = '';
        new QRCode(document.getElementById('qrcode'), {
            text: space.url,
            width: 200,
            height: 200,
            colorDark: '#0a1f14',
            colorLight: '#ffffff',
        });
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
    });

    peer.on('call', async (incomingCall) => {
        try {
            if (!localStream) {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
            incomingCall.answer(localStream);
            call = incomingCall;
            call.on('stream', (remoteStream) => {
                const audio = new Audio();
                audio.srcObject = remoteStream;
                audio.play();
            });
            micEnabled = true;
            micBtn.classList.add('active');
        } catch (err) {
            console.error('Call answer error:', err);
        }
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
    });
}

function setupConnection() {
    conn.on('open', () => {
        peerCount.textContent = '1 peer connected';
    });

    conn.on('data', (data) => {
        if (typeof data === 'string') {
            addMessage(data, 'peer');
        } else if (data.type === 'draw') {
            ctx.strokeStyle = data.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(data.x1, data.y1);
            ctx.lineTo(data.x2, data.y2);
            ctx.stroke();
        } else if (data.type === 'clear') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

    conn.on('close', () => {
        peerCount.textContent = 'Peer disconnected';
    });
}

// Back to dashboard
backBtn.addEventListener('click', () => {
    if (peer) peer.destroy();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    peer = null;
    conn = null;
    localStream = null;
    micEnabled = false;
    micBtn.classList.remove('active');
    messages.innerHTML = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showScreen(dashboardScreen);
});

// Drawing
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
    });
});

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX || e.touches[0].clientX) - rect.left,
        y: (e.clientY || e.touches[0].clientY) - rect.top
    };
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x; lastY = pos.y;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (conn && conn.open) {
        conn.send({ type: 'draw', x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color: currentColor });
    }
    lastX = pos.x; lastY = pos.y;
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('touchstart', (e) => { isDrawing = true; const pos = getPos(e); lastX = pos.x; lastY = pos.y; });
canvas.addEventListener('touchmove', (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (conn && conn.open) {
        conn.send({ type: 'draw', x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color: currentColor });
    }
    lastX = pos.x; lastY = pos.y;
});
canvas.addEventListener('touchend', () => isDrawing = false);

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (conn && conn.open) conn.send({ type: 'clear' });
});

// Chat
sendBtn.addEventListener('click', sendMsg);
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsg(); });

function sendMsg() {
    const text = msgInput.value.trim();
    if (!text) return;
    addMessage(text, 'me');
    if (conn && conn.open) conn.send(text);
    msgInput.value = '';
}

function addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `msg ${type}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

// Mic Toggle
micBtn.addEventListener('click', async () => {
    try {
        if (!micEnabled) {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            micEnabled = true;
            micBtn.classList.add('active');
            
            if (conn && conn.open) {
                call = peer.call(conn.peer, localStream);
                call.on('stream', (remoteStream) => {
                    const audio = new Audio();
                    audio.srcObject = remoteStream;
                    audio.play();
                });
            }
        } else {
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
                localStream = null;
            }
            if (call) {
                call.close();
                call = null;
            }
            micEnabled = false;
            micBtn.classList.remove('active');
        }
    } catch (err) {
        alert('Mic permission denied');
        console.error(err);
    }
});

// Fullscreen Toggle
fullscreenBtn.addEventListener('click', () => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});

// Add Friend Button - opens share modal
addFriendBtn.addEventListener('click', () => {
    shareModal.classList.add('active');
});

// Share Modal
shareBtn.addEventListener('click', () => {
    shareModal.classList.add('active');
});

closeShareBtn.addEventListener('click', () => {
    shareModal.classList.remove('active');
});

copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(spaceLink.textContent);
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => copyLinkBtn.textContent = 'Copy', 2000);
});

// Auto-join from URL
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const spaceId = params.get('space');
    if (spaceId) {
        const space = spaces.find(s => s.id === spaceId);
        if (space) {
            enterSpace(space);
        } else {
            // Join as guest
            const guestSpace = {
                id: spaceId,
                name: 'Shared Space',
                maxPeople: 10,
                created: Date.now(),
                url: window.location.href
            };
            enterSpace(guestSpace);
        }
    }
});