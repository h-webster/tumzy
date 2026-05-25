const banInput = document.getElementById("user-ban-input");
const banButton = document.getElementById("confirm-user-ban");

banButton.addEventListener("click", async () => {
    const targetId = banInput.value.trim();

    // Basic UUID format check (8-4-4-4-12 characters)
    if (targetId.length < 36) {
        alert("Please enter a valid User UUID.");
        return;
    }

    const { error } = await supabaseClient
        .from('banned_users')
        .insert([{ user_id: targetId }]);

    if (error) {
        console.error("Ban failed:", error.message);
        alert("Error: You likely don't have admin permissions.");
    } else {
        alert(`User ${targetId} has been banned.`);
        banInput.value = "";
    }
});