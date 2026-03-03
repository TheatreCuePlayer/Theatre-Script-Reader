import React, { useState, useEffect } from 'react';
import { Upload, Settings as SettingsIcon, Menu, RefreshCw } from 'lucide-react';
import { parseScript } from './utils/parser';
import { useSpeechEngine } from './hooks/useSpeechEngine';

import Sidebar from './components/Sidebar';
import Teleprompter from './components/Teleprompter';
import BottomBar from './components/BottomBar';
import SettingsPanel from './components/SettingsPanel';

function App() {
    const [scriptNodes, setScriptNodes] = useState([]);
    const [pronunciationDictionary, setPronunciationDictionary] = useState({});
    const [roles, setRoles] = useState([]);
    const [settings, setSettings] = useState({});
    const [apiKeys, setApiKeys] = useState({ google: '', elevenlabs: '' });
    const [globalSpeed, setGlobalSpeed] = useState(1.0);
    const [cloudScriptUrl, setCloudScriptUrl] = useState('');
    const [lastOpenedScript, setLastOpenedScript] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem('rehearsal-settings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (e) { console.error('Failed to load settings', e); }
        }

        const savedKeys = localStorage.getItem('rehearsal-api-keys');
        if (savedKeys) {
            try {
                setApiKeys(JSON.parse(savedKeys));
            } catch (e) { console.error('Failed to load API keys', e); }
        }

        const savedCloudUrl = localStorage.getItem('rehearsal-cloud-url');
        if (savedCloudUrl) setCloudScriptUrl(savedCloudUrl);

        const savedScript = localStorage.getItem('rehearsal-last-opened-script');
        if (savedScript) {
            setLastOpenedScript(savedScript);
            // Optionally auto-parse the saved script on load if desired:
            // This is complex as it requires duplicating parsing, leaving manual sync for now.
        }
    }, []);

    // Save settings to localStorage
    const handleSettingChange = (role, newSetting) => {
        setSettings(prev => {
            const next = { ...prev, [role]: newSetting };
            localStorage.setItem('rehearsal-settings', JSON.stringify(next));
            return next;
        });
    };

    const handleApiKeyChange = (provider, key) => {
        setApiKeys(prev => {
            const next = { ...prev, [provider]: key };
            localStorage.setItem('rehearsal-api-keys', JSON.stringify(next));
            return next;
        });
    };

    const handleCloudScriptUrlChange = (url) => {
        setCloudScriptUrl(url);
        localStorage.setItem('rehearsal-cloud-url', url);
    };

    const fetchCloudScript = async (url, isAutoCheck = false) => {
        if (!url) return;
        setIsSyncing(true);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const text = await response.text();

            if (isAutoCheck) {
                if (text === lastOpenedScript) {
                    alert("Script is up to date.");
                    setIsSyncing(false);
                    return;
                } else {
                    alert("Script updated to latest version.");
                }
            } else {
                if (!isAutoCheck && text === lastOpenedScript) {
                    alert("Script is already synced to the latest version.");
                }
            }

            const { scriptNodes: parsedNodes, pronunciationDictionary: parsedDict } = parseScript(text);

            setScriptNodes([]);
            setRoles([]);
            setPronunciationDictionary({});
            stop();

            setScriptNodes(parsedNodes);
            setPronunciationDictionary(parsedDict);
            localStorage.setItem('rehearsal-last-opened-script', text);
            setLastOpenedScript(text);

            const uniqueRoles = new Set();
            parsedNodes.forEach(node => {
                if (node.character) uniqueRoles.add(node.character);
                else if (node.type === 'DIRECTION') uniqueRoles.add('STAGE DIRECTIONS');
            });
            setRoles(Array.from(uniqueRoles).sort());

            setIsSidebarOpen(true);
            setIsSettingsOpen(false);
        } catch (error) {
            console.error("Cloud Sync Error:", error);
            alert("Unable to sync. Ensure the link is a direct raw text URL or a public Google Docs export link.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Force a fresh state clear before parsing
        setScriptNodes([]);
        setRoles([]);
        setPronunciationDictionary({});
        stop(); // safely halt any active audio

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;

            // Save local file read to localStorage identically
            localStorage.setItem('rehearsal-last-opened-script', text);
            setLastOpenedScript(text);

            const { scriptNodes: parsedNodes, pronunciationDictionary: parsedDict } = parseScript(text);
            setScriptNodes(parsedNodes);
            setPronunciationDictionary(parsedDict);

            // Extract unique characters and directions for settings panel
            const uniqueRoles = new Set();
            parsedNodes.forEach(node => {
                if (node.character) uniqueRoles.add(node.character);
                else if (node.type === 'DIRECTION') uniqueRoles.add('STAGE DIRECTIONS');
                // act/scene headers don't get voices typically, but we could add them if wanted or if explicitly typed
            });
            setRoles(Array.from(uniqueRoles).sort());

            setIsSidebarOpen(true);
        };
        reader.readAsText(file);

        // Clear the input value so the same file can be selected again
        e.target.value = '';
    };

    // The custom hook orchestrates SpeechSynthesis APIs and keeps tracking state
    const {
        voices,
        isPlaying,
        currentIndex,
        isPausedManual,
        playPreview,
        resume,
        pause,
        stop,
        jumpToLine,
        nextManual
    } = useSpeechEngine(scriptNodes, pronunciationDictionary, settings, apiKeys, globalSpeed, () => {
        // Optional callback when a line starts if state managed outside, 
        // but the hook exports currentIndex directly.
    });

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">

            {/* Sidebar TOC */}
            <Sidebar
                scriptNodes={scriptNodes}
                onJumpToLine={jumpToLine}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />

            <div className="flex-1 flex flex-col relative w-full h-full">

                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(prev => !prev)}
                            className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent truncate hidden sm:block">
                            Rehearsal Script Reader
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">
                        {cloudScriptUrl && (
                            <button
                                onClick={() => fetchCloudScript(cloudScriptUrl, true)}
                                disabled={isSyncing}
                                className={`hidden sm:flex items-center gap-2 px-3 py-2 border border-blue-600/50 hover:bg-blue-600/20 text-blue-300 rounded-lg transition-colors shadow-lg text-sm ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                                <span>{isSyncing ? "Syncing..." : "Check for Updates"}</span>
                            </button>
                        )}

                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer transition-colors shadow-lg font-medium text-sm">
                            <Upload size={18} />
                            <span className="hidden sm:inline">Upload Script (.txt)</span>
                            <input
                                type="file"
                                accept=".txt"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors shadow-lg text-sm"
                        >
                            <SettingsIcon size={18} />
                            <span className="hidden sm:inline">Settings</span>
                        </button>
                    </div>
                </header>

                {/* Teleprompter Area */}
                <Teleprompter
                    scriptNodes={scriptNodes}
                    currentIndex={currentIndex}
                    settings={settings}
                    onJumpToLine={jumpToLine}
                />

                {/* Bottom Bar fixed overlay handled globally */}
                {scriptNodes.length > 0 && (
                    <BottomBar
                        isPlaying={isPlaying}
                        isPausedManual={isPausedManual}
                        globalSpeed={globalSpeed}
                        setGlobalSpeed={setGlobalSpeed}
                        onResume={resume}
                        onPause={pause}
                        onStop={stop}
                        onNext={nextManual}
                    />
                )}
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <SettingsPanel
                    roles={roles}
                    settings={settings}
                    apiKeys={apiKeys}
                    voices={voices}
                    cloudScriptUrl={cloudScriptUrl}
                    onSettingChange={handleSettingChange}
                    onApiKeyChange={handleApiKeyChange}
                    onCloudScriptUrlChange={handleCloudScriptUrlChange}
                    onSyncScript={() => fetchCloudScript(cloudScriptUrl, false)}
                    onPreview={playPreview}
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}

        </div>
    );
}

export default App;
