// 1. Sign Up Function
async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if(!email || !password) return alert("Please fill in all fields");

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        // If the user exists, tell them to login instead
        if (error.message.includes("already registered")) {
            alert("This email is already registered. Please click Login instead!");
        } else {
            alert(error.message);
        }
    } else {
        alert("Confirmation email sent! Check your inbox.");
    }
}

// 2. Login Function
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) alert(error.message);
}

// 3. The Auth "Brain"
// This handles the UI toggle and starts the chat logic
// REVISED AUTH BRAIN
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    const authContainer = document.getElementById('auth-container');
    const loginPage = document.getElementById('login-page');
    const chatInterface = document.getElementById('chat-interface');

    // 1. If we have a session, validate the user
    if (session) {
        const user = session.user;

        // Check if email is confirmed
        if (!user.email_confirmed_at) {
            // If they just signed in/up, tell them to confirm
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                alert("Please check your inbox and confirm your email!");
                await supabaseClient.auth.signOut();
            }
            return;
        }

        // Setup User State
        currentUserID = user.id;
        currentUsername = localStorage.getItem('username') || user.email.split('@')[0];

        // UI Toggles - Ensure these IDs match your HTML exactly!
        if (authContainer) authContainer.style.display = 'none';
        if (loginPage) loginPage.style.display = 'none';
        if (chatInterface) chatInterface.style.display = 'block';
        
        // Start Chat
        initChat();

    } else if (event === 'SIGNED_OUT') {
        // Only reload if they were actually in the chat
        if (chatInterface && chatInterface.style.display === 'block') {
            localStorage.removeItem('username');
            window.location.reload();
        }
    }
});

// Event Listeners
document.getElementById('login-btn').addEventListener('click', login);
document.getElementById('signup-btn').addEventListener('click', signUp);

// Optional: Logout button (add this to your chat UI)
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => supabaseClient.auth.signOut());
}