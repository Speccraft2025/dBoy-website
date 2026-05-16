import React, { useState } from 'react';
import { X, Download, Phone, Mail, User, CheckCircle, Loader } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export default function FreeDownloadModal({ beat, onClose, onDownload }) {
    const [step, setStep] = useState('form'); // 'form' | 'otp' | 'success'
    const [loading, setLoading] = useState(false);
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const handleDownloadSubmit = async (e) => {
        e.preventDefault();
        if (!name || !email || !phone) return alert('Please fill in all fields.');
        
        setLoading(true);
        try {
            const saveLeadData = httpsCallable(functions, 'saveLeadData');
            const result = await saveLeadData({ name, email, phone, beatId: beat.id, beatTitle: beat.title });
            
            if (result.data.success) {
                setStep('success');
                setTimeout(() => {
                    onDownload(beat);
                    onClose();
                }, 1500);
            } else {
                alert('Failed to save details. Please try again.');
            }
        } catch (error) {
            console.error('Save Lead Error:', error);
            alert(`Error: ${error.message}`);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
                >
                    <X size={20} />
                </button>

                <div className="p-6 sm:p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-[#facc15]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#facc15]/20">
                            {step === 'success' ? <CheckCircle size={32} className="text-green-400" /> : <Download size={32} className="text-[#facc15]" />}
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
                            {step === 'form' ? 'Free Download' : 'Success!'}
                        </h2>
                        <p className="text-sm text-gray-400">
                            {step === 'form' ? `Enter your details to download "${beat.title}" instantly.` : 
                             `Your download for "${beat.title}" is starting...`}
                        </p>
                    </div>

                    {/* Step 1: Form */}
                    {step === 'form' && (
                        <form onSubmit={handleDownloadSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input 
                                        type="text" 
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full bg-[#1e293b] border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#facc15] focus:ring-1 focus:ring-[#facc15] outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input 
                                        type="email" 
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="john@example.com"
                                        className="w-full bg-[#1e293b] border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#facc15] focus:ring-1 focus:ring-[#facc15] outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">WhatsApp Number</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input 
                                        type="tel" 
                                        required
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+1234567890"
                                        className="w-full bg-[#1e293b] border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#facc15] focus:ring-1 focus:ring-[#facc15] outline-none transition-all placeholder:text-gray-600 font-mono"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Include your country code (e.g., +254)</p>
                            </div>

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 bg-[#facc15] text-[#0f172a] hover:bg-yellow-400 font-black py-3.5 rounded-xl transition-colors uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loading ? <Loader size={18} className="animate-spin" /> : 'Download Beat'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
