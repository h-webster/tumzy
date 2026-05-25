async function banUser(targetUserId) {
    // This will only work for YOU because of the RLS policy
    const { error } = await supabaseClient
        .from('banned_users')
        .insert([{ user_id: targetUserId }]);

    if (error) {
        alert("Banning failed: You don't have permission.");
    } else {
        alert("User banned successfully.");
    }
}

function userJoin(userID) {
    if (userID === "usr_788384") {
        
    }
}