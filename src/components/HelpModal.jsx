import React from 'react';
import { X, PlayCircle, Mic2, Save, FileJson, Link as LinkIcon, Download, Files } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm transition-opacity">
            <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-700 animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <span className="text-blue-400">Script Reader</span> Quick Start Guide
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                        title="Close Guide"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth">

                    {/* Section 1: The Basics (Teleprompter) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-blue-400 border-b border-gray-700 pb-2">
                            <PlayCircle size={24} />
                            <h3 className="text-lg font-bold">1. The Live Player (Teleprompter)</h3>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            The Player is the main screen. It reads your script aloud using your browser's built-in text-to-speech voices.
                            It highlights the current line so you can read along.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                                <h4 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                                    <FileJson size={16} className="text-emerald-400" /> Getting Started
                                </h4>
                                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                                    <li>Click <strong>Load local .txt</strong> to upload a raw script file.</li>
                                    <li>Click the <strong>Settings</strong> gear icon to assign voices to characters.</li>
                                    <li>Change a character's state to <strong>Muted</strong> to hear silence during their lines, acting as a timer for you to speak.</li>
                                    <li>Change a character to <strong>Hidden</strong> to completely skip their lines.</li>
                                </ul>
                            </div>
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                                <h4 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                                    <LinkIcon size={16} className="text-blue-400" /> Cloud Sync
                                </h4>
                                <p className="text-sm text-gray-400">
                                    In Settings, you can paste a URL to a raw text file (like a GitHub raw link or Google Docs export link).
                                    Clicking <strong>Sync Script</strong> will instantly update your local cast to match the live cloud version.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: The Studio */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-emerald-400 border-b border-gray-700 pb-2 mt-4">
                            <Mic2 size={24} />
                            <h3 className="text-lg font-bold">2. The Script Studio</h3>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Browser voices sound robotic. The Studio lets you use high-quality, neural AI voices (from Google Cloud or ElevenLabs) to
                            permanently render MP3 files for every line in your play. You can then distribute this "bundle" to your cast.
                        </p>

                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                            <h4 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                                <Save size={16} className="text-amber-400" /> Studio Workflow
                            </h4>
                            <ol className="text-sm text-gray-400 space-y-3 list-decimal list-inside">
                                <li>Switch to the <strong>Studio</strong> using the toggle in the top-left corner.</li>
                                <li>Upload your `.txt` script.</li>
                                <li>Enter your Google Cloud or ElevenLabs API Key in the inputs provided.</li>
                                <li>Assign a specific AI voice, Speed, and Pitch to each character. Use the <strong>Test</strong> button to preview.</li>
                                <li>Click <strong>Generate Audio Zip</strong>. The app will generate hundreds of MP3s and bundle them into a single zip file alongside a `script.json` file.</li>
                                <li>Send that `.zip` file to your actors!</li>
                            </ol>
                        </div>
                    </div>

                    {/* Section 3: Pre-Rendered Audio */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-purple-400 border-b border-gray-700 pb-2 mt-4">
                            <Files size={24} />
                            <h3 className="text-lg font-bold">3. Playing Pre-Rendered Audio Bundles</h3>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Once you or your director has generated a Studio `.zip` bundle, you can load it back into the Player for a hyper-realistic experience.
                        </p>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                                <h4 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                                    <Download size={16} className="text-purple-400" /> Loading a Local Bundle
                                </h4>
                                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                                    <li>Unzip the folder your director sent you anywhere on your computer.</li>
                                    <li>In the main Player, click the <strong>Pre-Rendered Audio</strong> tab.</li>
                                    <li>Click <strong>Load MP3 Folder</strong>.</li>
                                    <li>Select the completely unzipped folder. The app will automatically find the `script.json` and all the MP3s and begin playing!</li>
                                </ul>
                            </div>
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                                <h4 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                                    <LinkIcon size={16} className="text-purple-400" /> Connecting to a URL
                                </h4>
                                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                                    <li>If your director hosted the unzipped bundle online (e.g., Netlify, GitHub Pages, or a web server), paste the direct URL to the folder.</li>
                                    <li>Click <strong>Load URL</strong>. The app will fetch the `script.json` and stream the audio directly from the web!</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Advanced Patching */}
                    <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-5 mt-8">
                        <h4 className="font-bold text-blue-300 mb-2 text-base">Advanced: "Patching" an Existing Script</h4>
                        <p className="text-sm text-blue-200/80 leading-relaxed">
                            What happens if you update a scene, but you don't want to re-render 500 lines of unchanged MP3 audio?
                            <br /><br />
                            1. Open the <strong>Studio</strong> and upload your old <strong>script.json</strong> file (which contains all old audio links).<br />
                            2. Immediately click upload again, and load your brand new <strong>.txt</strong> script.<br />
                            3. The Studio will intelligently scan both files, find unchanged dialogue, and automatically map old MP3 URLs to your new text. <br />
                            4. You only pay API costs for the newly generated files!
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium text-sm transition-colors shadow-md"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
}
