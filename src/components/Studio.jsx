import React, { useState } from 'react';
import { Download, Upload, FileText } from 'lucide-react';

function Studio() {
    const [scriptText, setScriptText] = useState('');
    const [fileName, setFileName] = useState('untitled_script.txt');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            setScriptText(event.target.result);
        };
        reader.readAsText(file);

        // Reset input
        e.target.value = '';
    };

    const handleDownload = () => {
        if (!scriptText.trim()) return;

        const blob = new Blob([scriptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${fileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <FileText className="text-emerald-400" size={24} />
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Script Studio
                    </h2>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 rounded-lg cursor-pointer transition-colors shadow-lg font-medium text-sm">
                        <Upload size={18} />
                        <span>Load Text File</span>
                        <input
                            type="file"
                            accept=".txt"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </label>

                    <button
                        onClick={handleDownload}
                        disabled={!scriptText.trim()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg ${scriptText.trim()
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                            }`}
                    >
                        <Download size={18} />
                        <span>Download Edited .txt</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-800 text-sm text-gray-400 font-mono flex items-center justify-between shrink-0">
                    <span>{fileName}</span>
                    <span>{scriptText.length} characters</span>
                </div>
                <textarea
                    className="flex-1 w-full bg-transparent p-6 text-gray-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 leading-relaxed"
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Load a script to edit, or paste text here..."
                    spellCheck="false"
                />
            </div>
        </div>
    );
}

export default Studio;
