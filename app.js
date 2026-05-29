const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZHdicnp6dmZqemhtdm9kbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDk0MTMsImV4cCI6MjA5NDc4NTQxM30.-lEyPhvfEURxejprDWlrs_x5pRGzt7_CWHftf3uUZAA';
const SUPABASE_URL = 'https://fkdwbrzzvfjzhmvodmak.supabase.co';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUsername = "Missing";
let currentUserID = null; // Will be a UUID string now

let typingTimeout = null;
const typingIndicator = document.getElementById("typing-indicator");
let chatChannel = null;
let chatInitialized = false;

// Move these to the very top of your chat script
const messagesContainer = document.getElementById("message-list");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const charCounter = document.getElementById("char-counter");
const renameButton = document.getElementById("rename-btn");
const usernameInput = document.getElementById("my-username"); 
async function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;
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
    console.log(session);
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
        const container = document.getElementById('message-container');
        container.innerHTML = ''; // Clear history to prevent doubles
        existingMessages.forEach(msg => displayMessage(msg));
        setTimeout(() => {
            // set timeout to wait for it to load
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
    // 5. Realtime Subscription
    chatChannel = supabaseClient.channel('room:global:chats');
    chatChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, (payload) => {
            if (!document.getElementById(`msg-${payload.new.id}`)) {
                displayMessage(payload.new);
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, (payload) => {
            // Handle name updates across all messages from this user
            const row = payload.new;
            const elements = document.querySelectorAll(`.user-${payload.new.user_id}`);
            elements.forEach(el => el.textContent = payload.new.name);
        })
        .on('presence', { event: 'sync' }, () => {
            updateTypingUI(chatChannel.presenceState());
        })
        .on('presence', { event: 'join' }, () => {
            updateTypingUI(chatChannel.presenceState());
        })
        .on('presence', { event: 'leave' }, () => {
            updateTypingUI(chatChannel.presenceState());
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Connected to Realtime!");
                await chatChannel.track({
                    user: currentUsername,
                    isTyping: false
                });
            }
        });
    
    if (currentUserID) subscribeToBans(currentUserID);
   /*
   const chatChannel = supabaseClient.channel('public:chats');

    chatChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, (payload) => {
            if (!document.getElementById(`msg-${payload.new.id}`)) displayMessage(payload.new);
        })
        .on('presence', { event: 'sync' }, () => {
            const state = chatChannel.presenceState();
            updateTypingUI(state);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // This tracks the user as "Online" initially
                await chatChannel.track({
                    user: currentUsername,
                    isTyping: false
                });
            }
        });
        */
}

function subscribeToBans(userId) {
    supabaseClient
        .channel(`bans-${userId}`) // Unique channel name
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'banned_users',
            filter: `user_id=eq.${userId}` 
        }, (payload) => {
            alert("You have been banned by an admin.");
            window.location.reload();
        })
        .subscribe();
}

function updateTypingUI(presenceState) {
    const typingUsers = [];
    
    // Iterate through all connected users in the presence state
    Object.values(presenceState).forEach(userPresences => {
        userPresences.forEach(p => {
            // If they are typing and NOT us, add to list
            if (p.isTyping && p.user !== currentUsername) {
                typingUsers.push(p.user);
            }
        });
    });

    if (typingUsers.length === 0) {
        typingIndicator.textContent = "";
    } else if (typingUsers.length === 1) {
        typingIndicator.textContent = `${typingUsers[0]} is typing...`;
    } else {
        typingIndicator.textContent = "Multiple people are typing...";
    }
}

function handleUserSignIn(user) {
    currentUserID = user.id; // This is the real UUID from Supabase
    
    // Use stored username or default to email
    const savedName = localStorage.getItem('username');
    currentUsername = savedName || user.email.split('@')[0]; 
    
    document.getElementById('my-username').value = currentUsername;
    
    // Run your join logic if needed
    if (typeof userJoin === "function") userJoin(currentUserID);

    // still blocks random user from changing this to their uuid
    console.log(currentUserID);
    const banContainer = document.getElementById("user-banning");
    if (currentUserID == "f4554478-77a1-4c25-bc9e-a54a080cbdf5") {
        banContainer.style.display = "block";
    } else {
        banContainer.style.display = "none";
    }
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

    if (chatChannel && chatChannel.state === 'joined') {
        chatChannel.track({
            user: currentUsername,
            isTyping: false
        });
    }
    clearTimeout(typingTimeout);

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
        /*
        if (error) {
           // Replace your current error block with this:
            if (error) {
                console.error("FULL DATABASE ERROR:", error); // Look at this in your browser console!
                alert("DB says: " + error.message + " (Code: " + error.code + ")");
            }
            return; 
        }
        */
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
        // after currentUsername updated
        if (chatChannel && chatChannel.state === 'joined') {
            await chatChannel.track({ user: currentUsername, isTyping: false });
        }
    } else {
        console.error(error);
    }

    renameButton.disabled = false;
    renameButton.textContent = "Rename";
});

function displayMessage(data) {
    const messagesContainer = document.getElementById('message-container');
    if (!messagesContainer) return; 

    if (document.getElementById(`msg-${data.id}`)) {
        return; 
    }
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

messageInput.addEventListener("input", async () => {
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


    if (chatChannel) {
        clearTimeout(typingTimeout);
        if (textLength > 0) {
            await chatChannel.track({ user: currentUsername, isTyping: true });
            typingTimeout = setTimeout(async () => {
                await chatChannel.track({ user: currentUsername, isTyping: false });
            }, 2000);
        } else {
            await chatChannel.track({ user: currentUsername, isTyping: false });
        }
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