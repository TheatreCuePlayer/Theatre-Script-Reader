export function parseScript(text) {
    const lines = text.split('\n');
    const scriptNodes = [];
    const pronunciationDictionary = {};

    let currentId = 1;
    let currentLineId = 1;
    let inPronunciationBlock = false;

    const pushNode = (type, character, nodeText) => {
        if (!nodeText) return;
        scriptNodes.push({
            id: currentId++,
            lineId: currentLineId,
            type,
            character,
            text: nodeText
        });
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i].trim();
        if (!rawLine) continue; // skip empty lines

        // Parse pronunciation block
        if (rawLine === '@PRONUNCIATION') {
            inPronunciationBlock = true;
            continue;
        }
        if (rawLine === '@END_PRONUNCIATION') {
            inPronunciationBlock = false;
            continue;
        }
        if (inPronunciationBlock) {
            const parts = rawLine.split('=');
            if (parts.length === 2) {
                pronunciationDictionary[parts[0].trim()] = parts[1].trim();
            }
            continue;
        }

        // Headers starting with ### = FRENCH_SCENE
        if (rawLine.startsWith('###')) {
            pushNode('FRENCH_SCENE', null, rawLine.replace(/^###\s*/, ''));
        }
        // Headers starting with ## = SCENE
        else if (rawLine.startsWith('##')) {
            pushNode('SCENE', null, rawLine.replace(/^##\s*/, ''));
        }
        // Headers starting with # = ACT
        else if (rawLine.startsWith('#')) {
            pushNode('ACT', null, rawLine.replace(/^#\s*/, ''));
        }
        // Text enclosed entirely in brackets [like this]
        else if (/^\[.*\]$/.test(rawLine)) {
            pushNode('DIRECTION', 'STAGE DIRECTIONS', rawLine);
        }
        // Words in ALL CAPS followed by a colon JOHN: = DIALOGUE
        else {
            const match = rawLine.match(/^([A-Z\s]+):\s*(.*)$/);
            if (match) {
                const character = match[1].trim();
                const remainingText = match[2].trim();

                if (character === 'BLACKOUT' || character === 'THE END') {
                    pushNode('DIRECTION', 'STAGE DIRECTIONS', rawLine);
                } else {
                    // Split by inline directions: [waves]
                    const parts = remainingText.split(/(\[[^\]]+\])/g);
                    for (const part of parts) {
                        if (!part) continue;
                        if (part.startsWith('[') && part.endsWith(']')) {
                            pushNode('DIRECTION', 'STAGE DIRECTIONS', part);
                        } else {
                            pushNode('DIALOGUE', character, part);
                        }
                    }
                }
            } else {
                // If a line does not contain a colon immediately following the capitalized starting words,
                // it MUST be assigned to the universal "Stage Directions" role.
                pushNode('DIRECTION', 'STAGE DIRECTIONS', rawLine);
            }
        }
        currentLineId++; // Group inline nodes together manually via this ID
    }

    return { scriptNodes, pronunciationDictionary };
}
