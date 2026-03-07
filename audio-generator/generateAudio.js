require('dotenv').config();
const fs = require('fs');
const path = require('path');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    console.error("ERROR: GOOGLE_API_KEY not found in .env file");
    process.exit(1);
}

const SCRIPT_FILE = path.join(__dirname, 'script.txt');
const AUDIO_DIR = path.join(__dirname, 'audio');
const OUTPUT_JSON = path.join(__dirname, 'script.json');
const TEST_MODE = false;

const VOICE_MAP = {
    "ANTIGONE": "en-US-Neural2-F",
    "ISMENE": "en-US-Neural2-C",
    "PRESS SECRETARY": "en-US-Neural2-G",
    "THE DIRECTOR": "en-US-Neural2-D",
    "THE DESK CLERK": "en-US-Neural2-E",
    "HAEMON": "en-US-Neural2-J",
    "EURYDICE": "en-US-Neural2-H",
    "THE FORMER DIRECTOR": "en-US-Neural2-I",
    "THE INVESTOR": "en-US-Neural2-I",
    "LEGACY REPORTER 1": "en-US-Wavenet-A",
    "LEGACY REPORTER 2": "en-US-Wavenet-C",
    "INDEPENDENT REPORTER 1": "en-US-Wavenet-D",
    "INDEPENDENT REPORTER 2": "en-US-Wavenet-E",

    // Group Voices
    "PRESS POOL": "en-US-Wavenet-A",
    "THE PRESS POOL": "en-US-Wavenet-B",
    "LEGACY MEDIA": "en-US-Wavenet-C",
    "INDEPENDENT MEDIA": "en-US-Wavenet-D"
};

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Adapted from parser.js but built for Node execution
function parseScript(text) {
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
        if (!rawLine) continue;

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

        if (rawLine.startsWith('###')) {
            pushNode('FRENCH_SCENE', null, rawLine.replace(/^###\s*/, ''));
        } else if (rawLine.startsWith('##')) {
            pushNode('SCENE', null, rawLine.replace(/^##\s*/, ''));
        } else if (rawLine.startsWith('#')) {
            pushNode('ACT', null, rawLine.replace(/^#\s*/, ''));
        } else if (/^\[.*\]$/.test(rawLine) || /^\(.*\)$/.test(rawLine)) {
            pushNode('DIRECTION', 'STAGE DIRECTIONS', rawLine);
        } else {
            const match = rawLine.match(/^([A-Z0-9\s]+):\s*(.*)$/);
            if (match) {
                const character = match[1].trim();
                const remainingText = match[2].trim();

                if (character === 'BLACKOUT' || character === 'THE END') {
                    pushNode('DIRECTION', 'STAGE DIRECTIONS', rawLine);
                } else {
                    const parts = remainingText.split(/(\[[^\]]+\]|\([^)]+\))/g);
                    for (const part of parts) {
                        if (!part) continue;
                        if ((part.startsWith('[') && part.endsWith(']')) || (part.startsWith('(') && part.endsWith(')'))) {
                            pushNode('DIRECTION', 'STAGE DIRECTIONS', part);
                        } else {
                            pushNode('DIALOGUE', character, part);
                        }
                    }
                }
            } else {
                pushNode('DIRECTION', 'STAGE DIRECTIONS', rawLine);
            }
        }
        currentLineId++;
    }

    return { scriptNodes, pronunciationDictionary };
}

// Strip out any brackets or parenthesis logic from the raw spoken text
function cleanDialogueText(text) {
    let clean = text.replace(/\[[^\]]+\]/g, ' ').replace(/\([^)]+\)/g, ' ');
    return clean.replace(/\s+/g, ' ').trim();
}

// Generate MP3 from Google TTS
async function fetchGoogleCloudAudio(text, voiceId) {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;
    const payload = {
        input: { text },
        voice: { languageCode: 'en-US', name: voiceId },
        audioConfig: { audioEncoding: 'MP3' }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.audioContent) {
        return Buffer.from(data.audioContent, 'base64');
    }
    throw new Error(data.error?.message || "Google Cloud TTS Failed");
}

async function run() {
    console.log("Reading script...");
    if (!fs.existsSync(SCRIPT_FILE)) {
        console.error(`Script file completely missing from expected path ${SCRIPT_FILE}. Skipping execution...`);
        return;
    }
    const rawText = fs.readFileSync(SCRIPT_FILE, 'utf-8');
    const { scriptNodes, pronunciationDictionary } = parseScript(rawText);

    console.log(`Parsed ${scriptNodes.length} nodes from script.`);

    let generatedCount = 0;
    const finalJSON = [];

    for (let i = 0; i < scriptNodes.length; i++) {
        const node = scriptNodes[i];
        const lineIdString = `line_${String(node.id).padStart(4, '0')}`;

        if (TEST_MODE && generatedCount >= 20) {
            console.log("TEST_MODE 20-line limit reached. Stopping generation sequence.");
            break;
        }

        const jsonEntry = {
            id: lineIdString,
            character: node.character || null,
            text: node.text,
            audioUrl: null
        };

        if (node.type === 'DIALOGUE') {
            const voiceId = VOICE_MAP[node.character];

            if (voiceId) {
                // Apply Dictionary
                let speakableText = node.text;
                Object.entries(pronunciationDictionary).forEach(([key, value]) => {
                    const regex = new RegExp(`\\b${key}\\b`, 'gi');
                    speakableText = speakableText.replace(regex, value);
                });

                // Strip remaining parentheticals
                speakableText = cleanDialogueText(speakableText);

                if (speakableText.length > 0) {
                    try {
                        console.log(`[${generatedCount + 1}] Fetching MP3 for ${node.character}: "${speakableText.substring(0, 30)}..."`);
                        const audioBuffer = await fetchGoogleCloudAudio(speakableText, voiceId);

                        const mp3Path = path.join(AUDIO_DIR, `${lineIdString}.mp3`);
                        fs.writeFileSync(mp3Path, audioBuffer);
                        jsonEntry.audioUrl = `audio/${lineIdString}.mp3`;

                        generatedCount++;

                        // Google TTS Rate Limit prevention buffer
                        await new Promise(res => setTimeout(res, 300));
                    } catch (err) {
                        console.error(`Failed to generate audio for node ${node.id}:`, err);
                    }
                }
            } else {
                console.log(`Skipping dialogue generation for ${node.character} (No voice mapping found).`);
            }
        }

        finalJSON.push(jsonEntry);
    }

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalJSON, null, 2));
    console.log(`Finished! Generated ${generatedCount} audio files.`);
    console.log(`Output metadata written to ${OUTPUT_JSON}`);
}

run();
