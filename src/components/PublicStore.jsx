import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Download, Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export default function PublicStore() {
    const [beats, setBeats] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);

    // Audio Player State
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const audioRef = useRef(new Audio());

    useEffect(() => {
        fetchData();
        const audio = audioRef.current;
        const onTime = () => setCurrentTime(audio.currentTime);
        const onMeta = () => setDuration(audio.duration);
        const onEnd = () => playNext();

        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('ended', onEnd);
        audio.volume = volume;

        return () => {
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('ended', onEnd);
            audio.pause();
        };
    }, []);

    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

    const fetchData = async () => {
        try {
            const [beatsSnap, albumsSnap] = await Promise.all([
                getDocs(query(collection(db, 'beats'), orderBy('createdAt', 'desc'))),
                getDocs(collection(db, 'albums')),
            ]);
            setBeats(beatsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setAlbums(albumsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const playTrack = (beat) => {
        const audio = audioRef.current;
        if (currentTrack?.id === beat.id) {
            if (isPlaying) { audio.pause(); setIsPlaying(false); }
            else { audio.play(); setIsPlaying(true); }
            return;
        }
        audio.src = beat.audioUrl;
        audio.play().catch(console.error);
        setCurrentTrack(beat);
        setIsPlaying(true);
    };

    const playNext = () => {
        if (!currentTrack) return;
        const idx = beats.findIndex(b => b.id === currentTrack.id);
        const next = beats[(idx + 1) % beats.length];
        if (next) playTrack(next);
    };

    const playPrev = () => {
        if (!currentTrack) return;
        const idx = beats.findIndex(b => b.id === currentTrack.id);
        const prev = beats[(idx - 1 + beats.length) % beats.length];
        if (prev) playTrack(prev);
    };

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = pct * duration;
    };

    const formatTime = (s) => {
        if (!s || isNaN(s)) return '0:00';
        return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    };

    const handleDownload = (beat) => {
        if (!beat.audioUrl) return;
        const a = document.createElement('a');
        a.href = beat.audioUrl;
        a.download = `${beat.title || 'beat'}.mp3`;
        a.target = '_blank';
        a.click();
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gray-500 selection:text-white pb-36 pt-16">
            <main className="max-w-[1000px] mx-auto px-4 sm:px-6">

                {/* Header */}
                <div className="flex justify-center mb-12">
                    <button className="bg-[#666666] text-black font-bold px-8 py-2 rounded-full text-lg tracking-wide hover:bg-[#777777] transition">
                        Beats Unlimited
                    </button>
                </div>

                {/* Albums Row */}
                {albums.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Albums & Collections</h2>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                            {albums.map(album => (
                                <div key={album.id} className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group w-24">
                                    <div className="w-24 h-24 bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#2a2a2a] group-hover:border-[#666] transition">
                                        {album.coverUrl
                                            ? <img src={album.coverUrl} alt={album.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                                        }
                                    </div>
                                    <span className="text-[11px] text-gray-400 text-center truncate w-full group-hover:text-white transition">{album.name}</span>
                                    <span className="text-[10px] text-gray-600">{album.beatIds?.length || 0} beats</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tracklist */}
                <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                    {loading ? (
                        <p className="text-center text-gray-500 py-10 text-sm">Loading beats...</p>
                    ) : beats.length === 0 ? (
                        <p className="text-center text-gray-500 py-10 text-sm">No beats available yet.</p>
                    ) : (
                        beats.map((beat, i) => {
                            const isCurrentlyPlaying = currentTrack?.id === beat.id && isPlaying;
                            const isCurrentTrack = currentTrack?.id === beat.id;
                            const beatTags = beat.tags || [];

                            return (
                                <div
                                    key={beat.id}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 py-3 px-4 transition ${
                                        isCurrentTrack ? 'bg-[#1a1a1a] border-l-2 border-[#facc15]' : 'bg-[#2f2f2f] hover:bg-[#383838]'
                                    }`}
                                >
                                    {/* Cover + Play */}
                                    <div
                                        className="w-16 h-16 sm:w-[50px] sm:h-[50px] bg-[#111111] flex-shrink-0 cursor-pointer overflow-hidden relative border border-black/20 group"
                                        onClick={() => playTrack(beat)}
                                    >
                                        {beat.coverUrl && <img src={beat.coverUrl} alt="Cover" className="w-full h-full object-cover" />}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                            {isCurrentlyPlaying
                                                ? <Pause size={18} className="text-white" />
                                                : <Play size={18} className="text-white" />
                                            }
                                        </div>
                                        {isCurrentlyPlaying && (
                                            <div className="absolute bottom-0.5 left-0 right-0 flex items-end justify-center gap-0.5 h-3">
                                                {[1, 2, 3].map(n => (
                                                    <div key={n} className="w-0.5 bg-[#facc15] rounded animate-pulse" style={{ height: `${30 + n * 20}%`, animationDelay: `${n * 0.15}s` }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Title & Artist */}
                                    <div className="flex-grow min-w-0 flex flex-col justify-center sm:pr-4">
                                        <h3 className={`text-[17px] font-normal truncate leading-tight ${isCurrentTrack ? 'text-[#facc15]' : 'text-white'}`}>
                                            {beat.title || 'Untitled'}
                                        </h3>
                                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                            {beat.bpm ? `${beat.bpm} BPM` : ''}{beat.bpm && beat.key ? ' · ' : ''}{beat.key || ''}
                                        </p>
                                    </div>

                                    {/* Tags */}
                                    <div className="hidden md:flex flex-wrap gap-1.5 w-44">
                                        {beatTags.slice(0, 4).map((tag, ti) => (
                                            <span key={ti} className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-3 ml-auto mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-start">
                                        <button
                                            onClick={() => handleDownload(beat)}
                                            className="bg-black text-white text-[12px] font-normal px-4 py-1.5 flex items-center gap-2 hover:bg-[#111] transition w-1/2 sm:w-auto justify-center"
                                        >
                                            <Download size={14} className="text-white" /> free
                                        </button>
                                        <button
                                            onClick={() => alert('Checkout coming soon')}
                                            className="bg-black text-white text-[12px] font-normal px-4 py-1.5 flex items-center gap-2 hover:bg-[#111] transition w-1/2 sm:w-auto justify-center"
                                        >
                                            <ShoppingCart size={14} className="text-white" /> ${beat.price || 50}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* View All Button */}
                <div className="mt-8 flex justify-center">
                    <button className="bg-[#4d4d4d] text-white text-[13px] font-normal px-12 py-2 hover:bg-[#5a5a5a] transition">
                        View All
                    </button>
                </div>

                {/* Licenses Section */}
                <div className="flex flex-col md:flex-row justify-center gap-5 mt-32 max-w-3xl mx-auto px-4">
                    {[
                        { label: 'Basic', price: 'Free', format: 'Mp3', perks: ['Contains Audio Tags', '1000 sales', '50,000 streams', 'Non exclusive Rights'] },
                        { label: 'Premium', price: '$50', format: 'MP3 + WAV', perks: ['Contains 1 Audio Tag', '50,000 sales', '250,000 streams', 'Non exclusive Rights'], promo: 'Buy 1 Get 2 Free' },
                        { label: 'Exclusive', price: '$100', format: 'MP3 + WAV', perks: ['Contains 1 Producer Tag', 'Unlimited Sales', 'Unlimited Streams', 'Exclusive Rights'] },
                    ].map(tier => (
                        <div key={tier.label} className="flex-1 bg-[#252525] transition flex flex-col items-center">
                            <div className="w-full bg-[#6a5338] text-white py-3 pb-4 text-center rounded-t-lg">
                                <div className="font-normal text-[15px] mb-1">{tier.label}</div>
                                <div className="text-[32px] font-bold leading-none">{tier.price}</div>
                            </div>
                            <div className="py-6 px-4 text-center w-full">
                                <div className="text-[14px] font-medium mb-4 text-gray-200">{tier.format}</div>
                                <div className="text-[13px] text-[#cccccc] flex flex-col gap-3.5 pb-2">
                                    {tier.perks.map((p, i) => <p key={i}>{p}</p>)}
                                </div>
                                {tier.promo && <p className="text-[#3b82f6] text-[13px] font-medium mt-4">{tier.promo}</p>}
                            </div>
                            <div className="mt-auto w-full bg-[#3d3d3d] hover:bg-[#4a4a4a] transition cursor-pointer py-3.5 flex justify-center items-center gap-2 text-[12px] text-gray-200 border-t border-[#444] rounded-b-lg">
                                <span className="border border-gray-400 px-1.5 rounded-sm text-[10px] leading-none py-1">📄</span> License contract
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Sticky Player Bar */}
            {currentTrack && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#2a2a2a] px-4 py-3 z-50">
                    <div className="max-w-[1000px] mx-auto flex items-center gap-4">
                        {/* Cover */}
                        <div className="w-10 h-10 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                            {currentTrack.coverUrl && <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />}
                        </div>

                        {/* Info */}
                        <div className="hidden sm:block min-w-0 w-36 flex-shrink-0">
                            <div className="text-sm font-medium text-white truncate">{currentTrack.title}</div>
                            <div className="text-xs text-gray-500">{currentTrack.bpm ? `${currentTrack.bpm} BPM` : 'dBoy'}</div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button onClick={playPrev} className="text-gray-400 hover:text-white transition"><SkipBack size={18} /></button>
                            <button
                                onClick={() => playTrack(currentTrack)}
                                className="w-9 h-9 rounded-full bg-[#facc15] text-black flex items-center justify-center hover:bg-yellow-400 transition"
                            >
                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <button onClick={playNext} className="text-gray-400 hover:text-white transition"><SkipForward size={18} /></button>
                        </div>

                        {/* Progress */}
                        <div className="flex-grow flex items-center gap-2 min-w-0">
                            <span className="text-[11px] text-gray-500 flex-shrink-0">{formatTime(currentTime)}</span>
                            <div
                                className="flex-grow h-1 bg-gray-700 rounded-full cursor-pointer relative"
                                onClick={handleSeek}
                            >
                                <div
                                    className="h-1 bg-[#facc15] rounded-full"
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-[11px] text-gray-500 flex-shrink-0">{formatTime(duration)}</span>
                        </div>

                        {/* Volume */}
                        <div className="hidden md:flex items-center gap-2 flex-shrink-0 w-28">
                            <Volume2 size={16} className="text-gray-500" />
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={volume}
                                onChange={e => setVolume(Number(e.target.value))}
                                className="w-full accent-[#facc15] h-1"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
