const banInput = document.getElementById("user-ban-input");
const banButton = document.getElementById("confirm-user-ban");
if (banButton) {
    banButton.addEventListener("click", async () => {
        const targetId = banInput.value.trim();

        // Basic UUID format check
        if (targetId.length < 36) {
            alert("Please enter a valid User UUID.");
            return;
        }

        const { error } = await supabaseClient
            .from('banned_users')
            .insert([{ user_id: targetId }]);

        if (error) {
            console.error("Ban failed:", error.message);
            // This error will trigger if the logged-in user is NOT bd37f20c...
            alert("Error: You do not have admin permissions to ban users.");
        } else {
            alert(`User ${targetId} has been successfully banned.`);
            banInput.value = "";
        }
    });
}