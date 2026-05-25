// 1. Sign Up Function
async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Optional: Basic validation
    if(!email || !password) return alert("Please fill in all fields");

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) alert(error.message);
    else alert("Check your email for the confirmation link!");
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
supabaseClient.auth.onAuthStateChange((event, session) => {
    const authContainer = document.getElementById('auth-container');
    const loginPage = document.getElementById('login-page');
    const chatInterface = document.getElementById('chat-interface');

    if (event === 'SIGNED_IN' && session) {
        // Update global state
        currentUserID = session.user.id;
        
        // Use their email as a temporary username if they haven't set one
        if (!localStorage.getItem('username')) {
            currentUsername = session.user.email.split('@')[0];
            localStorage.setItem('username', currentUsername);
        } else {
            currentUsername = localStorage.getItem('username');
        }

        // UI Toggles
        if(authContainer) authContainer.style.display = 'none';
        if(loginPage) loginPage.style.display = 'none';
        if(chatInterface) chatInterface.style.display = 'block';

        // IMPORTANT: Start chat only after we have a user
        // Ensure initChat() in your other file doesn't run automatically on page load
        initChat(); 
        
    } else if (event === 'SIGNED_OUT') {
        // Clear local storage and reset
        localStorage.removeItem('username');
        window.location.reload(); 
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