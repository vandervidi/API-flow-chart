import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke, view } from '@forge/bridge';
import Viewer from './Viewer';
import Editor from './Editor';

// Mock data for local development
let localStore = null;
const isLocal = import.meta.env.MODE === 'development';

const mockInvoke = async (method, payload) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (method === 'getFlow') resolve({ data: localStore, isLicensed: true });
            if (method === 'setFlow') {
                localStore = payload.flowData;
                resolve({ success: true });
            }
            if (method === 'checkLicense') resolve({ isLicensed: true });
            if (method === 'checkUserPermissions') resolve({ canEdit: true }); // Simulating permission
        }, 500); // simulate network delay
    });
};

const bridgeInvoke = isLocal ? mockInvoke : invoke;

function App() {
    const [data, setData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLicensed, setIsLicensed] = useState(true); // Default to true for dev/free
    const [hasMacroId, setHasMacroId] = useState(false);
    const [canEdit, setCanEdit] = useState(false); // Default to false until checked
    const [isPageEditing, setIsPageEditing] = useState(false); // Track if we are in Confluence Page Edit mode
    const [isConfiguring, setIsConfiguring] = useState(false); // New state for Config Context
    const containerRef = useRef(null);

    // Function to resize the iframe to fit content
    const resizeToFitContent = useCallback(() => {
        if (!isLocal && containerRef.current) {
            const height = containerRef.current.scrollHeight;
            view.resize({ height: `${height}px` });
        }
    }, []);

    useEffect(() => {
        const initApp = async () => {
            try {
                // Get context to retrieve macro ID and local ID
                const context = await view.getContext();
                const macroId = context?.extension?.macro?.id;
                const localId = context?.localId;
                // Only rely on the explicit isConfiguring flag from the macro context
                // context.extension.config contains the SAVED config, so it is always present if data exists!
                const configMode = context?.extension?.macro?.isConfiguring;
                const pageEditing = context?.extension?.isEditing;

                setIsConfiguring(!!configMode);
                setIsPageEditing(!!pageEditing);

                // IF we are in config, we start in edit mode essentially
                if (configMode) {
                    setIsEditing(true);
                }

                // If it's local development, simulate having an ID
                setHasMacroId(!!macroId || isLocal);

                // Run data fetching and permission check in parallel
                const [flowResponse, permResponse] = await Promise.all([
                    bridgeInvoke('getFlow', { macroId, localId }),
                    bridgeInvoke('checkUserPermissions')
                ]);

                // Backend returns { data, isLicensed }
                setData(flowResponse.data);
                setIsLicensed(flowResponse.isLicensed);

                // Set permissions (allow edit if local dev or if backend says yes)
                setCanEdit(isLocal || permResponse.canEdit);

            } catch (err) {
                console.error('Failed to initialize app', err);
            } finally {
                setIsLoading(false);
            }
        };

        initApp();
    }, []);

    // Resize iframe when content changes
    useEffect(() => {
        // Small delay to allow content to render
        const timer = setTimeout(resizeToFitContent, 100);
        return () => clearTimeout(timer);
    }, [data, isEditing, isLoading, resizeToFitContent]);

    // Set up ResizeObserver to handle dynamic content changes
    useEffect(() => {
        if (!containerRef.current || isLocal) return;

        const observer = new ResizeObserver(() => {
            resizeToFitContent();
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [resizeToFitContent]);

    const handleSave = async (newData) => {
        try {
            const context = await view.getContext();
            const macroId = context?.extension?.macro?.id;
            const localId = context.localId;
            const configMode = context?.extension?.config || context?.extension?.macro?.isConfiguring;

            // Pass BOTH IDs to backend to handle storage logic
            await bridgeInvoke('setFlow', { flowData: newData, macroId, localId });
            setData(newData);

            // If we are in Macro Config (Modal), close the modal on save
            if (configMode) {
                // If it's a configuration modal
                try {
                    // Submit empty config to satisfy Confluence and close modal
                    await view.submit({});
                } catch (e) {
                    console.warn("View submit failed", e);
                }
            } else {
                setIsEditing(false);
            }
        } catch (err) {
            console.error('Failed to save', err);
            alert('Could not save flow data.');
        }
    };

    const handleCancel = async () => {
        setIsEditing(false);
        if (isConfiguring) {
            // For Custom UI Config, view.close() or view.submit()
            // view.close() might be for Modal module. For Config, maybe view.submit() without params.
            // Let's try view.close() first.
            await view.close();
        }
    };

    const handleToggleTheme = async (isDark) => {
        // Optimistically update local state
        const newData = { ...data, isDark };
        setData(newData);

        // Persist to storage
        try {
            const context = await view.getContext();
            const macroId = context?.extension?.macro?.id;
            const localId = context.localId;
            await bridgeInvoke('setFlow', { flowData: newData, macroId, localId });
        } catch (err) {
            console.error('Failed to save theme preference', err);
        }
    };

    if (isLoading) {
        return (
            <div ref={containerRef} className="flex items-center justify-center p-12 min-h-[400px]">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Show limited functionality for unlicensed users
    if (!isLicensed) {
        return (
            <div ref={containerRef} className="w-full h-full font-sans antialiased text-gray-900 p-2">
                {/* ... existing license UI ... */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-amber-800 mb-2">License Required</h3>
                    <p className="text-amber-700 mb-6 max-w-md mx-auto">
                        Your API Flow license has expired or is inactive. Please renew your license to continue creating and editing API flow diagrams.
                    </p>
                    {data && (
                        <div className="mt-6 pt-6 border-t border-amber-200">
                            <p className="text-sm text-amber-600 mb-4">You can still view your existing diagram:</p>
                            <Viewer
                                data={data}
                                onEdit={() => { }} // Disable editing
                                onResize={resizeToFitContent}
                                readOnly={true}
                                onToggleTheme={handleToggleTheme}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // If no macro ID (unsaved/draft page), show a warning but allow editing
    const unsavedWarning = !hasMacroId ? (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-700 text-center flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span><strong>Draft Mode:</strong> Saving the page is recommended to ensure data persistence.</span>
        </div>
    ) : null;

    return (
        <div ref={containerRef} className="w-full h-full font-sans antialiased text-gray-900 p-2 pt-0">
            {unsavedWarning}
            {isEditing ? (
                <Editor
                    initialData={data}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onResize={resizeToFitContent}
                />
            ) : (
                <Viewer
                    data={data}
                    onEdit={() => setIsEditing(true)}
                    onResize={resizeToFitContent}
                    onToggleTheme={handleToggleTheme}
                    canEdit={isPageEditing || isConfiguring} // Enable inline editing only in Page Edit or Config
                />
            )}
        </div>
    );
}

export default App;
