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
        }, 500); // simulate network delay
    });
};

const bridgeInvoke = isLocal ? mockInvoke : invoke;

function App() {
    const [data, setData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLicensed, setIsLicensed] = useState(true); // Default to true for dev/free
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
                // Load flow data (includes license status from backend)
                const response = await bridgeInvoke('getFlow');

                // Backend returns { data, isLicensed }
                setData(response.data);
                setIsLicensed(response.isLicensed);
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
            await bridgeInvoke('setFlow', { flowData: newData });
            setData(newData);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to save', err);
            alert('Could not save flow data.');
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
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full font-sans antialiased text-gray-900 p-2">
            {isEditing ? (
                <Editor
                    initialData={data}
                    onSave={handleSave}
                    onCancel={() => setIsEditing(false)}
                    onResize={resizeToFitContent}
                />
            ) : (
                <Viewer
                    data={data}
                    onEdit={() => setIsEditing(true)}
                    onResize={resizeToFitContent}
                />
            )}
        </div>
    );
}

export default App;
