import React, { useEffect, useRef, useMemo, useState } from 'react';
import { EyeOff } from 'lucide-react';

const ScriptLine = ({ node, index, isActiveNode, settings, onJumpToLine }) => {
    const roleKey = node.character || node.type;
    const roleSetting = settings[roleKey] || { mode: 'Active' };

    if (roleSetting.mode === 'Hidden') return null;

    const isTransparent = roleSetting.mode === 'Transparent (Timed)' || roleSetting.mode === 'Transparent (Manual)';

    const [isRevealed, setIsRevealed] = useState(false);

    // Reset local state if global settings shift away from Transparent
    useEffect(() => {
        if (!isTransparent) {
            setIsRevealed(false);
        }
    }, [isTransparent]);

    if (isTransparent && !isRevealed) {
        return (
            <span
                className={`inline-flex items-center justify-center border ${isActiveNode ? 'border-blue-400 bg-blue-900/60 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 hover:bg-gray-800'} transition-all p-1 mx-1 rounded cursor-pointer align-middle`}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsRevealed(true);
                }}
            >
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-1">
                    <EyeOff size={12} /> Reveal {roleKey}
                </span>
            </span>
        );
    }

    let nodeClasses = "transition-colors duration-200 relative group ";

    if (isActiveNode) {
        nodeClasses += "bg-blue-600 text-white rounded px-1 shadow-sm ";
    } else {
        nodeClasses += "text-gray-200 ";
    }

    if (node.type === 'DIRECTION' || node.character === 'STAGE DIRECTIONS' || node.character === 'INLINE STAGE DIRECTIONS') {
        nodeClasses += "text-gray-400 italic text-[0.95em] ";
    }

    return (
        <span
            className={nodeClasses}
            onClick={(e) => {
                e.stopPropagation();
                onJumpToLine(index);
            }}
        >
            {node.text}
            {isTransparent && isRevealed && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsRevealed(false);
                    }}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded uppercase tracking-wider align-middle"
                    title="Collapse Line"
                >
                    <EyeOff size={10} /> Hide
                </button>
            )}
        </span>
    );
};

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

                    // Do not render group container at all if every node inside it is hidden
                    const allHidden = group.every(({ node }) => {
                        const roleKey = node.character || node.type;
                        return settings[roleKey]?.mode === 'Hidden';
                    });

                    if (allHidden) return null;

                    const firstNode = group[0].node;
                    // Find the primary dialogue node to securely anchor the Character Name.
                    // Live parsing uses type: 'DIALOGUE'. Studio parsing just omits the type but provides 'character'
                    // Ensure the character is not a structural node (ACT, SCENE, etc.)
                    const dialogueItem = group.find(item =>
                        item.node.type === 'DIALOGUE' ||
                        (!item.node.type && item.node.character !== 'ACT' && item.node.character !== 'SCENE' && item.node.character !== 'FRENCH_SCENE' && !item.node.character.includes('DIRECTION'))
                    );
                    const speakerName = dialogueItem ? dialogueItem.node.character : null;

                    let lineClasses = "p-4 rounded-lg transition-all cursor-pointer border border-transparent ";

                    if (isActiveGroup) {
                        lineClasses += "bg-blue-900/40 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)] ";
                    } else {
                        lineClasses += "hover:bg-gray-800 ";
                    }

                    const firstNodeTypeName = firstNode.type || firstNode.character;

                    if (firstNodeTypeName === 'ACT') {
                        lineClasses += "text-3xl font-extrabold text-blue-400 mt-12 mb-6 border-b border-blue-900/50 ";
                    } else if (firstNodeTypeName === 'SCENE') {
                        lineClasses += "text-2xl font-bold text-blue-300 mt-8 mb-4 border-b border-gray-800 ";
                    } else if (firstNodeTypeName === 'FRENCH_SCENE') {
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
                            {/* Render Character Name uniquely if this line contains a dialogue block */}
                            {speakerName && (
                                <div className="font-bold text-blue-300 text-sm mb-1 uppercase tracking-wider">
                                    {speakerName}
                                </div>
                            )}

                            <div className="leading-relaxed whitespace-pre-wrap">
                                {group.map(({ node, index }) => (
                                    <ScriptLine
                                        key={node.id}
                                        node={node}
                                        index={index}
                                        isActiveNode={index === currentIndex}
                                        settings={settings}
                                        onJumpToLine={onJumpToLine}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
