
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