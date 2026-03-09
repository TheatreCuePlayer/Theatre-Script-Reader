import React, { useState, useEffect } from 'react';
import { Upload, Settings as SettingsIcon, Menu, RefreshCw, HelpCircle } from 'lucide-react';
import { parseScript } from './utils/parser';
import { useSpeechEngine } from './hooks/useSpeechEngine';

import Sidebar from './components/Sidebar';
import Teleprompter from './components/Teleprompter';
import BottomBar from './components/BottomBar';
import SettingsPanel from './components/SettingsPanel';
import Studio from './components/Studio';
import HelpModal from './components/HelpModal';

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

    // New Audio Engine State
    const [playbackMode, setPlaybackMode] = useState('live'); // 'live', 'pre_rendered_local', 'pre_rendered_remote'
    const [localAudioFiles, setLocalAudioFiles] = useState({});
    const [remoteBaseUrl, setRemoteBaseUrl] = useState('');
    const [isLoadError, setIsLoadError] = useState('');

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // Simple routing state
    const [currentView, setCurrentView] = useState('player'); // 'player' or 'studio'

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

    const processRawScriptText = (text) => {
        const { scriptNodes: parsedNodes, pronunciationDictionary: parsedDict } = parseScript(text);

        // Force a fresh state clear before applying new
        setScriptNodes([]);
        setRoles([]);
        setPronunciationDictionary({});
        stop();

        setScriptNodes(parsedNodes);
        setPronunciationDictionary(parsedDict);

        // Save local file read to localStorage identically
        localStorage.setItem('rehearsal-last-opened-script', text);
        setLastOpenedScript(text);

        // Extract unique characters and directions for settings panel
        const uniqueRoles = new Set();
        parsedNodes.forEach(node => {
            if (node.character) uniqueRoles.add(node.character);
            else if (node.type === 'DIRECTION') uniqueRoles.add('STAGE DIRECTIONS');
        });

        setRoles(Array.from(uniqueRoles).sort());
        setPlaybackMode('live');
        setIsSidebarOpen(true);
    };

    const applyScriptJson = (jsonArray) => {
        const uniqueRoles = new Set();
        const normalizedArray = jsonArray.map((node, i) => {
            if (node.character) uniqueRoles.add(node.character);
            return {
                ...node,
                text: node.text || node.originalText,
                lineId: node.lineId || i // Ensure lineId exists
            };
        });

        stop();
        setScriptNodes([]);
        setRoles([]);
        setPronunciationDictionary({}); // Pre-rendered handles pronunciation natively

        setScriptNodes(normalizedArray);
        setRoles(Array.from(uniqueRoles).sort());
        setIsLoadError('');
        setIsSidebarOpen(true);
    };

    const handleFolderSelection = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        let scriptJsonFile = null;
        const audioMap = {};

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name === 'script.json') {
                scriptJsonFile = file;
            } else if (file.name.endsWith('.mp3')) {
                audioMap[file.name] = file;
            }
        }

        if (!scriptJsonFile) {
            alert('Could not find script.json in the selected directory.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonArray = JSON.parse(event.target.result);
                setLocalAudioFiles(audioMap);
                setPlaybackMode('pre_rendered_local');
                applyScriptJson(jsonArray);
            } catch (error) {
                alert("Failed to parse script.json - invalid format.");
            }
        };
        reader.readAsText(scriptJsonFile);
        e.target.value = '';
    };

    const handleLoadRemoteUrl = async (urlStr) => {
        if (!urlStr) return;
        setIsLoadError('Loading...');
        try {
            const cleanBaseUrl = urlStr.replace(/\/$/, "");
            const response = await fetch(`${cleanBaseUrl}/script.json`);
            if (!response.ok) throw new Error('Not found');
            const jsonArray = await response.json();

            setRemoteBaseUrl(cleanBaseUrl);
            setPlaybackMode('pre_rendered_remote');
            applyScriptJson(jsonArray);
        } catch (error) {
            setIsLoadError('Failed to load remote script.json');
            alert("Failed to load generic script.json. Ensure the URL points to a hosted Studio bundle.");
        }
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

            processRawScriptText(text);
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

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            processRawScriptText(text);
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
    } = useSpeechEngine(scriptNodes, pronunciationDictionary, settings, apiKeys, globalSpeed, playbackMode, localAudioFiles, remoteBaseUrl, () => {
        // Optional callback 
    });

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">

            {/* Sidebar TOC - Hide if in studio mode */}
            {currentView === 'player' && (
                <Sidebar
                    scriptNodes={scriptNodes}
                    onJumpToLine={jumpToLine}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                />
            )}

            <div className="flex-1 flex flex-col relative w-full h-full">

                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        {currentView === 'player' && (
                            <button
                                onClick={() => setIsSidebarOpen(prev => !prev)}
                                className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <Menu size={24} />
                            </button>
                        )}
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent truncate hidden sm:block">
                            Rehearsal Script Reader
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">

                        {/* Navigation Toggle */}
                        <button
                            onClick={() => setCurrentView(prev => prev === 'player' ? 'studio' : 'player')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors shadow-lg text-sm font-medium border ${currentView === 'studio'
                                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/50 hover:bg-emerald-600/30'
                                : 'bg-indigo-600/20 text-indigo-400 border-indigo-600/50 hover:bg-indigo-600/30'
                                }`}
                        >
                            {currentView === 'player' ? 'Go to Studio' : 'Back to Player'}
                        </button>
                        {/* Only show these if in Player mode */}
                        {currentView === 'player' && (
                            <div className="flex items-center gap-2">
                                <div className="hidden lg:flex items-center bg-gray-950 border border-gray-700 rounded-lg overflow-hidden shadow-lg h-9">
                                    <input
                                        type="text"
                                        placeholder="https://...remote url zip path"
                                        className="bg-transparent text-sm px-3 py-1 text-gray-300 outline-none w-48 focus:w-64 transition-all"
                                        value={remoteBaseUrl}
                                        onChange={(e) => setRemoteBaseUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLoadRemoteUrl(remoteBaseUrl)}
                                    />
                                    <button
                                        onClick={() => handleLoadRemoteUrl(remoteBaseUrl)}
                                        className="h-full px-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-blue-300 transition-colors border-l border-gray-700 font-medium text-xs whitespace-nowrap"
                                    >
                                        Load URL
                                    </button>
                                </div>
                                {isLoadError === 'Loading...' && <span className="text-xs text-blue-400 animate-pulse ml-2">Loading...</span>}

                                <label className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-colors shadow-lg font-medium text-sm">
                                    <Upload size={18} />
                                    <span className="hidden sm:inline">Load MP3 Folder</span>
                                    <input
                                        type="file"
                                        webkitdirectory="true"
                                        directory="true"
                                        multiple
                                        className="hidden"
                                        onChange={handleFolderSelection}
                                    />
                                </label>

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
                            </div>
                        )}

                        <button
                            onClick={() => setIsHelpOpen(true)}
                            className="flex justify-center items-center gap-2 px-3 py-2 bg-blue-900 border border-blue-700 hover:bg-blue-800 text-blue-100 rounded-lg transition-colors shadow-lg text-sm font-semibold"
                            title="Quick Start Guide"
                        >
                            <HelpCircle size={18} />
                            <span className="hidden sm:inline">Help</span>
                        </button>

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors shadow-lg text-sm"
                        >
                            <SettingsIcon size={18} />
                            <span className="hidden sm:inline">Settings</span>
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                {currentView === 'player' ? (
                    <>
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
                    </>
                ) : (
                    <div className="flex-1 w-full h-full overflow-hidden">
                        <Studio />
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <SettingsPanel
                    roles={roles}
                    settings={settings}
                    apiKeys={apiKeys}
                    voices={voices}
                    playbackMode={playbackMode}
                    cloudScriptUrl={cloudScriptUrl}
                    onSettingChange={handleSettingChange}
                    onApiKeyChange={handleApiKeyChange}
                    onCloudScriptUrlChange={handleCloudScriptUrlChange}
                    onSyncScript={() => fetchCloudScript(cloudScriptUrl, false)}
                    onPreview={playPreview}
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}

            {/* Help Modal */}
            <HelpModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
            />

        </div>
    );
}

export default App;
