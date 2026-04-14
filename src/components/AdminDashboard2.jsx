import React, { useState, useEffect } from 'react';
import { 
    Upload, Plus, Trash2, LogOut, Loader, Settings, MessageSquare, Link as LinkIcon
} from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc,
    serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard2() {
    const [projects, setProjects] = useState([]);
    const [promo, setPromo] = useState({ isEnabled: false, text: '' });
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingPromo, setLoadingPromo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const navigate = useNavigate();

    // ── Upload form state ──
    const [title, setTitle]       = useState('');
    const [artist, setArtist]     = useState('Jazel \'dBoy\' Isaac');
    const [audioFile, setAudioFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);

    // ── TEMPORARY INIT SEED ──
    useEffect(() => {
        const seedHardcodedProjects = async () => {
            if (localStorage.getItem('seeded_hardcoded_v1')) return;
            try {
                await addDoc(collection(db, 'projects'), { title: 'Bless Me', artist: "Jazel 'dBoy' Isaac", coverUrl: '', audioUrl: '/Bless Me.mp3', createdAt: serverTimestamp() });
                await addDoc(collection(db, 'projects'), { title: 'Misunderstanding', artist: "Jazel 'dBoy' Isaac", coverUrl: '', audioUrl: '/MISUNDERSTANDING.mp3', createdAt: serverTimestamp() });
                localStorage.setItem('seeded_hardcoded_v1', 'true');
                fetchProjects();
            } catch(e) { console.error('Seed Error:', e); }
        };
        seedHardcodedProjects();
    }, []);

    useEffect(() => { 
        fetchProjects(); 
        fetchPromo();
    }, []);

    const fetchPromo = async () => {
        try {
            const promoDoc = await getDoc(doc(db, 'settings', 'promo'));
            if (promoDoc.exists()) {
                setPromo(promoDoc.data());
            }
        } catch (e) { console.error('Error fetching promo:', e); }
    };

    const fetchProjects = async () => {
        setLoadingProjects(true);
        try {
            const snap = await getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc')));
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setLoadingProjects(false); }
    };

    const handleSavePromo = async () => {
        setLoadingPromo(true);
        try {
            await setDoc(doc(db, 'settings', 'promo'), promo);
            alert('Promo settings saved successfully!');
        } catch (e) {
            console.error(e);
            alert('Failed to save promo settings.');
        } finally {
            setLoadingPromo(false);
        }
    };

    const handleUploadProject = async (e) => {
        e.preventDefault();
        if (!audioFile || !coverFile || !title) { 
            alert('Audio file, Cover Art, and Title are required!'); 
            return; 
        }

        // Duplicate check
        const normalizedTitle = title.trim().toLowerCase();
        const normalizedArtist = (artist.trim() || "Jazel 'dBoy' Isaac").toLowerCase();
        const isDuplicate = projects.some(p => 
            p.title.toLowerCase() === normalizedTitle && 
            p.artist.toLowerCase() === normalizedArtist
        );

        if (isDuplicate) {
            if (!window.confirm(`A project titled "${title.trim()}" by "${artist.trim() || "Jazel 'dBoy' Isaac"}" already exists.\n\nUpload anyway?`)) {
                return;
            }
        }

        setIsUploading(true);

        try {
            // Upload Cover
            const coverRef = ref(storage, `projects/covers/${Date.now()}_${coverFile.name}`);
            await uploadBytesResumable(coverRef, coverFile);
            const coverUrl = await getDownloadURL(coverRef);

            // Upload Audio
            const audioRef = ref(storage, `projects/audio/${Date.now()}_${audioFile.name}`);
            await uploadBytesResumable(audioRef, audioFile);
            const audioUrl = await getDownloadURL(audioRef);

            await addDoc(collection(db, 'projects'), {
                title: title.trim(),
                artist: artist.trim() || 'Jazel \'dBoy\' Isaac',
                coverUrl,
                audioUrl,
                createdAt: serverTimestamp(),
            });

            setTitle('');
            setAudioFile(null);
            setCoverFile(null);
            document.getElementById('uploadProjectForm')?.reset();
            fetchProjects();
        } catch (err) {
            console.error(err);
            alert('Upload failed: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteProject = async (id) => {
        if (window.confirm('Delete this music project? It will be removed from your Home page player.')) {
            try { 
                await deleteDoc(doc(db, 'projects', id)); 
                fetchProjects(); 
            }
            catch (e) { console.error(e); }
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-4 sm:p-6 font-sans">
            {/* Header */}
            <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#3b82f6]">Artist Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage your personal music projects and home page promotions</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin')} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 transition rounded text-sm text-gray-300">
                        Go to Beat Store Admin
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition rounded">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            <main className="flex flex-col gap-8">
                
                {/* Promo Control Panel */}
                <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 border-t-4 border-t-[#3b82f6]">
                    <div className="flex items-center gap-3 mb-6">
                        <MessageSquare size={20} className="text-[#3b82f6]" />
                        <h2 className="text-xl font-bold">Player Tooltip Promo</h2>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-end gap-4 max-w-3xl">
                        <div className="flex-1 w-full">
                            <label className="block text-gray-400 mb-2 text-sm">Tooltip Text</label>
                            <input
                                type="text"
                                value={promo.text}
                                onChange={e => setPromo({ ...promo, text: e.target.value })}
                                placeholder="e.g. Listen to my new single!"
                                className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#3b82f6] outline-none transition text-sm"
                            />
                        </div>
                        
                        <div className="flex items-center gap-3 mb-1">
                            <label className="flex items-center cursor-pointer relative">
                                <input type="checkbox" className="sr-only" checked={promo.isEnabled} onChange={e => setPromo({ ...promo, isEnabled: e.target.checked })} />
                                <div className={`w-14 h-8 bg-gray-700 rounded-full transition-colors ${promo.isEnabled ? 'bg-[#3b82f6]' : ''}`}>
                                    <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${promo.isEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </div>
                            </label>
                            <span className="text-sm font-bold w-16 text-gray-300">{promo.isEnabled ? 'ACTIVE' : 'HIDDEN'}</span>
                        </div>

                        <button
                            onClick={handleSavePromo}
                            disabled={loadingPromo}
                            className="bg-[#3b82f6] text-white font-bold px-6 py-3 rounded hover:bg-blue-600 transition disabled:opacity-50 text-sm whitespace-nowrap h-max"
                        >
                            {loadingPromo ? 'Saving...' : 'Save Config'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">This controls the text balloon that pops up near the music player button on the Home page.</p>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── Upload Project Form ── */}
                    <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-1">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Upload size={20} className="text-[#3b82f6]" /> Add Music Project
                        </h2>
                        <form id="uploadProjectForm" className="flex flex-col gap-4 text-sm" onSubmit={handleUploadProject}>

                            <div>
                                <label className="block text-gray-400 mb-1">Track Title</label>
                                <input
                                    type="text" required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#3b82f6] outline-none transition"
                                    placeholder="e.g. Bless Me"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 mb-1">Artist Name</label>
                                <input
                                    type="text" required
                                    value={artist}
                                    onChange={e => setArtist(e.target.value)}
                                    className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#3b82f6] outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 mb-1">Cover Art Image</label>
                                <input
                                    type="file" required accept="image/*"
                                    onChange={(e) => setCoverFile(e.target.files[0])}
                                    className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 mb-1">Audio File (MP3/WAV)</label>
                                <input
                                    type="file" required accept="audio/*"
                                    onChange={(e) => setAudioFile(e.target.files[0])}
                                    className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
                                />
                            </div>

                            <button
                                type="submit" disabled={isUploading}
                                className="mt-4 w-full bg-[#3b82f6] text-white font-bold py-3 rounded hover:bg-blue-600 transition flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {isUploading ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
                                {isUploading ? 'Uploading...' : 'Publish to Home Player'}
                            </button>
                        </form>
                    </section>

                    {/* ── Manage Projects ── */}
                    <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-2 flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-xl font-bold">Home Page Playlist</h2>
                            <span className="text-xs bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 px-2 py-0.5 rounded-full font-bold">
                                {projects.length} track{projects.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">These tracks will automatically populate your custom music player on the landing page.</p>

                        {loadingProjects ? (
                            <div className="flex justify-center p-10"><Loader size={30} className="animate-spin text-gray-500" /></div>
                        ) : projects.length === 0 ? (
                            <div className="bg-[#0f172a] border border-gray-800 rounded-lg p-10 text-center flex flex-col items-center">
                                <LinkIcon size={40} className="text-gray-600 mb-3" />
                                <p className="text-gray-400 font-medium mb-1">No artist projects uploaded.</p>
                                <p className="text-gray-500 text-sm">Upload a project to the left to populate your main music player.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {projects.map((proj) => (
                                    <div key={proj.id} className="flex items-center gap-4 bg-[#0f172a] p-3 rounded-xl border border-gray-800 hover:border-gray-600 transition group">
                                        <div className="w-14 h-14 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700">
                                            {proj.coverUrl && <img src={proj.coverUrl} alt="cover" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-white truncate">{proj.title}</h3>
                                            <p className="text-sm text-gray-400 truncate">{proj.artist}</p>
                                        </div>
                                        <div className="flex-shrink-0 pl-3 border-l border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleDeleteProject(proj.id)} 
                                                className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition" 
                                                title="Delete project"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
