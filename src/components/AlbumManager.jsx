import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Trash2, FolderOpen, CheckSquare, Square, Loader, Image, ChevronDown, ChevronUp, Star 
} from 'lucide-react';
import { db, storage } from '../lib/firebase';
import {
    collection, addDoc, getDocs, deleteDoc, doc,
    updateDoc, serverTimestamp, writeBatch, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function AlbumManager({ beats, onBeatsUpdated }) {
    const [albums, setAlbums] = useState([]);
    const [loadingAlbums, setLoadingAlbums] = useState(true);
    const [expanded, setExpanded] = useState(false);

    // Create album form
    const [albumName, setAlbumName] = useState('');
    const [albumCoverFile, setAlbumCoverFile] = useState(null);
    const [albumCoverPreview, setAlbumCoverPreview] = useState(null);
    const [creating, setCreating] = useState(false);

    // Beat picker per album
    const [pickerAlbumId, setPickerAlbumId] = useState(null);
    const [pickerSelected, setPickerSelected] = useState([]);
    const [savingPicker, setSavingPicker] = useState(false);

    const coverInputRef = useRef();

    useEffect(() => {
        fetchAlbums();
    }, []);

    const fetchAlbums = async () => {
        setLoadingAlbums(true);
        try {
            const snap = await getDocs(collection(db, 'albums'));
            setAlbums(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAlbums(false);
        }
    };

    const handleAlbumCoverChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAlbumCoverFile(file);
        setAlbumCoverPreview(URL.createObjectURL(file));
    };

    const handleCreateAlbum = async (e) => {
        e.preventDefault();
        if (!albumName.trim()) { alert('Album name is required.'); return; }
        setCreating(true);
        try {
            let coverUrl = '';
            if (albumCoverFile) {
                const storageRef = ref(storage, `covers/albums/${Date.now()}_${albumCoverFile.name}`);
                await uploadBytesResumable(storageRef, albumCoverFile);
                coverUrl = await getDownloadURL(storageRef);
            }
            const newAlbum = await addDoc(collection(db, 'albums'), {
                name: albumName.trim(),
                coverUrl,
                beatIds: [],
                createdAt: serverTimestamp(),
            });
            setAlbums(prev => [...prev, { id: newAlbum.id, name: albumName.trim(), coverUrl, beatIds: [] }]);
            setAlbumName('');
            setAlbumCoverFile(null);
            setAlbumCoverPreview(null);
        } catch (e) {
            console.error(e);
            alert('Failed to create album.');
        } finally {
            setCreating(false);
        }
    };

    const openBeatPicker = (album) => {
        setPickerAlbumId(album.id);
        setPickerSelected(album.beatIds || []);
    };

    const togglePickerBeat = (beatId) => {
        setPickerSelected(prev =>
            prev.includes(beatId) ? prev.filter(id => id !== beatId) : [...prev, beatId]
        );
    };

    const saveAlbumBeats = async () => {
        const album = albums.find(a => a.id === pickerAlbumId);
        if (!album) return;
        setSavingPicker(true);
        try {
            const batch = writeBatch(db);
            const oldIds = album.beatIds || [];
            const newIds = pickerSelected;

            // Beats removed from album
            oldIds.filter(id => !newIds.includes(id)).forEach(beatId => {
                batch.update(doc(db, 'beats', beatId), { albumId: null });
            });

            // Beats added to album
            newIds.filter(id => !oldIds.includes(id)).forEach(beatId => {
                batch.update(doc(db, 'beats', beatId), { albumId: pickerAlbumId });
            });

            // Update album doc
            batch.update(doc(db, 'albums', pickerAlbumId), { beatIds: newIds });

            await batch.commit();

            setAlbums(prev => prev.map(a => a.id === pickerAlbumId ? { ...a, beatIds: newIds } : a));
            setPickerAlbumId(null);
            if (onBeatsUpdated) onBeatsUpdated();
        } catch (e) {
            console.error(e);
            alert('Failed to update album beats.');
        } finally {
            setSavingPicker(false);
        }
    };

    const handleDeleteAlbum = async (album) => {
        if (!window.confirm(`Delete album "${album.name}"? Beats will not be deleted, just unlinked.`)) return;
        try {
            const batch = writeBatch(db);
            (album.beatIds || []).forEach(beatId => {
                batch.update(doc(db, 'beats', beatId), { albumId: null });
            });
            batch.delete(doc(db, 'albums', album.id));
            await batch.commit();
            setAlbums(prev => prev.filter(a => a.id !== album.id));
            if (onBeatsUpdated) onBeatsUpdated();
        } catch (e) {
            console.error(e);
            alert('Failed to delete album.');
        }
    };

    const toggleAlbumStar = async (album) => {
        try {
            if (!album.isStarred) {
                // Check total stars limit
                const starredBeats = await getDocs(query(collection(db, 'beats'), where('isStarred', '==', true)));
                const starredAlbums = await getDocs(query(collection(db, 'albums'), where('isStarred', '==', true)));
                const total = starredBeats.size + starredAlbums.size;

                if (total >= 6) {
                    alert('You can only have up to 6 featured items (beats + albums). Please unstar something else first.');
                    return;
                }
            }

            await updateDoc(doc(db, 'albums', album.id), {
                isStarred: !album.isStarred
            });
            fetchAlbums();
        } catch (e) {
            console.error(e);
            alert('Failed to update star status.');
        }
    };

    const pickerAlbum = albums.find(a => a.id === pickerAlbumId);

    return (
        <section className="bg-[#1e293b] rounded-xl border border-gray-800 overflow-hidden">
            {/* Header / Toggle */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition"
            >
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <FolderOpen size={20} className="text-[#facc15]" />
                    Album Manager
                    <span className="ml-2 text-sm font-normal text-gray-400">({albums.length} albums)</span>
                </h2>
                {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>

            {expanded && (
                <div className="px-6 pb-6 flex flex-col gap-6 border-t border-gray-800">

                    {/* Create Album Form */}
                    <form onSubmit={handleCreateAlbum} className="flex flex-col sm:flex-row gap-3 pt-5 items-end">
                        {/* Cover thumbnail input */}
                        <div
                            className="w-14 h-14 flex-shrink-0 bg-[#0f172a] border border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:border-[#facc15] transition flex items-center justify-center"
                            onClick={() => coverInputRef.current.click()}
                            title="Click to add album cover"
                        >
                            {albumCoverPreview
                                ? <img src={albumCoverPreview} alt="Album cover" className="w-full h-full object-cover" />
                                : <Image size={18} className="text-gray-600" />
                            }
                            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleAlbumCoverChange} />
                        </div>

                        <div className="flex-grow">
                            <label className="block text-gray-400 text-xs mb-1">New Album Name</label>
                            <input
                                type="text"
                                value={albumName}
                                onChange={e => setAlbumName(e.target.value)}
                                className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                                placeholder="e.g. Summer Vibes Vol.1"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={creating}
                            className="flex-shrink-0 bg-[#facc15] text-black font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                            {creating ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                            Create
                        </button>
                    </form>

                    {/* Albums List */}
                    {loadingAlbums ? (
                        <p className="text-gray-500 text-sm text-center py-4">Loading albums...</p>
                    ) : albums.length === 0 ? (
                        <p className="text-gray-600 text-sm text-center py-4">No albums yet. Create one above.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {albums.map(album => (
                                <div key={album.id} className="flex items-center gap-4 bg-[#0f172a] border border-gray-800 rounded-xl p-3">
                                    {/* Album Cover */}
                                    <div className="w-12 h-12 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden">
                                        {album.coverUrl
                                            ? <img src={album.coverUrl} alt={album.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-gray-600"><FolderOpen size={18} /></div>
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-grow min-w-0">
                                        <div className="font-bold text-white text-sm truncate">{album.name}</div>
                                        <div className="text-xs text-gray-500">{album.beatIds?.length || 0} beat{(album.beatIds?.length || 0) !== 1 ? 's' : ''}</div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button 
                                            onClick={() => toggleAlbumStar(album)}
                                            className={`p-2 rounded-lg transition ${album.isStarred ? 'text-[#facc15] bg-[#facc15]/10' : 'text-gray-600 hover:text-gray-400'}`}
                                            title={album.isStarred ? "Unstar album" : "Star album"}
                                        >
                                            <Star size={16} fill={album.isStarred ? "currentColor" : "none"} />
                                        </button>
                                        <button
                                            onClick={() => openBeatPicker(album)}
                                            className="text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg transition"
                                        >
                                            Edit Beats
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAlbum(album)}
                                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition"
                                            title="Delete album"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Beat Picker Modal */}
            {pickerAlbumId && pickerAlbum && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-[#1e293b] border border-gray-700 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-gray-700">
                            <h3 className="font-bold text-white">
                                Edit Beats — <span className="text-[#facc15]">{pickerAlbum.name}</span>
                            </h3>
                            <button onClick={() => setPickerAlbumId(null)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <div className="overflow-y-auto flex-grow p-4 flex flex-col gap-2">
                            {beats.length === 0 && (
                                <p className="text-gray-500 text-sm text-center py-6">No beats in catalog yet.</p>
                            )}
                            {beats.map(beat => {
                                const selected = pickerSelected.includes(beat.id);
                                return (
                                    <div
                                        key={beat.id}
                                        onClick={() => togglePickerBeat(beat.id)}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border ${
                                            selected
                                                ? 'bg-[#facc15]/10 border-[#facc15]/40'
                                                : 'bg-[#0f172a] border-gray-800 hover:border-gray-600'
                                        }`}
                                    >
                                        {selected
                                            ? <CheckSquare size={18} className="text-[#facc15] flex-shrink-0" />
                                            : <Square size={18} className="text-gray-600 flex-shrink-0" />
                                        }
                                        <div className="w-8 h-8 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                                            {beat.coverUrl && <img src={beat.coverUrl} alt="" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-white truncate">{beat.title}</div>
                                            {beat.albumId && beat.albumId !== pickerAlbumId && (
                                                <div className="text-xs text-amber-400">In another album</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-gray-700 flex gap-3">
                            <button
                                onClick={() => setPickerAlbumId(null)}
                                className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white transition text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveAlbumBeats}
                                disabled={savingPicker}
                                className="flex-1 py-2.5 rounded-lg bg-[#facc15] text-black font-bold hover:bg-yellow-400 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {savingPicker ? <Loader size={14} className="animate-spin" /> : null}
                                Save ({pickerSelected.length} beats)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
