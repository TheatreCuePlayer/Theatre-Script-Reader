import React, { useEffect, useRef, useMemo } from 'react';
import { Play } from 'lucide-react';

export default function Teleprompter({ scriptNodes, currentIndex, settings, onJumpToLine }) {
    const containerRef = useRef(null);
    const activeLineRef = useRef(null);

    // Auto-scroll to active line
    useEffect(() => {
        if (activeLineRef.current) {
            activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentIndex]);

    // Group nodes by lineId so inline components render together visually
    const groupedLines = useMemo(() => {
        const lines = [];
        let currentGroup = [];
        let lastLineId = null;

        scriptNodes.forEach((node, index) => {
            if (node.lineId !== lastLineId && lastLineId !== null) {
                lines.push(currentGroup);
                currentGroup = [];
            }
            currentGroup.push({ node, index });
            lastLineId = node.lineId;
        });

        if (currentGroup.length > 0) {
            lines.push(currentGroup);
        }
        return lines;
    }, [scriptNodes]);

    if (scriptNodes.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-900 text-gray-400">
                <p className="text-xl">No script loaded.</p>
                <p className="text-sm mt-2 max-w-md text-center">
                    Upload a `.txt` file using the Upload button in the top right.
                </p>
            </div>
        );
    }

    return (
        <div
            className="flex-1 bg-gray-900 overflow-y-auto p-4 md:p-12 pb-48"
            ref={containerRef}
        >
            <div className="max-w-3xl mx-auto space-y-4">
                {groupedLines.map((group, groupIdx) => {
                    // Check if any node in this group is currently active
                    const isActiveGroup = group.some(item => item.index === currentIndex);
                    const firstNode = group[0].node;

                    let lineClasses = "p-4 rounded-lg transition-all cursor-pointer border border-transparent ";

                    if (isActiveGroup) {
                        lineClasses += "bg-blue-900/40 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)] ";
                    } else {
                        lineClasses += "hover:bg-gray-800 ";
                    }

                    if (firstNode.type === 'ACT') {
                        lineClasses += "text-3xl font-extrabold text-blue-400 mt-12 mb-6 border-b border-blue-900/50 ";
                    } else if (firstNode.type === 'SCENE') {
                        lineClasses += "text-2xl font-bold text-blue-300 mt-8 mb-4 border-b border-gray-800 ";
                    } else if (firstNode.type === 'FRENCH_SCENE') {
                        lineClasses += "text-xl font-semibold text-gray-300 mt-6 mb-3 ";
                    } else {
                        lineClasses += "text-lg "; // default dialogue/direction sizing
                    }

                    return (
                        <div
                            key={firstNode.lineId || groupIdx}
                            ref={isActiveGroup ? activeLineRef : null}
                            className={lineClasses}
                            onClick={() => onJumpToLine(group[0].index)} // Default click jumps to first node in line
                        >
                            {/* Render Character Name uniquely if this line starts a dialogue block */}
                            {firstNode.type === 'DIALOGUE' && (
                                <div className="font-bold text-blue-300 text-sm mb-1 uppercase tracking-wider">
                                    {firstNode.character}
                                </div>
                            )}

                            <div className="leading-relaxed whitespace-pre-wrap">
                                {group.map(({ node, index }) => {
                                    const isActiveNode = index === currentIndex;
                                    const roleKey = node.character || node.type;
                                    const roleSetting = settings[roleKey] || { mode: 'Active' };
                                    const isTransparent = roleSetting.mode === 'Transparent';

                                    if (isTransparent && !isActiveNode) {
                                        return (
                                            <span
                                                key={node.id}
                                                className="inline-flex items-center justify-center border border-dashed border-gray-800 opacity-50 hover:opacity-100 transition-opacity p-1 mx-1 rounded cursor-pointer hover:bg-gray-800 align-middle whitespace-nowrap"
                                                onClick={(e) => { e.stopPropagation(); onJumpToLine(index); }}
                                            >
                                                <button className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white uppercase">
                                                    <Play size={10} /> Reveal
                                                </button>
                                            </span>
                                        );
                                    }

                                    // Styling based on node type and active state within the inline block
                                    let nodeClasses = "transition-colors duration-200 ";

                                    if (isActiveNode) {
                                        // Highlight specific spoken inline node distinctly
                                        nodeClasses += "bg-blue-600 text-white rounded px-1 shadow-sm ";
                                    } else {
                                        nodeClasses += "text-gray-200 ";
                                    }

                                    if (node.type === 'DIRECTION') {
                                        // Stage directions styled differently
                                        nodeClasses += "text-gray-400 italic text-[0.95em] ";
                                    }

                                    return (
                                        <span
                                            key={node.id}
                                            className={nodeClasses}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onJumpToLine(index);
                                            }}
                                        >
                                            {node.text}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
