import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { generateMermaidString } from './utils/mermaid';
import { PencilSquareIcon, SparklesIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
});

export default function Viewer({ data, onEdit, onResize, readOnly = false }) {
    const containerRef = useRef(null);
    const [isDark, setIsDark] = useState(false);
    const isEmpty = !data || !data.actors || data.actors.length === 0 || !data.steps || data.steps.length === 0;

    useEffect(() => {
        if (!isEmpty && containerRef.current) {
            const code = generateMermaidString(data);
            if (code) {
                containerRef.current.innerHTML = '';
                mermaid.render('mermaid-diagram', code).then(({ svg }) => {
                    if (containerRef.current) {
                        containerRef.current.innerHTML = svg;
                        // Notify parent to resize after diagram renders
                        if (onResize) {
                            setTimeout(onResize, 50);
                        }
                    }
                }).catch(err => {
                    console.error("Mermaid error", err);
                    if (containerRef.current) {
                        containerRef.current.innerHTML = `<div class="text-red-500 p-4 bg-red-50 rounded-lg">Error rendering diagram. Check your syntax.</div>`;
                        if (onResize) onResize();
                    }
                });
            }
        }
    }, [data, isEmpty, onResize]);

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md group">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform duration-300">
                    <SparklesIcon className="w-8 h-8 text-slate-700" />
                </div>
                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-900 mb-2">Map Your API Flow</h3>
                <p className="text-gray-500 text-center mb-8 max-w-sm text-sm">
                    Create a stunning sequence diagram of your API calls directly in Confluence. It's beautiful, easy, and updates instantly.
                </p>
                <button
                    onClick={onEdit}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg hover:shadow-xl focus:ring-4 focus:ring-slate-200 transform hover:-translate-y-0.5"
                >
                    Create First Flow
                </button>
            </div>
        );
    }

    return (
        <div className={`relative group transition-shadow duration-300 border overflow-hidden min-h-[400px] ${isDark ? 'dark bg-slate-900 border-slate-700/50 shadow-[rgba(0,0,15,0.5)_0px_10px_30px_0px] rounded-2xl' : 'bg-white rounded-2xl shadow-sm hover:shadow-md border-gray-100'}`}>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex gap-2">
                <button
                    onClick={() => setIsDark(!isDark)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm transition-all focus:ring-2 ${isDark ? 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-700 focus:ring-slate-500' : 'bg-white/90 backdrop-blur border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 focus:ring-gray-200'}`}
                >
                    {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                    {isDark ? 'Light' : 'Dark'}
                </button>
                {!readOnly && (
                    <button
                        onClick={onEdit}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm transition-all focus:ring-2 ${isDark ? 'bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 focus:ring-indigo-400' : 'bg-white/90 backdrop-blur border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 focus:ring-gray-200'}`}
                    >
                        <PencilSquareIcon className="w-4 h-4" /> Edit Flow
                    </button>
                )}
            </div>
            <div className="p-8 overflow-x-auto overflow-y-hidden flex justify-center items-center w-full h-full min-h-[400px]" ref={containerRef}>
                {/* Mermaid SVG goes here */}
            </div>
        </div>
    );
}
