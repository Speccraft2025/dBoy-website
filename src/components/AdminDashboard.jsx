import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Edit2, LogOut } from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const [beats, setBeats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState('');
    const navigate = useNavigate();

    // Form State
    const [title, setTitle] = useState('');
    const [bpm, setBpm] = useState('');
    const [beatKey, setBeatKey] = useState('');
    const [tags, setTags] = useState('');
    const [price, setPrice] = useState('50');
    const [audioFiles, setAudioFiles] = useState([]);
    const [coverFile, setCoverFile] = useState(null);

    useEffect(() => {
        fetchBeats();
    }, []);

    const fetchBeats = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'beats'));
            const beatsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBeats(beatsList);
        } catch (error) {
            console.error("Error fetching beats: ", error);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleUpload = async (e) => {
        e.preventDefault();

        if (audioFiles.length === 0 || !coverFile) {
            alert("Audio file(s) and Cover Art are required!");
            return;
        }

        if (audioFiles.length === 1 && !title) {
            alert("Beat Title is required for single uploads!");
            return;
        }

        setLoading(true);
        setUploadProgress(0);

        try {
            // 1. Upload Cover Art ONCE for all beats in the batch
            setUploadStatus('Uploading cover art...');
            const coverRef = ref(storage, `covers/${Date.now()}_${coverFile.name}`);
            await uploadBytesResumable(coverRef, coverFile);
            const coverUrl = await getDownloadURL(coverRef);

            const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

            // 2. Loop through selected audio files
            for (let i = 0; i < audioFiles.length; i++) {
                const file = audioFiles[i];
                setUploadStatus(`Uploading beat ${i + 1} of ${audioFiles.length}: ${file.name}`);
                setUploadProgress(0); // Reset bar for current file

                // If bulk uploading, derive title from filename. Otherwise, use custom title.
                let beatTitle = title;
                if (audioFiles.length > 1) {
                    beatTitle = file.name.replace(/\.[^/.]+$/, ""); // Strip file extension
                }

                const audioRef = ref(storage, `beats/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(audioRef, file);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (error) => {
                            console.error("Upload error for", file.name, error);
                            reject(error);
                        },
                        async () => {
                            const audioUrl = await getDownloadURL(uploadTask.snapshot.ref);

                            // 3. Save metadata to Firestore
                            await addDoc(collection(db, 'beats'), {
                                title: beatTitle,
                                bpm: Number(bpm) || 0,
                                key: beatKey || '',
                                tags: tagsArray,
                                price: Number(price) || 50, // default match your new wireframe 50
                                coverUrl,
                                audioUrl,
                                createdAt: serverTimestamp()
                            });
                            resolve();
                        }
                    );
                });
            }

            // Reset form
            setTitle(''); setBpm(''); setBeatKey(''); setTags(''); setAudioFiles([]); setCoverFile(null);
            document.getElementById('uploadForm').reset();

            setLoading(false);
            setUploadProgress(0);
            setUploadStatus('');
            alert(`Successfully uploaded ${audioFiles.length} beat(s)!`);
            fetchBeats(); // Refresh list

        } catch (error) {
            console.error("Error doing upload: ", error);
            alert("Upload failed.");
            setLoading(false);
            setUploadStatus('');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this beat?")) {
            try {
                await deleteDoc(doc(db, 'beats', id));
                fetchBeats();
            } catch (error) {
                console.error("Error deleting document: ", error);
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-6 font-sans">
            <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#facc15]">Creator Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage your catalog, licenses, and profile</p>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition rounded">
                    <LogOut size={16} /> Logout
                </button>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Form */}
                <section className="bg-[#1e293b] p-6 rounded-xl border border-gray-800 lg:col-span-1 border-t-4 border-t-[#facc15]">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Upload size={20} className="text-[#facc15]" /> Upload Beats
                    </h2>
                    <form id="uploadForm" className="flex flex-col gap-4 text-sm" onSubmit={handleUpload}>

                        <div>
                            <label className="block text-gray-400 mb-1">Audio File(s) (MP3/WAV) *</label>
                            <input type="file" required multiple accept="audio/*" onChange={(e) => setAudioFiles(Array.from(e.target.files))} className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[#facc15] file:text-black hover:file:bg-yellow-400 transition cursor-pointer" />
                            <p className="text-xs text-gray-500 mt-1">Select multiple files for bulk upload. Filenames will be used as Track Titles.</p>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-1">Global Cover Art (Image) *</label>
                            <input type="file" required accept="image/*" onChange={(e) => setCoverFile(e.target.files[0])} className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[#3b82f6] file:text-white hover:file:bg-blue-600 transition cursor-pointer" />
                            <p className="text-xs text-gray-500 mt-1">This image will be applied to all uploaded tracks.</p>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-1">Beat Title (Optional for Bulk)</label>
                            <input type="text" disabled={audioFiles.length > 1} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition disabled:opacity-50" placeholder={audioFiles.length > 1 ? "Auto-generated from filenames" : "e.g. MF Doom Inspired Beat"} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 mb-1">Global BPM</label>
                                <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="100" />
                            </div>
                            <div>
                                <label className="block text-gray-400 mb-1">Global Key</label>
                                <input type="text" value={beatKey} onChange={(e) => setBeatKey(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="F min" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 mb-1">Global Tags (comma sep)</label>
                                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="hiphop, jazz" />
                            </div>
                            <div>
                                <label className="block text-gray-400 mb-1">Global Price ($)</label>
                                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded focus:border-[#facc15] outline-none transition" placeholder="50" />
                            </div>
                        </div>

                        {loading && (
                            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2 overflow-hidden relative">
                                <div className="bg-[#facc15] h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        )}

                        {uploadStatus && (
                            <p className="text-xs text-[#facc15] text-center mt-1 font-medium">{uploadStatus}</p>
                        )}

                        <button type="submit" disabled={loading} className="mt-4 w-full bg-[#facc15] text-black font-bold py-3 rounded hover:bg-yellow-400 transition flex justify-center items-center gap-2 disabled:opacity-50">
                            <Plus size={18} /> {loading ? `Processing...` : 'Upload Catalog'}
                        </button>
                    </form>
                </section>

                {/* Existing Tracks */}
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
                                        <th className="pb-3 font-medium hidden sm:table-cell">BPM/Key</th>
                                        <th className="pb-3 font-medium">Price</th>
                                        <th className="pb-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {beats.map(beat => (
                                        <tr key={beat.id} className="border-b border-gray-800/50 hover:bg-white/5 transition">
                                            <td className="py-4">
                                                <img src={beat.coverUrl} alt="cover" className="w-10 h-10 bg-gray-700 rounded object-cover" />
                                            </td>
                                            <td className="py-4 font-bold">{beat.title}</td>
                                            <td className="py-4 text-gray-400 hidden sm:table-cell">{beat.bpm} / {beat.key}</td>
                                            <td className="py-4 text-[#facc15]">${beat.price}</td>
                                            <td className="py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleDelete(beat.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded transition" title="Delete">
                                                        <Trash2 size={16} />
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
            </main>
        </div>
    );
}
