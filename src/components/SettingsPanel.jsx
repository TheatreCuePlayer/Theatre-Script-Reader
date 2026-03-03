import React from 'react';
import { Play } from 'lucide-react';

export default function SettingsPanel({ roles, settings, apiKeys, voices, cloudScriptUrl, onSettingChange, onApiKeyChange, onCloudScriptUrlChange, onSyncScript, onPreview, onClose }) {

    const modes = ['Active', 'Muted (Timer)', 'Muted (Manual)', 'Transparent (Timed)', 'Transparent (Manual)', 'Hidden'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            {/* Added max-h-[85vh] strictly to outer container to prevent spilling */}
            <div className="bg-gray-800 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-700">

                <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900 shrink-0">
                    <h2 className="text-xl md:text-2xl font-bold text-white">Voice & Character Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        Close
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Cloud Sync Section */}
                    <div className="bg-gray-800/80 p-4 rounded-lg border border-gray-700 mb-6 drop-shadow-md">
                        <h3 className="text-lg font-bold text-white mb-4">Cloud Sync</h3>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-semibold text-gray-300 mb-1">Master Script Cloud URL (Raw Text)</label>
                                <input
                                    type="text"
                                    value={cloudScriptUrl || ''}
                                    onChange={(e) => onCloudScriptUrlChange(e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-600 rounded-md p-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    placeholder="https://raw.githubusercontent.com/... or Google Docs Export Link"
                                />
                            </div>
                            <button
                                onClick={onSyncScript}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium text-sm transition-colors shadow-md shrink-0 h-[38px]"
                            >
                                Sync Script
                            </button>
                        </div>
                    </div>

                    {/* Premium Cloud API Keys Section */}
                    <div className="bg-gray-800/80 p-4 rounded-lg border border-gray-700 mb-6 drop-shadow-md">
                        <h3 className="text-lg font-bold text-white mb-4">Premium Cloud Voices (BYOK)</h3>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-gray-300 mb-1">Google Cloud TTS API Key</label>
                                <input
                                    type="password"
                                    value={apiKeys?.google || ''}
                                    onChange={(e) => onApiKeyChange('google', e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-600 rounded-md p-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    placeholder="AIzaSy..."
                                />
                                <p className="text-xs text-gray-500 mt-1 leading-tight">
                                    <span>Google Cloud: 1 Million Neural characters free/month. <a href="https://cloud.google.com/text-to-speech/docs/setup" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Requires Cloud Console setup.</a></span>
                                </p>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-gray-300 mb-1">ElevenLabs API Key</label>
                                <input
                                    type="password"
                                    value={apiKeys?.elevenlabs || ''}
                                    onChange={(e) => onApiKeyChange('elevenlabs', e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-600 rounded-md p-2 text-sm text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                                    placeholder="sk_..."
                                />
                                <p className="text-xs text-gray-500 mt-1 leading-tight">
                                    <span>ElevenLabs: 10,000 characters free/month. <a href="https://elevenlabs.io/docs/api-reference/getting-started" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">No card required.</a></span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {roles.map((role) => {
                            const currentSetting = settings[role] || { mode: 'Active', voiceURI: '', speed: 1.0, pitch: 1.0 };
                            const speedVal = currentSetting.speed !== undefined ? currentSetting.speed : 1.0;
                            const pitchVal = currentSetting.pitch !== undefined ? currentSetting.pitch : 1.0;

                            return (
                                // Switched to gap-2 and flex-col md:flex-row with wrap if needed
                                <div key={role} className="flex flex-col xl:flex-row xl:items-center justify-between bg-gray-900/50 p-4 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors gap-3">

                                    <div className="flex-shrink-0 xl:w-48 font-semibold text-lg text-blue-300">
                                        {role}
                                    </div>

                                    <div className="flex-1 w-full xl:w-auto xl:min-w-48">
                                        <select
                                            className="w-full bg-gray-950 border border-gray-700 rounded-md p-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={currentSetting.voiceURI || ''}
                                            onChange={(e) => onSettingChange(role, { ...currentSetting, voiceURI: e.target.value })}
                                        >
                                            <option value="">Default Voice</option>
                                            {voices.map((voice, idx) => (
                                                <option key={voice.id || idx} value={voice.id}>{voice.name} {voice.lang ? `(${voice.lang})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Sliders Container */}
                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                                        {/* Speed Slider */}
                                        <div className="flex-1 sm:w-32 flex flex-col justify-center bg-gray-950 p-2 rounded-md border border-gray-700 w-full">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Speed</span>
                                                <span className="text-xs text-blue-400 font-mono">{Number(speedVal).toFixed(1)}x</span>
                                            </div>
                                            <input
                                                title="Per-Character Speed (1.0 = Use Global)"
                                                type="range"
                                                min="0.5"
                                                max="2.0"
                                                step="0.1"
                                                value={speedVal}
                                                onChange={(e) => onSettingChange(role, { ...currentSetting, speed: parseFloat(e.target.value) })}
                                                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>

                                        {/* Pitch Slider */}
                                        <div className="flex-1 sm:w-32 flex flex-col justify-center bg-gray-950 p-2 rounded-md border border-gray-700 w-full">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Pitch</span>
                                                <span className="text-xs text-emerald-400 font-mono">{Number(pitchVal).toFixed(1)}</span>
                                            </div>
                                            <input
                                                title="Pitch Adjustment"
                                                type="range"
                                                min="0.0"
                                                max="2.0"
                                                step="0.1"
                                                value={pitchVal}
                                                onChange={(e) => onSettingChange(role, { ...currentSetting, pitch: parseFloat(e.target.value) })}
                                                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-row justify-between xl:justify-end items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
                                        <button
                                            onClick={() => onPreview(currentSetting.voiceURI, speedVal, pitchVal)}
                                            className="flex-1 xl:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-md text-sm transition-colors border border-blue-600/50 min-w-max"
                                        >
                                            <Play size={16} fill="currentColor" /> Preview
                                        </button>

                                        <div className="flex-1 xl:flex-none xl:w-40 min-w-max">
                                            <select
                                                className="w-full bg-gray-950 border border-gray-700 rounded-md p-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={currentSetting.mode}
                                                onChange={(e) => onSettingChange(role, { ...currentSetting, mode: e.target.value })}
                                            >
                                                {modes.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
