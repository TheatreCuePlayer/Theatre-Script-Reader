import React from 'react';
import { Menu, X } from 'lucide-react';

export default function Sidebar({ scriptNodes, onJumpToLine, isOpen, setIsOpen }) {

    // Extract TOC items (Act, Scene, and French Scene)
    const tocItems = scriptNodes.reduce((acc, node, index) => {
        const isStructure = node.type === 'ACT' || node.type === 'SCENE' || node.type === 'FRENCH_SCENE' ||
            node.character === 'ACT' || node.character === 'SCENE' || node.character === 'FRENCH_SCENE';
        if (isStructure) {
            acc.push({ ...node, index, derivedType: node.type || node.character });
        }
        return acc;
    }, []);

    return (
        <>
            <div
                className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-950 border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-full flex flex-col pt-16 pb-24 overflow-y-auto">
                    <div className="px-6 py-4 border-b border-gray-800 top-0 sticky bg-gray-950/90 backdrop-blur z-10">
                        <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase">Table of Contents</h3>
                    </div>
                    <div className="flex-1 py-4">
                        {tocItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onJumpToLine(item.index);
                                    if (window.innerWidth < 768) setIsOpen(false); // auto-close on mobile
                                }}
                                className={`w-full text-left px-6 py-2 hover:bg-gray-900 transition-colors ${item.derivedType === 'ACT'
                                    ? 'text-blue-400 font-bold mt-4 border-l-2 border-blue-500'
                                    : item.derivedType === 'SCENE'
                                        ? 'text-gray-300 text-sm pl-10 hover:text-white'
                                        : 'text-gray-400 text-xs pl-14 hover:text-gray-200 indent-2'
                                    }`}
                            >
                                {item.text}
                            </button>
                        ))}
                        {tocItems.length === 0 && (
                            <div className="px-6 text-gray-600 italic text-sm">No scenes found.</div>
                        )}
                    </div>
                </div>
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 transition-opacity md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
