import React from 'react';
import { Play, Pause, Square, FastForward } from 'lucide-react';

export default function BottomBar({
    isPlaying,
    isPausedManual,
    globalSpeed,
    setGlobalSpeed,
    onResume,
    onPause,
    onStop,
    onNext
}) {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950/80 backdrop-blur-md border-t border-gray-800 p-4 z-40">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {!isPlaying ? (
                        <button
                            onClick={onResume}
                            className="flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-transform hover:scale-105 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                        >
                            <Play size={24} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={onPause}
                            className="flex items-center justify-center w-14 h-14 bg-amber-600 hover:bg-amber-500 text-white rounded-full transition-transform hover:scale-105 shadow-[0_0_15px_rgba(217,119,6,0.5)]"
                        >
                            <Pause size={24} fill="currentColor" />
                        </button>
                    )}

                    <button
                        onClick={onStop}
                        className="flex items-center justify-center w-12 h-12 bg-gray-800 hover:bg-red-900/50 hover:text-red-400 text-gray-400 rounded-full transition-colors"
                    >
                        <Square size={20} fill="currentColor" />
                    </button>
                </div>

                {/* Speed Slider */}
                <div className="flex-1 w-full max-w-sm flex items-center gap-4 px-4">
                    <span className="text-gray-400 text-sm font-medium w-12">{globalSpeed.toFixed(1)}x</span>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={globalSpeed}
                        onChange={(e) => setGlobalSpeed(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Manual Next Button */}
                <div>
                    <button
                        onClick={onNext}
                        disabled={!isPausedManual}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg transition-all ${isPausedManual
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(5,150,105,0.6)] hover:scale-105 cursor-pointer animate-pulse'
                                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        NEXT <FastForward size={20} />
                    </button>
                </div>

            </div>
        </div>
    );
}
