import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Edit2, LogOut, CheckCircle, XCircle, Loader, Clock } from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import EditBeatModal from './EditBeatModal';
import AlbumManager from './AlbumManager';

const MAX_FILES = 20;

// Per-file status: 'waiting' | 'uploading' | 'done' | 'error'
function FileQueueRow({ item }) {
    const icons = {
        waiting: <Clock size={14} className="text-gray-500" />,
        uploading: <Loader size={14} className="text-[#facc15] animate-spin" />,
        done: <CheckCircle size={14} className="text-green-400" />,
        error: <XCircle size={14} className="text-red-400" />,
    };
    const colors = {
        waiting: 'bg-gray-700',
        uploading: 'bg-[#facc15]',
        done: 'bg-green-500',
        error: 'bg-red-500',
    };
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs">
                {icons[item.status]}
                <span className="text-gray-300 truncate flex-grow">{item.name}</span>
                <span className="text-gray-500 flex-shrink-0">
                    {item.status === 'uploading' ? `${Math.round(item.progress)}%` : item.status}
                </span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-1 rounded-full transition-all duration-300 ${colors[item.status]}`}
                    style={{ width: `${item.status === 'done' ? 100 : item.status === 'error' ? 100 : item.progress}%` }}
                />
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const [beats, setBeats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editBeat, setEditBeat] = useState(null);
    const navigate = useNavigate();

    // Form state
    const [title, setTitle] = useState('');
    const [bpm, setBpm] = useState('');
    const [beatKey, setBeatKey] = useState('');
    const [tags, setTags] = useState('');
    const [price, setPrice] = useState('50');
    const [audioFiles, setAudioFiles] = useState([]);
    const [coverFile, setCoverFile] = useState(null);

    // Per-file queue
    const [fileQueue, setFileQueue] = useState([]);

    useEffect(() => {
        fetchBeats();
    }, []);

    const fetchBeats = async () => {
        try {
            const snap = await getDocs(collection(db, 'beats'));
            setBeats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleAudioSelect = (e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > MAX_FILES) {
            alert(`You can upload a maximum of ${MAX_FILES} beats at once. You selected ${selected.length}.`);
            e.target.value = '';
            setAudioFiles([]);
            return;
        }
        setAudioFiles(selected);
    };

    const updateQueue = (index, patch) => {
        setFileQueue(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
    };

    const handleUpload = async (e) => {
        e.preventDefault();

        if (audioFiles.length === 0 || !coverFile) {
            alert('Audio file(s) and Cover Art are required!');
            return;
        }
        if (audioFiles.length === 1 && !title) {
            alert('Beat Title is required for single uploads!');
            return;
        }

        setLoading(true);

        // Initialise queue display
        const initialQueue = audioFiles.map(f => ({ name: f.name, status: 'waiting', progress: 0 }));
        setFileQueue(initialQueue);

        try {
            // Upload cover once
            const coverRef = ref(storage, `covers/${Date.now()}_${coverFile.name}`);
            try {
                const coverUploadTask = uploadBytesResumable(coverRef, coverFile);
                await new Promise((resolve, reject) => {
                    coverUploadTask.on('state_changed', null, reject, resolve);
                });
            } catch (coverErr) {
                console.error("Cover upload failed:", coverErr);
                throw new Error("Cover Art upload failed (likely CORS or Permissions). Check your Firebase settings.");
            }
            const coverUrl = await getDownloadURL(coverRef);

            const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
            
            // Parallel uploads
            await Promise.all(audioFiles.map(async (file, i) => {
                updateQueue(i, { status: 'uploading', progress: 0 });

                let beatTitle = audioFiles.length > 1
                    ? file.name.replace(/\.[^/.]+$/, '')
                    : title;

                const audioRef = ref(storage, `beats/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(audioRef, file);

                return new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snap) => {
                            const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
                            updateQueue(i, { progress: pct });
                        },
                        (err) => {
                            updateQueue(i, { status: 'error' });
                            reject(err);
                        },
                        async () => {
                            try {
                                const audioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                await addDoc(collection(db, 'beats'), {
                                    title: beatTitle,
                                    bpm: Number(bpm) || 0,
                                    key: beatKey || '',
                                    tags: tagsArray,
                                    price: Number(price) || 50,
                                    coverUrl,
                                    audioUrl,
                                    albumId: null,
                                    createdAt: serverTimestamp(),
                                });
                                updateQueue(i, { status: 'done', progress: 100 });
                                resolve();
                            } catch (firestoreErr) {
                                updateQueue(i, { status: 'error' });
                                reject(firestoreErr);
                            }
                        }
                    );
                });
            }));

            // Reset form after short delay so user can see all ✅
            setTimeout(() => {
                setTitle(''); setBpm(''); setBeatKey(''); setTags('');
                setAudioFiles([]); setCoverFile(null); setFileQueue([]);
                document.getElementById('uploadForm')?.reset();
                fetchBeats();
                setLoading(false);
            }, 1500);

        } catch (err) {
            console.error(err);
            alert('Upload failed: ' + err.message);
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this beat?')) {
            try {
                await deleteDoc(doc(db, 'beats', id));
                fetchBeats();
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleBeatSaved = (updatedBeat) => {
        setBeats(prev => prev.map(b => b.id === updatedBeat.id ? updatedBeat : b));
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-4 sm:p-6 font-sans">
            {/* Edit Modal */}
            {editBeat && (
                <EditBeatModal
                    beat={editBeat}
                    onClose={() => setEditBeat(null)}
                    onSaved={handleBeatSaved}
                />
            )}

            {/* Header */}
            <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#facc15]">Creator Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage your catalog, albums, and profile</p>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition rounded">
                    <LogOut size={16} /> Logout
                </button>
            </header>

            <main className="flex flex-col gap-8">

                {/* Top row: Upload + Catalog */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Upload Form */}
                    <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-1 border-t-4 border-t-[#facc15]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Upload size={20} className="text-[#facc15]" /> Upload Beats
                        </h2>
                        <form id="uploadForm" className="flex flex-col gap-4 text-sm" onSubmit={handleUpload}>

                            <div>
                                <label className="block text-gray-400 mb-1">
                                    Audio File(s) — MP3/WAV
                                    <span className="ml-1 text-[#facc15]">(max {MAX_FILES})</span>
                                </label>
                                <input
                                    type="file" required multiple accept="audio/*"
                                    onChange={handleAudioSelect}
                                    className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[#facc15] file:text-black hover:file:bg-yellow-300 transition cursor-pointer"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {audioFiles.length > 0
                                        ? `${audioFiles.length} file${audioFiles.length > 1 ? 's' : ''} selected`
                                        : `Select up to ${MAX_FILES} files. Filenames used as titles for bulk uploads.`
                                    }
                                </p>
                            </div>

                            <div>
                                <label className="block text-gray-400 mb-1">Cover Art (applied to all) *</label>
                                <input
                                    type="file" required accept="image/*"
                                    onChange={(e) => setCoverFile(e.target.files[0])}
                                    className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[#3b82f6] file:text-white hover:file:bg-blue-500 transition cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 mb-1">Beat Title (optional for bulk)</label>
                                <input
                                    type="text"
                                    disabled={audioFiles.length > 1}
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition disabled:opacity-40"
                                    placeholder={audioFiles.length > 1 ? 'Auto from filenames' : 'e.g. MF Doom Inspired Beat'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-400 mb-1">BPM</label>
                                    <input type="number" value={bpm} onChange={e => setBpm(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="140" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 mb-1">Key</label>
                                    <input type="text" value={beatKey} onChange={e => setBeatKey(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="F min" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-400 mb-1">Tags (comma sep)</label>
                                    <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="hiphop, jazz" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 mb-1">Price ($)</label>
                                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="50" />
                                </div>
                            </div>

                            {/* File Queue */}
                            {fileQueue.length > 0 && (
                                <div className="flex flex-col gap-2.5 bg-[#0f172a] p-3 rounded-lg border border-gray-800 max-h-48 overflow-y-auto">
                                    {fileQueue.map((item, i) => <FileQueueRow key={i} item={item} />)}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-2 w-full bg-[#facc15] text-black font-bold py-3 rounded hover:bg-yellow-400 transition flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                <Plus size={18} />
                                {loading ? 'Uploading...' : `Upload ${audioFiles.length > 1 ? `${audioFiles.length} Beats` : 'Beat'}`}
                            </button>
                        </form>
                    </section>

                    {/* Manage Catalog */}
                    <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-2">
                        <h2 className="text-xl font-bold mb-6">Manage Catalog</h2>
                        {beats.length === 0 ? (
                            <p className="text-gray-400 text-center py-10">No beats uploaded yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-gray-400 border-b border-gray-800">
                                        <tr>
                                            <th className="pb-3 font-medium">Cover</th>
                                            <th className="pb-3 font-medium">Title</th>
                                            <th className="pb-3 font-medium hidden sm:table-cell">BPM / Key</th>
                                            <th className="pb-3 font-medium hidden md:table-cell">Tags</th>
                                            <th className="pb-3 font-medium">Price</th>
                                            <th className="pb-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {beats.map(beat => (
                                            <tr key={beat.id} className="border-b border-gray-800/50 hover:bg-white/5 transition">
                                                <td className="py-3">
                                                    <div className="w-10 h-10 bg-gray-800 rounded overflow-hidden">
                                                        {beat.coverUrl && <img src={beat.coverUrl} alt="cover" className="w-full h-full object-cover" />}
                                                    </div>
                                                </td>
                                                <td className="py-3 font-bold max-w-[120px] truncate">
                                                    {beat.title}
                                                    {beat.albumId && (
                                                        <span className="ml-2 text-[10px] text-[#facc15] bg-[#facc15]/10 px-1.5 py-0.5 rounded font-normal">album</span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-gray-400 hidden sm:table-cell">{beat.bpm || '—'} / {beat.key || '—'}</td>
                                                <td className="py-3 hidden md:table-cell">
                                                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                                                        {(beat.tags || []).slice(0, 3).map((tag, i) => (
                                                            <span key={i} className="text-[9px] bg-[#111827] text-gray-300 px-1.5 py-0.5 rounded">{tag}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-[#facc15]">${beat.price}</td>
                                                <td className="py-3">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => setEditBeat(beat)}
                                                            className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition"
                                                            title="Edit beat"
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(beat.id)}
                                                            className="p-2 text-red-400 hover:bg-red-400/10 rounded transition"
                                                            title="Delete beat"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>

                {/* Album Manager (full width) */}
                <AlbumManager beats={beats} onBeatsUpdated={fetchBeats} />

            </main>
        </div>
    );
}
