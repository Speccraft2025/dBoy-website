import React, { useState, useRef } from 'react';
import { X, Music, Image, Save, Loader } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function EditProjectModal({ project, onClose, onSaved }) {
    const [title, setTitle] = useState(project.title || '');
    const [artist, setArtist] = useState(project.artist || "Jazel 'dBoy' Isaac");

    const [newCoverFile, setNewCoverFile] = useState(null);
    const [newAudioFile, setNewAudioFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(project.coverUrl || null);

    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('');

    const coverInputRef = useRef();
    const audioInputRef = useRef();

    const handleCoverChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setNewCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    const uploadFile = (file, path, onProgress) => new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, file);
        task.on('state_changed',
            (snap) => onProgress && onProgress((snap.bytesTransferred / snap.totalBytes) * 100),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
    });

    const handleSave = async () => {
        if (!title.trim()) { alert('Title is required.'); return; }
        setSaving(true);
        setProgress(0);
        try {
            const updates = {
                title: title.trim(),
                artist: artist.trim() || "Jazel 'dBoy' Isaac",
            };

            if (newCoverFile) {
                setStatusMsg('Uploading cover art...');
                updates.coverUrl = await uploadFile(
                    newCoverFile,
                    `projects/covers/${Date.now()}_${newCoverFile.name}`,
                    setProgress
                );
            }

            if (newAudioFile) {
                setStatusMsg('Uploading audio...');
                setProgress(0);
                updates.audioUrl = await uploadFile(
                    newAudioFile,
                    `projects/audio/${Date.now()}_${newAudioFile.name}`,
                    setProgress
                );
            }

            setStatusMsg('Saving changes...');
            await updateDoc(doc(db, 'projects', project.id), updates);

            onSaved({ ...project, ...updates });
            onClose();
        } catch (err) {
            console.error(err);
            alert('Save failed: ' + err.message);
        } finally {
            setSaving(false);
            setStatusMsg('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-[#1e293b] border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-8 bg-[#3b82f6] rounded-full mr-1"></span>
                        Edit Music Project
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition p-1">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    {/* Cover Art Section */}
                    <div className="bg-[#0f172a] p-4 rounded-xl border border-gray-800">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Cover Art</label>
                        <div className="flex items-center gap-5">
                            <div
                                className="w-24 h-24 bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700 flex-shrink-0 cursor-pointer hover:border-[#3b82f6] transition group relative"
                                onClick={() => coverInputRef.current.click()}
                            >
                                {coverPreview ? (
                                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600"><Image size={30} /></div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Image size={24} className="text-white" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => coverInputRef.current.click()}
                                    className="text-xs font-bold bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2"
                                >
                                    <Image size={14} /> Change Image
                                </button>
                                {newCoverFile ? (
                                    <p className="text-[10px] text-green-400 font-medium truncate max-w-[150px]">Selected: {newCoverFile.name}</p>
                                ) : (
                                    <p className="text-[10px] text-gray-500">Square images recommended (JPG/PNG)</p>
                                )}
                            </div>
                            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">Track Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full p-3.5 bg-[#0f172a] border border-gray-700 rounded-xl focus:border-[#3b82f6] outline-none text-white text-sm transition"
                                placeholder="e.g. Bless Me"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">Artist Name</label>
                            <input
                                type="text"
                                value={artist}
                                onChange={e => setArtist(e.target.value)}
                                className="w-full p-3.5 bg-[#0f172a] border border-gray-700 rounded-xl focus:border-[#3b82f6] outline-none text-white text-sm transition"
                                placeholder="Jazel 'dBoy' Isaac"
                            />
                        </div>
                    </div>

                    {/* Audio Replacement */}
                    <div className="bg-[#0f172a] p-4 rounded-xl border border-gray-800">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2.5">Replace Audio</label>
                        <button
                            type="button"
                            onClick={() => audioInputRef.current.click()}
                            className="w-full text-xs bg-[#1e293b] border border-gray-700 text-gray-300 hover:border-[#3b82f6] hover:text-[#3b82f6] p-3.5 rounded-xl transition flex items-center justify-center gap-3"
                        >
                            <Music size={16} /> 
                            <span className="font-bold truncate max-w-[200px]">
                                {newAudioFile ? newAudioFile.name : 'Select new audio file...'}
                            </span>
                        </button>
                        {!newAudioFile && <p className="text-[10px] text-gray-500 mt-2 text-center">Leave empty to keep existing audio (MP3/WAV)</p>}
                        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e => setNewAudioFile(e.target.files[0] || null)} />
                    </div>

                    {/* Progress Bar */}
                    {saving && (
                        <div className="mt-2">
                            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-[#3b82f6] h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            {statusMsg && <p className="text-[10px] text-[#3b82f6] mt-1.5 font-bold text-center animate-pulse">{statusMsg}</p>}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 py-3.5 rounded-xl border border-gray-700 text-gray-400 font-bold hover:text-white hover:bg-white/5 transition text-sm disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-3.5 rounded-xl bg-[#3b82f6] text-white font-bold hover:bg-blue-600 transition text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Uploading...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
