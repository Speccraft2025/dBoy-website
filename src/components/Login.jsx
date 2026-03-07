import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
            navigate('/admin');
        } catch (err) {
            setError(err.message || 'Failed to sign in with Google.');
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
            <div className="bg-[#1e293b] p-8 rounded-2xl border-2 border-[#facc15] max-w-sm w-full text-center">
                <h2 className="text-2xl font-bold text-[#facc15] mb-6">Creator Login</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <p className="text-gray-400 mb-8 text-sm">
                    Sign in with your authorized Google account to access the creator dashboard.
                </p>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white text-gray-800 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition disabled:opacity-50"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        className="w-5 h-5"
                    />
                    {loading ? 'Logging in...' : 'Sign in with Google'}
                </button>
            </div>
        </div>
    );
}
