import React, { useState, useEffect } from 'react';
import { Upload, FileText, Settings, Play, DownloadCloud, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

// Helper to strip brackets out of spoken dialogue test strings
function cleanDialogueText(text) {
    let clean = text.replace(/\[[^\]]+\]/g, ' ').replace(/\([^)]+\)/g, ' ');
    return clean.replace(/\s+/g, ' ').trim();
}

const AVAILABLE_VOICES = [
    "Skip/Mute",
    "en-US-Neural2-A", "en-US-Neural2-C", "en-US-Neural2-D", "en-US-Neural2-E",
    "en-US-Neural2-F", "en-US-Neural2-G", "en-US-Neural2-H", "en-US-Neural2-I", "en-US-Neural2-J",
    "en-US-Wavenet-A", "en-US-Wavenet-B", "en-US-Wavenet-C", "en-US-Wavenet-D",
    "en-US-Wavenet-E", "en-US-Wavenet-F", "en-US-Wavenet-G", "en-US-Wavenet-H",
    "en-US-Wavenet-I", "en-US-Wavenet-J",
    "en-US-Journey-F", "en-US-Journey-D"
];

function Studio() {
    const [fileName, setFileName] = useState('No script loaded');
    const [masterScript, setMasterScript] = useState([]);
    const [pronunciationDictionary, setPronunciationDictionary] = useState({});

    // Voice Mapping Table State: { "ANTIGONE": { voice: "en-US-Neural2-F", speed: 1.0 } }
    const [voiceConfig, setVoiceConfig] = useState({});

    // Settings & Generation State
    const [apiKey, setApiKey] = useState('');
    const [startLine, setStartLine] = useState(1);
    const [endLine, setEndLine] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);

    // Load saved API key on mount
    useEffect(() => {
        const savedKeys = localStorage.getItem('rehearsal-api-keys');
        if (savedKeys) {
            try {
                const parsed = JSON.parse(savedKeys);
                if (parsed.google) setApiKey(parsed.google);
            } catch (e) {
                console.error("Failed to load API key in Studio", e);
            }
        }
    }, []);

    const handleApiKeyChange = (val) => {
        setApiKey(val);
        const existing = JSON.parse(localStorage.getItem('rehearsal-api-keys') || '{}');
        localStorage.setItem('rehearsal-api-keys', JSON.stringify({ ...existing, google: val }));
    };

    // ==========================================
    // PARSER LOGIC
    // ==========================================
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();

        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            const parsedNodes = [];
            const dict = {};
            let inPronunciationBlock = false;
            let currentLineNumber = 1;

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
                        dict[parts[0].trim()] = parts[1].trim();
                    }
                    continue;
                }

                if (rawLine.startsWith('#')) {
                    continue; // Skip headers for JSON
                }

                // Node Creation Loop
                const match = rawLine.match(/^([A-Z0-9\s]+):\s*(.*)$/);
                if (match) {
                    const character = match[1].trim();
                    const remainingText = match[2].trim();

                    if (character === 'BLACKOUT' || character === 'THE END') {
                        parsedNodes.push({
                            id: `line_${String(currentLineNumber++).padStart(4, '0')}`,
                            character: "STAGE DIRECTIONS",
                            originalText: rawLine,
                            audioUrl: null
                        });
                    } else {
                        // Split inline bracket directions
                        const parts = remainingText.split(/(\([^)]+\)|\[[^\]]+\])/g);

                        for (const part of parts) {
                            const trimmedPart = part.trim();
                            if (!trimmedPart) continue;

                            if ((trimmedPart.startsWith('[') && trimmedPart.endsWith(']')) ||
                                (trimmedPart.startsWith('(') && trimmedPart.endsWith(')'))) {
                                parsedNodes.push({
                                    id: `line_${String(currentLineNumber++).padStart(4, '0')}`,
                                    character: "INLINE STAGE DIRECTIONS",
                                    originalText: trimmedPart,
                                    audioUrl: null
                                });
                            } else {
                                parsedNodes.push({
                                    id: `line_${String(currentLineNumber++).padStart(4, '0')}`,
                                    character: character,
                                    originalText: trimmedPart,
                                    audioUrl: null // Wait for ZIP to populate
                                });
                            }
                        }
                    }
                } else {
                    // Entire line is a stage direction
                    parsedNodes.push({
                        id: `line_${String(currentLineNumber++).padStart(4, '0')}`,
                        character: "STAGE DIRECTIONS",
                        originalText: rawLine,
                        audioUrl: null
                    });
                }
            }

            setMasterScript(parsedNodes);
            setPronunciationDictionary(dict);
            setEndLine(parsedNodes.length);

            // Seed unique characters in voiceConfig
            const uniqueChars = new Set();
            parsedNodes.forEach(n => {
                if (n.character) uniqueChars.add(n.character);
            });

            const initialConfig = {};
            Array.from(uniqueChars).sort().forEach(char => {
                initialConfig[char] = { voice: "Skip/Mute", speed: 1.0, pitch: 0.0 };
            });
            setVoiceConfig(initialConfig);
        };

        reader.readAsText(file);
        e.target.value = ''; // Reset
    };

    const updateConfig = (character, key, value) => {
        setVoiceConfig(prev => ({
            ...prev,
            [character]: {
                ...prev[character],
                [key]: value
            }
        }));
    };

    // ==========================================
    // TTS GOOGLE FETCHER & TESTER
    // ==========================================

    // Quick test play using new Audio
    const testVoice = async (character) => {
        if (!apiKey) return alert("Please enter a Google API Key.");
        const config = voiceConfig[character];
        if (!config || config.voice === "Skip/Mute") return alert("Select a valid voice first.");

        const text = `Testing voice for ${character}.`;

        try {
            const payload = {
                input: { text },
                voice: { languageCode: 'en-US', name: config.voice },
                audioConfig: { audioEncoding: 'MP3', speakingRate: config.speed, pitch: config.pitch || 0.0 }
            };

            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.audioContent) {
                const audioBlob = `data:audio/mp3;base64,${data.audioContent}`;
                const audio = new Audio(audioBlob);
                audio.play();
            } else {
                throw new Error(data.error?.message || "Unknown API Error");
            }
        } catch (err) {
            console.error("Test failed:", err);
            alert("TTS Test Failed: " + err.message);
        }
    };

    // Master Generator Function
    const generateAudioZip = async () => {
        if (!apiKey) return alert("Please provide a Google API Key.");
        if (masterScript.length === 0) return alert("Please load a script first.");

        setIsGenerating(true);
        setGenerationProgress(0);

        try {
            const zip = new JSZip();
            const audioFolder = zip.folder("audio");

            // Build the final manifest by deep cloning and attaching the URL
            const sliceStart = Math.max(0, startLine - 1);
            const sliceEnd = Math.min(masterScript.length, endLine);
            const scriptSlice = masterScript.slice(sliceStart, sliceEnd);

            // We'll write the *entire* parsed array to the JSON file,
            // but we only *generate* MP3s for the requested slice.
            const fullJsonManifest = [...masterScript];

            let count = 0;
            const totalToProcess = scriptSlice.length;

            for (let i = 0; i < scriptSlice.length; i++) {
                const node = scriptSlice[i];
                const config = voiceConfig[node.character];

                count++;
                setGenerationProgress(Math.floor((count / totalToProcess) * 100));

                if (!config || config.voice === "Skip/Mute") {
                    continue; // Skip generation
                }

                // Apply Pronunciation Dictionary
                let speakableText = node.originalText;
                Object.entries(pronunciationDictionary).forEach(([key, value]) => {
                    const regex = new RegExp(`\\b${key}\\b`, 'gi');
                    speakableText = speakableText.replace(regex, value);
                });

                // Clean out parentheticals/brackets from being spoken
                speakableText = cleanDialogueText(speakableText);

                if (speakableText.length === 0) continue; // Nothing to say

                // Fetch Blob from Google
                const payload = {
                    input: { text: speakableText },
                    voice: { languageCode: 'en-US', name: config.voice },
                    audioConfig: { audioEncoding: 'MP3', speakingRate: config.speed, pitch: config.pitch || 0.0 }
                };

                const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (data.audioContent) {
                    // Update the master manifest reference with url
                    const masterIndex = fullJsonManifest.findIndex(n => n.id === node.id);
                    if (masterIndex !== -1) {
                        fullJsonManifest[masterIndex].audioUrl = `audio/${node.id}.mp3`;
                    }
                    // Write to Zip
                    audioFolder.file(`${node.id}.mp3`, data.audioContent, { base64: true });
                } else if (data.error) {
                    console.error("API Error on node", node.id, data.error.message);
                }

                // Anti rate-limit sleep
                await new Promise(r => setTimeout(r, 300));
            }

            // After loop finishes, append the script.json to zip root
            zip.file("script.json", JSON.stringify(fullJsonManifest, null, 2));

            // Generate and save
            setGenerationProgress("Compressing Zip...");
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `ScriptAudio_Lines_${startLine}-${endLine}.zip`);

        } catch (err) {
            console.error("Zip Generation Failed", err);
            alert("Zip Generation Failed: " + err.message);
        } finally {
            setIsGenerating(false);
            setGenerationProgress(0);
        }
    };

    return (
        <div className="flex h-full w-full bg-gray-950 text-gray-100 overflow-hidden">

            {/* Left Sidebar: Controls & Voice Mapping */}
            <div className="w-1/3 min-w-[320px] max-w-[450px] bg-gray-900 border-r border-gray-800 flex flex-col z-10">
                <div className="p-4 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-3 mb-6">
                        <Settings className="text-blue-400" size={24} />
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            Generator Console
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-center gap-2 p-3 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 rounded-lg cursor-pointer transition-colors shadow-lg font-medium text-sm text-center w-full">
                            <Upload size={18} />
                            <span>Load Raw Script (.txt)</span>
                            <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <p className="text-xs text-gray-500 text-center font-mono truncate px-2">{fileName}</p>
                    </div>
                </div>

                {/* Voice Map List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Voice Configuration</h3>
                        {Object.keys(voiceConfig).length > 0 && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold tracking-wider mr-1 px-1 w-32 justify-end">
                                <span className="w-16 text-center">Speed</span>
                                <span className="w-16 text-center">Pitch</span>
                            </div>
                        )}
                    </div>
                    {Object.keys(voiceConfig).length === 0 ? (
                        <p className="text-sm text-gray-600 italic">Upload a script to identify roles.</p>
                    ) : (
                        Object.entries(voiceConfig).map(([character, config]) => (
                            <div key={character} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm text-gray-200">{character}</span>
                                    <button
                                        onClick={() => testVoice(character)}
                                        disabled={config.voice === "Skip/Mute"}
                                        className="p-1 px-2 text-xs bg-gray-700 hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
                                    >
                                        <Play size={12} /> Test
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        className="flex-1 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded p-1.5 focus:border-blue-500 outline-none"
                                        value={config.voice}
                                        onChange={(e) => updateConfig(character, 'voice', e.target.value)}
                                    >
                                        {AVAILABLE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.25"
                                        max="4.0"
                                        className="w-16 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded p-1.5 focus:border-blue-500 outline-none"
                                        value={config.speed}
                                        onChange={(e) => updateConfig(character, 'speed', parseFloat(e.target.value))}
                                        title="Speed"
                                    />
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="-10.0"
                                        max="10.0"
                                        className="w-16 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded p-1.5 focus:border-blue-500 outline-none"
                                        value={config.pitch !== undefined ? config.pitch : 0.0}
                                        onChange={(e) => updateConfig(character, 'pitch', parseFloat(e.target.value) || 0.0)}
                                        title="Pitch"
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Generate Controls Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/90 shrink-0 space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Google API Key</label>
                        <input
                            type="password"
                            className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none text-gray-300"
                            placeholder="AIzaSy..."
                            value={apiKey}
                            onChange={(e) => handleApiKeyChange(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Start Line</label>
                            <input
                                type="number"
                                min="1" max={masterScript.length || 1}
                                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm"
                                value={startLine}
                                onChange={(e) => setStartLine(parseInt(e.target.value) || 1)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">End Line</label>
                            <input
                                type="number"
                                min="1" max={masterScript.length || 1}
                                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm"
                                value={endLine}
                                onChange={(e) => setEndLine(parseInt(e.target.value) || 1)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={generateAudioZip}
                        disabled={isGenerating || masterScript.length === 0}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all shadow-lg ${isGenerating || masterScript.length === 0
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>{typeof generationProgress === 'string' ? generationProgress : `Generating... ${generationProgress}%`}</span>
                            </>
                        ) : (
                            <>
                                <DownloadCloud size={18} />
                                <span>Export Script Audio (.zip)</span>
                            </>
                        )}
                    </button>
                    {(endLine - startLine) > 50 && (
                        <p className="text-[10px] text-amber-500/70 text-center uppercase tracking-wide">
                            Warning: Large batch size may take a while.
                        </p>
                    )}
                </div>
            </div>

            {/* Right Side: Visual Preview Pane */}
            <div className="flex-1 bg-gray-950 overflow-y-auto p-6 md:p-10">
                <div className="max-w-3xl mx-auto space-y-2">
                    {masterScript.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 mt-32 border-2 border-dashed border-gray-800 rounded-3xl p-12 text-center">
                            <FileText size={48} className="mb-4 opacity-50" />
                            <h3 className="text-xl font-medium mb-2 text-gray-500">No Script Loaded</h3>
                            <p className="text-sm max-w-sm">Load a raw text Script on the left to review its parsed architecture and assign generation voices.</p>
                        </div>
                    ) : (
                        masterScript.map((node, i) => {
                            const currentLineNum = i + 1;
                            const isIgnored = currentLineNum < startLine || currentLineNum > endLine;

                            return (
                                <div
                                    key={node.id}
                                    className={`p-3 rounded transition-colors group flex gap-4 ${isIgnored
                                        ? 'opacity-30 bg-gray-900/20'
                                        : 'bg-gray-900/50 hover:bg-gray-800'
                                        }`}
                                >
                                    <div className="text-xs font-mono text-gray-600 pt-1 shrink-0 w-8 text-right">
                                        [{currentLineNum}]
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-bold text-xs uppercase tracking-wider mb-1 ${(node.character === "STAGE DIRECTIONS" || node.character === "INLINE STAGE DIRECTIONS")
                                            ? 'text-gray-500'
                                            : 'text-blue-400'
                                            }`}>
                                            {node.character}
                                        </div>
                                        <div className={`text-base leading-relaxed ${(node.character === "STAGE DIRECTIONS" || node.character === "INLINE STAGE DIRECTIONS")
                                            ? 'text-gray-400 italic'
                                            : 'text-gray-200'
                                            }`}>
                                            {node.originalText}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

        </div>
    );
}

export default Studio;
