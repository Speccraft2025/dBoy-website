import React, { useState, useRef } from 'react';
import { X, Upload, Music, Image, Save, Loader } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function EditBeatModal({ beat, onClose, onSaved }) {
    const [title, setTitle] = useState(beat.title || '');
    const [bpm, setBpm] = useState(beat.bpm || '');
    const [beatKey, setBeatKey] = useState(beat.key || '');
    const [tags, setTags] = useState((beat.tags || []).join(', '));
    const [price, setPrice] = useState(beat.price ?? 50);

    const [newCoverFile, setNewCoverFile] = useState(null);
    const [newAudioFile, setNewAudioFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(beat.coverUrl || null);

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
                bpm: Number(bpm) || 0,
                key: beatKey.trim(),
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                price: Number(price) || 50,
            };

            if (newCoverFile) {
                setStatusMsg('Uploading cover art...');
                updates.coverUrl = await uploadFile(
                    newCoverFile,
                    `covers/${Date.now()}_${newCoverFile.name}`,
                    setProgress
                );
            }

            if (newAudioFile) {
                setStatusMsg('Uploading audio...');
                setProgress(0);
                updates.audioUrl = await uploadFile(
                    newAudioFile,
                    `beats/${Date.now()}_${newAudioFile.name}`,
                    setProgress
                );
            }

            setStatusMsg('Saving...');
            await updateDoc(doc(db, 'beats', beat.id), updates);

            onSaved({ ...beat, ...updates });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#1e293b] border border-gray-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Edit Beat</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-5">
                    {/* Cover Art */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Cover Art</label>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-20 h-20 bg-[#0f172a] rounded-lg overflow-hidden border border-gray-700 flex-shrink-0 cursor-pointer hover:border-[#facc15] transition"
                                onClick={() => coverInputRef.current.click()}
                            >
                                {coverPreview
                                    ? <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-gray-600"><Image size={24} /></div>
                                }
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={() => coverInputRef.current.click()}
                                    className="text-sm bg-[#0f172a] border border-gray-600 text-gray-300 hover:border-[#facc15] px-4 py-2 rounded-lg transition flex items-center gap-2"
                                >
                                    <Image size={14} /> Replace Cover
                                </button>
                                {newCoverFile && <p className="text-xs text-[#facc15] mt-1 truncate max-w-[180px]">{newCoverFile.name}</p>}
                            </div>
                            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                            placeholder="Beat title"
                        />
                    </div>

                    {/* BPM / Key */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">BPM</label>
                            <input
                                type="number"
                                value={bpm}
                                onChange={e => setBpm(e.target.value)}
                                className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                                placeholder="140"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Key</label>
                            <input
                                type="text"
                                value={beatKey}
                                onChange={e => setBeatKey(e.target.value)}
                                className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                                placeholder="F min"
                            />
                        </div>
                    </div>

                    {/* Tags / Price */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Tags (comma sep)</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                                placeholder="hiphop, trap"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Price ($)</label>
                            <input
                                type="number"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                                placeholder="50"
                            />
                        </div>
                    </div>

                    {/* Audio File Replacement */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Replace Audio File</label>
                        <button
                            type="button"
                            onClick={() => audioInputRef.current.click()}
                            className="text-sm bg-[#0f172a] border border-gray-600 text-gray-300 hover:border-[#facc15] px-4 py-2 rounded-lg transition flex items-center gap-2"
                        >
                            <Music size={14} /> {newAudioFile ? newAudioFile.name : 'Choose new audio...'}
                        </button>
                        {!newAudioFile && <p className="text-xs text-gray-600 mt-1">Leave blank to keep current audio.</p>}
                        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e => setNewAudioFile(e.target.files[0] || null)} />
                    </div>

                    {/* Upload Progress */}
                    {saving && (
                        <div>
                            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-[#facc15] h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            {statusMsg && <p className="text-xs text-[#facc15] mt-1 text-center">{statusMsg}</p>}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 transition text-sm disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-3 rounded-lg bg-[#facc15] text-black font-bold hover:bg-yellow-400 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
