const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZHdicnp6dmZqemhtdm9kbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDk0MTMsImV4cCI6MjA5NDc4NTQxM30.-lEyPhvfEURxejprDWlrs_x5pRGzt7_CWHftf3uUZAA';
const SUPABASE_URL = 'https://fkdwbrzzvfjzhmvodmak.supabase.co';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUsername = "Missing";
let currentUserID = null; // Will be a UUID string now

// Move these to the very top of your chat script
const messagesContainer = document.getElementById("message-list");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const charCounter = document.getElementById("char-counter");
const renameButton = document.getElementById("rename-btn");
const usernameInput = document.getElementById("my-username"); 
async function initChat() {
    // 1. Load Banned Words
    try {
        const response = await fetch('badwords.txt');
        if (response.ok) {
            const fileText = await response.text();
            BANNED_WORDS = fileText.split(/\r?\n/).map(word => word.trim()).filter(word => word.length > 0);
        }
    } catch (err) { console.error("Error reading badwords.txt:", err); }

    // 2. Handle Authentication State
    // This replaces your manual ID generation logic
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        handleUserSignIn(session.user);
    } else {
        // Option: Redirect to a login page or show a login modal
        console.log("No active session found.");
    }
    console.log(session.user);
    // 3. Listen for Auth Changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleUserSignIn(session.user);
        } else if (event === 'SIGNED_OUT') {
            window.location.reload(); 
        }
    });

    // 4. Load Messages
    const { data: existingMessages, error } = await supabaseClient
        .from('chats')
        .select('*')
        .order('created_at', { ascending: true });

    if (!error) {
        existingMessages.forEach(msg => displayMessage(msg));
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
    // 5. Realtime Subscription
    supabaseClient
        .channel('public:chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                if (!document.getElementById(`msg-${payload.new.id}`)) displayMessage(payload.new);
            } else if (payload.eventType === 'UPDATE') {
                const elements = document.querySelectorAll(`.user-${payload.new.user_id}`);
                elements.forEach(el => el.textContent = payload.new.name);
            }
        })
        .subscribe();
    supabaseClient
        .channel('public:banned_users')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'banned_users',
            filter: `user_id=eq.${currentUserID}` // Only listen for changes to THEMSELVES
        }, (payload) => {
            alert("You have been banned by an admin.");
            window.location.reload(); // Refresh to lock them out
        })
        .subscribe();
}

function handleUserSignIn(user) {
    currentUserID = user.id; // This is the real UUID from Supabase
    
    // Use stored username or default to email
    const savedName = localStorage.getItem('username');
    currentUsername = savedName || user.email.split('@')[0]; 
    
    document.getElementById('my-username').value = currentUsername;
    
    // Run your join logic if needed
    if (typeof userJoin === "function") userJoin(currentUserID);
}


async function sendMessage() {
    // Always get the fresh user object to ensure they aren't banned/logged out
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("Please log in to send messages!");
        return;
    }

    let text = messageInput.value.trim();
    if (!text || text.length > 500) return;

    text = filter.clean(text);
    messageInput.value="";
    const { error } = await supabaseClient
        .from('chats')
        .insert([{ 
            user_id: user.id, // Verified UUID
            name: currentUsername, 
            text: text 
        }]);

    if (error) {
        console.error("Postgres rejected the message:", error.message);
        if (error.code === '42501' || error.message.includes("violates check constraint")) {
            alert("❌ You have been banned from this chat.");
            messageInput.disabled = true; // Lock the input
            sendButton.disabled = true;
        } else {
            alert("Error: " + error.message);
        }
    } else {
        messageInput.value = "";
        charCounter.textContent = "0/500";
        scrollToBottom();
    }
}

// Fixed Rename Logic
renameButton.addEventListener("click", async () => {
    const newName = usernameInput.value.trim();
    if (!newName || newName.length > 20) return;

    const checkedName = filter.clean(newName);
    if (checkedName !== newName) {
        alert("Clean up your name!");
        return;
    }

    renameButton.disabled = true;
    renameButton.textContent = "Saving...";

    // Use currentUserID (the UUID) for the update
    const { error } = await supabaseClient
        .from('chats')
        .update({ name: newName })
        .eq('user_id', currentUserID);

    if (!error) {
        currentUsername = newName;
        localStorage.setItem('username', newName);
        alert("Username updated!");
    } else {
        console.error(error);
    }

    renameButton.disabled = false;
    renameButton.textContent = "Rename";
});

function displayMessage(data) {
    const messagesContainer = document.getElementById('message-container');
    if (!messagesContainer) return; 

    // Now correctly compares UUID strings
    const isMine = data.user_id === currentUserID; 

    const date = data.created_at ? new Date(data.created_at) : new Date();
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const messageHtml = `
    <div id="msg-${data.id}" class="message ${isMine ? 'mine' : ''}">
        <div class="message-meta">
            <span class="message-username user-${data.user_id}">${data.name || 'Unknown'}</span>
            <span class="message-time">${formattedTime}</span>
        </div>
        <div class="message-bubble">${data.text || ''}</div>
    </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollToBottom();
}

messageInput.addEventListener("input", () => {
    const textLength = messageInput.value.trim().length;

    charCounter.textContent = `${textLength}/500`;

    // Handle Button State
    if (textLength > 0 && textLength <= 500) {
        sendButton.removeAttribute("disabled");
    } else {
        sendButton.setAttribute("disabled", "");
    }

    // Handle Counter Color
    if (textLength > 500) {
        charCounter.style.color = "red";
    } else {
        charCounter.style.color = ""; 
    }
});

// 6. Trigger Send on Button Click
sendButton.addEventListener("click", sendMessage);

// 7. Trigger Send on pressing 'Enter' (but allow 'Shift + Enter' for new lines)
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !sendButton.hasAttribute("disabled")) {
        e.preventDefault(); // Prevents creating an empty new line row
        sendMessage();
    }
});
function scrollToBottom() {
    const container = document.getElementById("message-container");
    // If the scrollbar is on the parent ".message-list", use that instead:
    // const container = document.querySelector(".message-list");
    
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth' // Use 'auto' for instant jump on load
    });
}