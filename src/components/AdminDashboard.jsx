import React, { useState, useEffect, useMemo } from 'react';
import { 
    Upload, Plus, Trash2, Edit2, LogOut, CheckCircle, XCircle, Loader, Clock, Star,
    Search, Filter, ChevronDown, X, Music2, FileText, Tag, CheckSquare, Square, Layers
} from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, updateDoc, writeBatch,
    serverTimestamp, query, where, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import EditBeatModal from './EditBeatModal';
import AlbumManager from './AlbumManager';
import BulkEditModal from './BulkEditModal';

const MAX_FILES = 20;

const GENRES = ['Hip-Hop', 'Trap', 'Afrobeat', 'R&B', 'Pop', 'Drill', 'Jazz', 'Electronic', 'Gospel', 'Lo-fi', 'Other'];
const KEYS   = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

// ─── Per-file upload status row ──────────────────────────────────────────────
function FileQueueRow({ item }) {
    const icons = {
        waiting:  <Clock size={14} className="text-gray-500" />,
        uploading: <Loader size={14} className="text-[#facc15] animate-spin" />,
        done:     <CheckCircle size={14} className="text-green-400" />,
        error:    <XCircle size={14} className="text-red-400" />,
    };
    const colors = {
        waiting: 'bg-gray-700', uploading: 'bg-[#facc15]', done: 'bg-green-500', error: 'bg-red-500',
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [beats, setBeats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editBeat, setEditBeat] = useState(null);
    const navigate = useNavigate();

    // ── Upload form state ──
    const [title, setTitle]       = useState('');
    const [bpm, setBpm]           = useState('');
    const [beatKey, setBeatKey]   = useState('');
    const [tags, setTags]         = useState('');
    const [price, setPrice]       = useState('50');
    const [genre, setGenre]       = useState('');
    const [description, setDescription] = useState('');
    const [audioFiles, setAudioFiles]   = useState([]);
    const [coverFile, setCoverFile]     = useState(null);
    const [fileQueue, setFileQueue]     = useState([]);

    // ── Filters ──
    const [filterOpen, setFilterOpen]   = useState(false);
    const [filterText, setFilterText]   = useState('');
    const [filterBpmMin, setFilterBpmMin] = useState('');
    const [filterBpmMax, setFilterBpmMax] = useState('');
    const [filterKey, setFilterKey]     = useState('');
    const [filterGenre, setFilterGenre] = useState('');
    const [filterFeatured, setFilterFeatured] = useState('all'); // 'all' | 'yes' | 'no'

    // ── Multi-select ──
    const [selected, setSelected]         = useState(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);

    useEffect(() => { fetchBeats(); }, []);

    const fetchBeats = async () => {
        try {
            const snap = await getDocs(collection(db, 'beats'));
            setBeats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    // ── Derived filtered list ──
    const filteredBeats = useMemo(() => {
        return beats.filter(b => {
            if (filterText) {
                const q = filterText.toLowerCase();
                const haystack = [b.title, b.genre, b.description, ...(b.tags || [])].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (filterBpmMin && b.bpm < Number(filterBpmMin)) return false;
            if (filterBpmMax && b.bpm > Number(filterBpmMax)) return false;
            if (filterKey && b.key !== filterKey) return false;
            if (filterGenre && b.genre !== filterGenre) return false;
            if (filterFeatured === 'yes' && !b.isStarred) return false;
            if (filterFeatured === 'no'  && b.isStarred)  return false;
            return true;
        });
    }, [beats, filterText, filterBpmMin, filterBpmMax, filterKey, filterGenre, filterFeatured]);

    const activeFilterCount = [filterText, filterBpmMin, filterBpmMax, filterKey, filterGenre]
        .filter(Boolean).length + (filterFeatured !== 'all' ? 1 : 0);

    const clearFilters = () => {
        setFilterText(''); setFilterBpmMin(''); setFilterBpmMax('');
        setFilterKey(''); setFilterGenre(''); setFilterFeatured('all');
    };

    // ── Checkbox helpers ──
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === filteredBeats.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredBeats.map(b => b.id)));
        }
    };

    // ── Bulk delete ──
    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selected.size} beat${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
        try {
            const batch = writeBatch(db);
            selected.forEach(id => batch.delete(doc(db, 'beats', id)));
            await batch.commit();
            setSelected(new Set());
            fetchBeats();
        } catch (e) {
            console.error(e);
            alert('Bulk delete failed: ' + e.message);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleAudioSelect = (e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > MAX_FILES) {
            alert(`Max ${MAX_FILES} files. You selected ${selected.length}.`);
            e.target.value = '';
            setAudioFiles([]);
            return;
        }
        setAudioFiles(selected);
    };

    const updateQueue = (index, patch) =>
        setFileQueue(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));

    const handleUpload = async (e) => {
        e.preventDefault();
        if (audioFiles.length === 0 || !coverFile) { alert('Audio file(s) and Cover Art are required!'); return; }
        if (audioFiles.length === 1 && !title)       { alert('Beat Title is required for single uploads!'); return; }

        setLoading(true);
        setFileQueue(audioFiles.map(f => ({ name: f.name, status: 'waiting', progress: 0 })));

        try {
            const coverRef = ref(storage, `covers/${Date.now()}_${coverFile.name}`);
            await new Promise((resolve, reject) =>
                uploadBytesResumable(coverRef, coverFile).on('state_changed', null, reject, resolve)
            );
            const coverUrl = await getDownloadURL(coverRef);
            const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);

            await Promise.all(audioFiles.map(async (file, i) => {
                updateQueue(i, { status: 'uploading', progress: 0 });
                const beatTitle = audioFiles.length > 1 ? file.name.replace(/\.[^/.]+$/, '') : title;
                const audioRef  = ref(storage, `beats/${Date.now()}_${file.name}`);
                const task      = uploadBytesResumable(audioRef, file);

                return new Promise((resolve, reject) => {
                    task.on('state_changed',
                        (snap) => updateQueue(i, { progress: (snap.bytesTransferred / snap.totalBytes) * 100 }),
                        (err)  => { updateQueue(i, { status: 'error' }); reject(err); },
                        async () => {
                            try {
                                const audioUrl = await getDownloadURL(task.snapshot.ref);
                                await addDoc(collection(db, 'beats'), {
                                    title: beatTitle,
                                    bpm: Number(bpm) || 0,
                                    key: beatKey || '',
                                    tags: tagsArray,
                                    price: Number(price) || 50,
                                    genre: genre.trim() || '',
                                    description: description.trim() || '',
                                    likes: 0,
                                    coverUrl, audioUrl,
                                    albumId: null,
                                    createdAt: serverTimestamp(),
                                });
                                updateQueue(i, { status: 'done', progress: 100 });
                                resolve();
                            } catch (err) {
                                updateQueue(i, { status: 'error' }); reject(err);
                            }
                        }
                    );
                });
            }));

            setTimeout(() => {
                setTitle(''); setBpm(''); setBeatKey(''); setTags('');
                setGenre(''); setDescription('');
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
        if (window.confirm('Delete this beat?')) {
            try { await deleteDoc(doc(db, 'beats', id)); fetchBeats(); }
            catch (e) { console.error(e); }
        }
    };

    const handleBeatSaved = (updatedBeat) =>
        setBeats(prev => prev.map(b => b.id === updatedBeat.id ? updatedBeat : b));

    const toggleBeatStar = async (beat) => {
        try {
            if (!beat.isStarred) {
                const [sb, sa] = await Promise.all([
                    getDocs(query(collection(db, 'beats'),  where('isStarred', '==', true))),
                    getDocs(query(collection(db, 'albums'), where('isStarred', '==', true))),
                ]);
                if (sb.size + sa.size >= 6) {
                    alert('Max 6 featured items. Unstar something first.');
                    return;
                }
            }
            await updateDoc(doc(db, 'beats', beat.id), { isStarred: !beat.isStarred });
            fetchBeats();
        } catch (e) { console.error(e); alert('Failed to update star status.'); }
    };

    const allFilteredSelected = filteredBeats.length > 0 && selected.size === filteredBeats.length;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-4 sm:p-6 font-sans">
            {/* Modals */}
            {editBeat && (
                <EditBeatModal beat={editBeat} onClose={() => setEditBeat(null)} onSaved={handleBeatSaved} />
            )}
            {showBulkEdit && (
                <BulkEditModal
                    selectedIds={[...selected]}
                    onClose={() => setShowBulkEdit(false)}
                    onSaved={() => { setSelected(new Set()); fetchBeats(); }}
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

                    {/* ── Upload Form ── */}
                    <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-1 border-t-4 border-t-[#facc15]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Upload size={20} className="text-[#facc15]" /> Upload Beats
                        </h2>
                        <form id="uploadForm" className="flex flex-col gap-4 text-sm" onSubmit={handleUpload}>

                            <div>
                                <label className="block text-gray-400 mb-1">
                                    Audio File(s) — MP3/WAV <span className="ml-1 text-[#facc15]">(max {MAX_FILES})</span>
                                </label>
                                <input
                                    type="file" required multiple accept="audio/*"
                                    onChange={handleAudioSelect}
                                    className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[#facc15] file:text-black hover:file:bg-yellow-300 transition cursor-pointer"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {audioFiles.length > 0
                                        ? `${audioFiles.length} file${audioFiles.length > 1 ? 's' : ''} selected`
                                        : `Select up to ${MAX_FILES} files. Filenames used as titles for bulk.`}
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

                            {/* Genre */}
                            <div>
                                <label className="block text-gray-400 mb-1 flex items-center gap-1"><Music2 size={12} /> Genre</label>
                                <select
                                    value={genre}
                                    onChange={e => setGenre(e.target.value)}
                                    className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition text-white"
                                >
                                    <option value="">Select genre...</option>
                                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-gray-400 mb-1 flex items-center gap-1"><FileText size={12} /> Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Describe the vibe, mood, or inspiration..."
                                    className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition resize-none"
                                />
                            </div>

                            {/* File Queue */}
                            {fileQueue.length > 0 && (
                                <div className="flex flex-col gap-2.5 bg-[#0f172a] p-3 rounded-lg border border-gray-800 max-h-48 overflow-y-auto">
                                    {fileQueue.map((item, i) => <FileQueueRow key={i} item={item} />)}
                                </div>
                            )}

                            <button
                                type="submit" disabled={loading}
                                className="mt-2 w-full bg-[#facc15] text-black font-bold py-3 rounded hover:bg-yellow-400 transition flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                <Plus size={18} />
                                {loading ? 'Uploading...' : `Upload ${audioFiles.length > 1 ? `${audioFiles.length} Beats` : 'Beat'}`}
                            </button>
                        </form>
                    </section>

                    {/* ── Manage Catalog ── */}
                    <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-2 flex flex-col">
                        {/* Catalog Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold">Manage Catalog</h2>
                                <span className="text-xs bg-[#facc15]/10 text-[#facc15] border border-[#facc15]/20 px-2 py-0.5 rounded-full font-bold">
                                    {beats.length} beat{beats.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Search + Filter toggle */}
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        value={filterText}
                                        onChange={e => setFilterText(e.target.value)}
                                        placeholder="Search..."
                                        className="pl-8 pr-3 py-2 text-xs bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white transition w-40"
                                    />
                                </div>
                                <button
                                    onClick={() => setFilterOpen(o => !o)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${filterOpen || activeFilterCount > 0 ? 'bg-[#facc15]/10 border-[#facc15]/40 text-[#facc15]' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                                >
                                    <Filter size={13} /> Filters
                                    {activeFilterCount > 0 && (
                                        <span className="bg-[#facc15] text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                                    )}
                                    <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {activeFilterCount > 0 && (
                                    <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-400 transition flex items-center gap-1">
                                        <X size={12} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {filterOpen && (
                            <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <label className="text-gray-500 mb-1 block">BPM Min</label>
                                    <input type="number" value={filterBpmMin} onChange={e => setFilterBpmMin(e.target.value)} placeholder="e.g. 80" className="w-full p-2 bg-[#1e293b] border border-gray-700 rounded focus:border-[#facc15] outline-none text-white transition" />
                                </div>
                                <div>
                                    <label className="text-gray-500 mb-1 block">BPM Max</label>
                                    <input type="number" value={filterBpmMax} onChange={e => setFilterBpmMax(e.target.value)} placeholder="e.g. 160" className="w-full p-2 bg-[#1e293b] border border-gray-700 rounded focus:border-[#facc15] outline-none text-white transition" />
                                </div>
                                <div>
                                    <label className="text-gray-500 mb-1 block">Key</label>
                                    <select value={filterKey} onChange={e => setFilterKey(e.target.value)} className="w-full p-2 bg-[#1e293b] border border-gray-700 rounded focus:border-[#facc15] outline-none text-white transition">
                                        <option value="">Any key</option>
                                        {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-500 mb-1 block">Genre</label>
                                    <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)} className="w-full p-2 bg-[#1e293b] border border-gray-700 rounded focus:border-[#facc15] outline-none text-white transition">
                                        <option value="">Any genre</option>
                                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-500 mb-1 block">Featured</label>
                                    <select value={filterFeatured} onChange={e => setFilterFeatured(e.target.value)} className="w-full p-2 bg-[#1e293b] border border-gray-700 rounded focus:border-[#facc15] outline-none text-white transition">
                                        <option value="all">All</option>
                                        <option value="yes">Featured only</option>
                                        <option value="no">Not featured</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Multi-select action bar */}
                        {selected.size > 0 && (
                            <div className="flex items-center gap-3 mb-3 bg-[#facc15]/5 border border-[#facc15]/20 rounded-xl px-4 py-2">
                                <span className="text-sm text-[#facc15] font-bold">{selected.size} selected</span>
                                <div className="flex items-center gap-2 ml-auto">
                                    <button
                                        onClick={() => setShowBulkEdit(true)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-400/20 rounded-lg transition"
                                    >
                                        <Layers size={13} /> Bulk Edit
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-400/20 rounded-lg transition"
                                    >
                                        <Trash2 size={13} /> Delete
                                    </button>
                                    <button
                                        onClick={() => setSelected(new Set())}
                                        className="text-gray-500 hover:text-white transition"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Table */}
                        {beats.length === 0 ? (
                            <p className="text-gray-400 text-center py-10">No beats uploaded yet.</p>
                        ) : filteredBeats.length === 0 ? (
                            <p className="text-gray-400 text-center py-10 text-sm">No beats match your filters.</p>
                        ) : (
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-gray-400 border-b border-gray-800">
                                        <tr>
                                            {/* Select all checkbox */}
                                            <th className="pb-3 w-8">
                                                <button onClick={toggleSelectAll} className="text-gray-500 hover:text-[#facc15] transition">
                                                    {allFilteredSelected
                                                        ? <CheckSquare size={15} className="text-[#facc15]" />
                                                        : <Square size={15} />}
                                                </button>
                                            </th>
                                            <th className="pb-3 font-medium">Cover</th>
                                            <th className="pb-3 font-medium">Title</th>
                                            <th className="pb-3 font-medium hidden sm:table-cell">BPM / Key</th>
                                            <th className="pb-3 font-medium hidden md:table-cell">Genre</th>
                                            <th className="pb-3 font-medium hidden md:table-cell">Tags</th>
                                            <th className="pb-3 font-medium text-center">♥</th>
                                            <th className="pb-3 font-medium text-center">⭐</th>
                                            <th className="pb-3 font-medium">Price</th>
                                            <th className="pb-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                </table>
                                {/* Scrollable tbody wrapper */}
                                <div className="overflow-y-auto" style={{ maxHeight: 'calc(13 * 3.25rem)' }}>
                                    <table className="w-full text-left text-sm">
                                        <tbody>
                                            {filteredBeats.map(beat => (
                                                <tr
                                                    key={beat.id}
                                                    className={`border-b border-gray-800/50 hover:bg-white/5 transition ${selected.has(beat.id) ? 'bg-[#facc15]/5' : ''}`}
                                                >
                                                    <td className="py-3 w-8">
                                                        <button
                                                            onClick={() => toggleSelect(beat.id)}
                                                            className="text-gray-500 hover:text-[#facc15] transition"
                                                        >
                                                            {selected.has(beat.id)
                                                                ? <CheckSquare size={15} className="text-[#facc15]" />
                                                                : <Square size={15} />}
                                                        </button>
                                                    </td>
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
                                                    <td className="py-3 text-gray-400 hidden md:table-cell text-xs">{beat.genre || '—'}</td>
                                                    <td className="py-3 hidden md:table-cell">
                                                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                                                            {(beat.tags || []).slice(0, 3).map((tag, i) => (
                                                                <span key={i} className="text-[9px] bg-[#111827] text-gray-300 px-1.5 py-0.5 rounded">{tag}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    {/* Likes */}
                                                    <td className="py-3 text-center text-xs text-gray-400">
                                                        <span className="flex items-center justify-center gap-0.5">
                                                            ❤️ {beat.likes || 0}
                                                        </span>
                                                    </td>
                                                    {/* Featured star */}
                                                    <td className="py-3 text-center">
                                                        <button
                                                            onClick={() => toggleBeatStar(beat)}
                                                            className={`p-2 rounded-full transition ${beat.isStarred ? 'text-[#facc15] bg-[#facc15]/10' : 'text-gray-600 hover:text-gray-400'}`}
                                                            title={beat.isStarred ? 'Unstar beat' : 'Star beat'}
                                                        >
                                                            <Star size={16} fill={beat.isStarred ? 'currentColor' : 'none'} />
                                                        </button>
                                                    </td>
                                                    <td className="py-3 text-[#facc15]">${beat.price}</td>
                                                    <td className="py-3">
                                                        <div className="flex justify-end gap-1">
                                                            <button onClick={() => setEditBeat(beat)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition" title="Edit beat">
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button onClick={() => handleDelete(beat.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded transition" title="Delete beat">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredBeats.length !== beats.length && (
                                    <p className="text-center text-xs text-gray-500 mt-3">
                                        Showing {filteredBeats.length} of {beats.length} beats
                                    </p>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Album Manager */}
                <AlbumManager beats={beats} onBeatsUpdated={fetchBeats} />
            </main>
        </div>
    );
}
