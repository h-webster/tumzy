const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZHdicnp6dmZqemhtdm9kbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDk0MTMsImV4cCI6MjA5NDc4NTQxM30.-lEyPhvfEURxejprDWlrs_x5pRGzt7_CWHftf3uUZAA';
const SUPABASE_URL = 'https://fkdwbrzzvfjzhmvodmak.supabase.co';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const messagesContainer = document.getElementById("message-container");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const charCounter = document.getElementById("char-counter");

let currentUsername = "Missing";
let currentUserID = "-1";

// Initialize Chat App
initChat();

let BANNED_WORDS = []; 
const filter = {
    replacements: {
        'a': '[a4@]',
        'b': '[b8]',
        'e': '[e3]',
        'g': '[g69]',
        'i': '[i1!|l]',
        'l': '[l1!|i]',
        'o': '[o0]',
        's': '[s5$]',
        't': '[t7+]',
        'z': '[z2]'
    },

    clean: function(text) {
        if (!text) return '';
        if (BANNED_WORDS.length === 0) return text; 
        
        let censored = text;

        BANNED_WORDS.forEach(word => {
            if (word.trim().length > 0) {
                const lowerWord = word.toLowerCase();
                
                let pattern = '';
                for (let char of lowerWord) {
                    const escapedChar = char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    pattern += this.replacements[escapedChar] || escapedChar;
                }

                // Inside the loop, change how the RegExp is built:
                const regex = word.length < 4 
                    ? new RegExp(`\\b${pattern}\\b`, 'gi') // Strict for short words
                    : new RegExp(pattern, 'gi');          // Aggressive for longer words

                censored = censored.replace(regex, (match) => '*'.repeat(match.length));
            }
        });

        return censored;
    }
};



async function initChat() {
    try {
        const response = await fetch('badwords.txt');
        if (response.ok) {
            const fileText = await response.text();
            // Split by newlines (\n) or carriage returns (\r) to create the array
            BANNED_WORDS = fileText.split(/\r?\n/).map(word => word.trim()).filter(word => word.length > 0);
            console.log(`Loaded ${BANNED_WORDS.length} bad words from file.`);
        } else {
            console.error("Failed to load badwords.txt status:", response.status);
        }
    } catch (err) {
        console.error("Error reading badwords.txt file:", err);
    }

    // 2. Fetch past messages on load
    // fetch username
    const user = localStorage.getItem('username');
    const userID = localStorage.getItem('userid');
    if (!user) {
        currentUsername = "User_" + Math.floor(Math.random() * 1000);
        localStorage.setItem('username', currentUsername);
    } else {
        currentUsername = user;
    }

    if (!userID) {
        currentUserID = "usr_" + Math.floor(Math.random() * 1000000);
        localStorage.setItem("userid", currentUserID);
    } else {
        currentUserID = userID;
    }
    // set username
    document.getElementById('my-username').value = currentUsername;

    const { data: existingMessages, error } = await supabaseClient
        .from('chats')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching messages:", error);
    } else {
        existingMessages.forEach(msg => displayMessage(msg));
    }

    // 3. Listen for new messages incoming in real-time (Keep for networks where websockets work)
    supabaseClient
        .channel('public:chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
            // if new message
            if (payload.eventType === 'INSERT') {
                if (!document.getElementById(`msg-${payload.new.id}`)) {
                    displayMessage(payload.new);
                }
            } else if (payload.eventType === 'UPDATE') {
                // update username
                const elementsToUpdate = document.querySelectorAll(`.user-${payload.new.user_id}`);
                elementsToUpdate.forEach(el => {
                    el.textContent = payload.new.name;
                });
            }
        })
        .subscribe();

    // Poll the database every 3 seconds for strict network environments
    setInterval(async () => {
        const { data: freshMessages } = await supabaseClient
            .from('chats')
            .select('*')
            .order('created_at', { ascending: true });

        if (freshMessages) {
            freshMessages.forEach(msg => {
                const existingMsgElement = document.getElementById(`msg-${msg.id}`);
                if (!existingMsgElement) {
                    displayMessage(msg);
                } else {
                    // Update name UI if username is changed
                    const nameSpan = document.getElementById(`msg-user-${msg.id}`);
                    if (nameSpan && nameSpan.textContent !== msg.name) {
                        nameSpan.textContent = msg.name;
                    }
                }
            });
        }
    }, 3000); 
}

async function sendMessage() {
    let text = messageInput.value.trim();

    if (text && text.length <= 500) {
        text = filter.clean(text);
        const { error } = await supabaseClient
            .from('chats')
            .insert([{ 
                user_id: currentUserID,
                name: currentUsername, 
                text: text,
            }]);

        if (error) {
            console.error("Error sending message:", error);
        } else {
            messageInput.value = "";
            charCounter.textContent = "0/500";
            sendButton.setAttribute("disabled", "");
        }
    }
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

function displayMessage(data) {
    console.log(data);
    
    const messagesContainer = document.getElementById('message-container');
    if (!messagesContainer) return; 

    const isMine = data.user_id === currentUserID; 

    let formattedTime = '00:00';
    if (data.created_at) {
        const date = new Date(data.created_at);
        formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    const messageHtml = `
    <div id="msg-${data.id}" class="message ${isMine ? 'mine' : ''}">
        <div class="message-meta">
            <span id="msg-user-${data.id}" class="message-username">${data.name || 'Unknown'}</span>
            <span class="message-time">${formattedTime}</span>
        </div>
        <div class="message-bubble">${data.text || ''}</div>
    </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
 
    // Auto scroll down to the newest text
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function changeUsername(newUsername) {
    const cleanedName = newUsername.trim();
    if (cleanedName.length > 0 && cleanedName.length <= 20) {
        currentUsername = cleanedName;
        localStorage.setItem('username', cleanedName);
        document.getElementById('my-username').textContent = cleanedName;

        // Push name change update to Supabase for all past messages
        const { error } = await supabaseClient
            .from('chats')
            .update({ name: cleanedName })
            .eq('user_id', currentUserID);

        if (error) {
            console.error("Error updating past usernames in DB:", error);
        }
    } else {
        alert("Invalid username length (1-20 characters).");
    }
}

/* User renaming */

const renameButton = document.getElementById("rename-btn");
const usernameInput = document.getElementById("my-username");

renameButton.addEventListener("click", async () => {
    const newName = usernameInput.value.trim();

    // Validation: Ensure it isn't empty, hasn't exceeded 20 chars, and is actually a new name
    if (!newName) {
        alert("Username cannot be empty!");
        usernameInput.value = currentUsername; // Reset to old name
        return;
    }
    
    if (newName.length > 20) {
        alert("Username must be 20 characters or less.");
        return;
    }

    const checkedName = filter.clean(newName);
    if (checkedName !== newName) {
        alert("Inappropriate language detected. Please choose a clean username!");
        usernameInput.value = currentUsername; // Reset to their old name
        return; // Block the database submission
    }

    if (newName === currentUsername) {
        alert("That is already your current username!");
        return;
    }

    // Disable UI temporarily to give visual feedback during the network request
    renameButton.disabled = true;
    renameButton.textContent = "Saving...";

    currentUsername = newName;
    localStorage.setItem('username', newName);

    const { error } = await supabaseClient
        .from('chats')
        .update({ name: newName })
        .eq('user_id', currentUserID);

    if (error) {
        console.error("Error updating database username:", error);
        alert("Failed to sync name changes to the database.");
    } else {
        alert("Username updated successfully!");
    }

    // Re-enable UI
    renameButton.disabled = false;
    renameButton.textContent = "Rename";
});