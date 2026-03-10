import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon, CheckIcon, XMarkIcon, SwatchIcon, Bars3Icon } from '@heroicons/react/20/solid';

export default function Editor({ initialData, onSave, onCancel, onResize }) {
    // Check if we have saved data - must be a non-null object with actors or steps defined
    const hasExistingData = initialData !== null &&
        initialData !== undefined &&
        typeof initialData === 'object' &&
        (Array.isArray(initialData.actors) || Array.isArray(initialData.steps));

    const [actors, setActors] = useState(
        hasExistingData && Array.isArray(initialData.actors) ? initialData.actors : ['Frontend', 'Backend']
    );
    const [steps, setSteps] = useState(
        hasExistingData && Array.isArray(initialData.steps)
            ? initialData.steps.map((s, i) => ({ ...s, id: i }))
            : [{ id: 0, from: 'Frontend', to: 'Backend', endpoint: '/api/data', description: 'Fetch initial data' }]
    );
    const [isSaving, setIsSaving] = useState(false);
    const [draggedStep, setDraggedStep] = useState(null);
    const [dragOverStep, setDragOverStep] = useState(null);
    const [draggedActor, setDraggedActor] = useState(null);
    const [dragOverActor, setDragOverActor] = useState(null);
    const dragNodeRef = useRef(null);

    // Notify parent to resize when actors or steps change
    useEffect(() => {
        if (onResize) {
            const timer = setTimeout(onResize, 50);
            return () => clearTimeout(timer);
        }
    }, [actors.length, steps.length, onResize]);

    const addActor = () => setActors([...actors, `Service ${actors.length + 1}`]);

    // When removing an actor, also remove any steps that reference it
    const removeActor = (idx) => {
        const actorToRemove = actors[idx];
        const newActors = actors.filter((_, i) => i !== idx);
        setActors(newActors);

        if (newActors.length < 2) {
            setSteps([]);
        } else {
            // Remove steps that have this actor as 'from' or 'to'
            setSteps(steps.filter(s => s.from !== actorToRemove && s.to !== actorToRemove));
        }
    };

    // When updating an actor name, also update steps that reference it
    const updateActor = (idx, val) => {
        const oldName = actors[idx];
        const newActors = [...actors];
        newActors[idx] = val;
        setActors(newActors);
        // Update steps that reference the old actor name
        setSteps(steps.map(s => ({
            ...s,
            from: s.from === oldName ? val : s.from,
            to: s.to === oldName ? val : s.to
        })));
    };

    // Actor drag and drop handlers
    const handleActorDragStart = (e, idx) => {
        setDraggedActor(idx);
        dragNodeRef.current = e.target;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            if (dragNodeRef.current) {
                dragNodeRef.current.style.opacity = '0.4';
            }
        }, 0);
    };

    const handleActorDragEnter = (e, idx) => {
        if (draggedActor !== idx) {
            setDragOverActor(idx);
        }
    };

    const handleActorDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleActorDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverActor(null);
        }
    };

    const handleActorDrop = (e, dropIdx) => {
        e.preventDefault();
        if (draggedActor === null || draggedActor === dropIdx) return;

        const newActors = [...actors];
        const [draggedItem] = newActors.splice(draggedActor, 1);
        newActors.splice(dropIdx, 0, draggedItem);
        setActors(newActors);
        setDraggedActor(null);
        setDragOverActor(null);
    };

    const handleActorDragEnd = () => {
        if (dragNodeRef.current) {
            dragNodeRef.current.style.opacity = '1';
        }
        setDraggedActor(null);
        setDragOverActor(null);
        dragNodeRef.current = null;
    };

    const addStep = () => {
        setSteps([...steps, {
            id: Date.now(),
            from: actors[0] || '',
            to: actors.length > 1 ? actors[1] : (actors[0] || ''),
            endpoint: '',
            description: ''
        }]);
    };
    const removeStep = (id) => setSteps(steps.filter(s => s.id !== id));
    const updateStep = (id, field, val) => setSteps(steps.map(s => s.id === id ? { ...s, [field]: val } : s));

    // Drag and drop handlers
    const handleDragStart = (e, idx) => {
        setDraggedStep(idx);
        dragNodeRef.current = e.target;
        e.dataTransfer.effectAllowed = 'move';
        // Add a slight delay to allow the drag image to be set
        setTimeout(() => {
            if (dragNodeRef.current) {
                dragNodeRef.current.style.opacity = '0.4';
            }
        }, 0);
    };

    const handleDragEnter = (e, idx) => {
        if (draggedStep !== idx) {
            setDragOverStep(idx);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragLeave = (e) => {
        // Only clear if we're leaving the element entirely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverStep(null);
        }
    };

    const handleDrop = (e, dropIdx) => {
        e.preventDefault();
        if (draggedStep === null || draggedStep === dropIdx) return;

        const newSteps = [...steps];
        const [draggedItem] = newSteps.splice(draggedStep, 1);
        newSteps.splice(dropIdx, 0, draggedItem);
        setSteps(newSteps);
        setDraggedStep(null);
        setDragOverStep(null);
    };

    const handleDragEnd = () => {
        if (dragNodeRef.current) {
            dragNodeRef.current.style.opacity = '1';
        }
        setDraggedStep(null);
        setDragOverStep(null);
        dragNodeRef.current = null;
    };

    const handleSave = async () => {
        setIsSaving(true);
        const cleanSteps = steps.map(({ from, to, endpoint, description }) => ({ from, to, endpoint, description }));
        // Preserve other properties from initialData (like isDark) when saving
        const payload = {
            ...(initialData || {}),
            actors,
            steps: cleanSteps
        };
        await onSave(payload);
        setIsSaving(false);
    };

    return (
        <div className="bg-slate-900 rounded-2xl shadow-indigo-900/20 shadow-2xl border border-slate-700/50 overflow-hidden text-slate-200">

            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg shadow-inner">
                        <SwatchIcon className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">API Flow Editor</h2>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors focus:ring-2 focus:ring-slate-700"
                    >
                        <XMarkIcon className="w-4 h-4" /> Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-slate-700 hover:bg-slate-600 rounded-full shadow-[0_0_15px_rgba(51,65,85,0.4)] hover:shadow-[0_0_25px_rgba(51,65,85,0.7)] transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        {isSaving ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : <CheckIcon className="w-5 h-5" />}
                        {isSaving ? 'Deploying...' : 'Save Flow'}
                    </button>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-900 to-slate-900">

                {/* Actors Section */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex justify-between items-end border-b border-slate-700 pb-2 mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">1. Participants</h3>
                        <button
                            onClick={addActor}
                            className="text-xs font-semibold text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" /> Add
                        </button>
                    </div>

                    <div className="space-y-3">
                        {actors.map((actor, idx) => (
                            <div
                                key={idx}
                                draggable
                                onDragStart={(e) => handleActorDragStart(e, idx)}
                                onDragEnter={(e) => handleActorDragEnter(e, idx)}
                                onDragOver={handleActorDragOver}
                                onDragLeave={handleActorDragLeave}
                                onDrop={(e) => handleActorDrop(e, idx)}
                                onDragEnd={handleActorDragEnd}
                                className={`flex items-center gap-2 group p-2 -m-2 rounded-lg transition-all ${dragOverActor === idx
                                    ? 'bg-indigo-500/10 ring-2 ring-indigo-500'
                                    : ''
                                    } ${draggedActor === idx ? 'opacity-50' : ''}`}
                            >
                                <div
                                    className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                    title="Drag to reorder"
                                >
                                    <Bars3Icon className="w-4 h-4" />
                                </div>
                                <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold border border-slate-700 flex-shrink-0 group-hover:border-slate-500/50 group-hover:text-slate-300 transition-colors">
                                    {idx + 1}
                                </div>
                                <input
                                    type="text"
                                    value={actor}
                                    onChange={(e) => updateActor(idx, e.target.value)}
                                    className="flex-1 bg-slate-800/80 border border-slate-700 text-sm rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500 transition-all shadow-inner"
                                    placeholder="e.g. Frontend"
                                />
                                <button
                                    onClick={() => removeActor(idx)}
                                    className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-all focus:opacity-100"
                                    title="Remove participant"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {actors.length === 0 && (
                            <p className="text-xs text-slate-500 italic">No participants added.</p>
                        )}
                    </div>
                </div>

                {/* Steps Section */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex justify-between items-end border-b border-slate-700 pb-2 mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">2. API Sequence</h3>
                        <button
                            onClick={addStep}
                            className="text-xs font-semibold text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" /> Add Step
                        </button>
                    </div>

                    <div className="space-y-3">
                        {steps.length === 0 && (
                            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                No steps defined. Add a step to generate the flow.
                            </div>
                        )}
                        {steps.map((step, idx) => (
                            <div
                                key={step.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragEnter={(e) => handleDragEnter(e, idx)}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={`bg-slate-800/50 border p-4 rounded-xl shadow-sm transition-all group relative ${dragOverStep === idx
                                    ? 'border-indigo-500 border-2 bg-indigo-500/10'
                                    : 'border-slate-700/80 hover:border-slate-600'
                                    } ${draggedStep === idx ? 'opacity-50' : ''}`}
                            >
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                        onClick={() => removeStep(step.id)}
                                        className="p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors"
                                        title="Remove Step"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div
                                        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-500 hover:text-slate-300 transition-colors"
                                        title="Drag to reorder"
                                    >
                                        <Bars3Icon className="w-5 h-5" />
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800 z-10">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 flex gap-2">
                                        <select
                                            value={step.from}
                                            onChange={(e) => updateStep(step.id, 'from', e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-slate-200 focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500 appearance-none shadow-inner"
                                        >
                                            {actors.length ? actors.map(a => <option key={`f-${a}`} value={a}>{a}</option>) : <option>-- Select --</option>}
                                        </select>
                                        <div className="flex items-center text-slate-500 px-1">
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </div>
                                        <select
                                            value={step.to}
                                            onChange={(e) => updateStep(step.id, 'to', e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-slate-200 focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500 appearance-none shadow-inner"
                                        >
                                            {actors.length ? actors.map(a => <option key={`t-${a}`} value={a}>{a}</option>) : <option>-- Select --</option>}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 pl-9">
                                    <input
                                        type="text"
                                        value={step.endpoint}
                                        onChange={(e) => updateStep(step.id, 'endpoint', e.target.value)}
                                        placeholder="Route or Method (e.g. POST /auth/login)"
                                        className="w-full bg-slate-900/80 border border-slate-700 text-sm rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50 font-mono"
                                    />
                                    <input
                                        type="text"
                                        value={step.description}
                                        onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                                        placeholder="Short description of the action"
                                        className="w-full bg-slate-900/50 border border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div >
    );
}
