import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    ShoppingCart, Download, Play, Pause, SkipForward, SkipBack, Volume2, ChevronLeft,
    Star, Heart, Search, Filter, ChevronDown, X, ChevronRight, Music2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc, increment } from 'firebase/firestore';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Fade from 'embla-carousel-fade';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GENRES  = ['Hip-Hop', 'Trap', 'Afrobeat', 'R&B', 'Pop', 'Drill', 'Jazz', 'Electronic', 'Gospel', 'Lo-fi', 'Other'];
const KEYS    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B','Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm'];

/** Returns or creates a persistent anonymous UUID stored in localStorage */
function getListenerUUID() {
    let uid = localStorage.getItem('dboy_uid');
    if (!uid) {
        uid = 'uid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('dboy_uid', uid);
    }
    return uid;
}

/** IDs of beats this device has already liked (stored as JSON array) */
function getLikedSet() {
    try { return new Set(JSON.parse(localStorage.getItem('dboy_liked') || '[]')); }
    catch { return new Set(); }
}
function saveLikedSet(set) {
    localStorage.setItem('dboy_liked', JSON.stringify([...set]));
}

export default function PublicStore() {
    const navigate = useNavigate();
    const [beats,    setBeats]    = useState([]);
    const [albums,   setAlbums]   = useState([]);
    const [featured, setFeatured] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [liked,    setLiked]    = useState(getLikedSet);

    // Audio Player
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying,    setIsPlaying]    = useState(false);
    const [currentTime,  setCurrentTime]  = useState(0);
    const [duration,     setDuration]     = useState(0);
    const [volume,       setVolume]       = useState(0.8);
    const audioRef = useRef(new Audio());

    // ── Filters (Listener-side) ──
    const [searchText,    setSearchText]    = useState('');
    const [filterOpen,    setFilterOpen]    = useState(false);
    const [filterBpmMin,  setFilterBpmMin]  = useState('');
    const [filterBpmMax,  setFilterBpmMax]  = useState('');
    const [filterKey,     setFilterKey]     = useState('');
    const [filterGenre,   setFilterGenre]   = useState('');
    const [filterTag,     setFilterTag]     = useState('');

    // ── Embla carousel ──
    const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false }));
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [autoplay.current, Fade()]);
    const [carouselIndex, setCarouselIndex] = useState(0);

    const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
    const scrollTo   = useCallback((i) => emblaApi?.scrollTo(i), [emblaApi]);

    // Track active slide index for dot indicators
    useEffect(() => {
        if (!emblaApi) return;
        const onSelect = () => setCarouselIndex(emblaApi.selectedScrollSnap());
        emblaApi.on('select', onSelect);
        return () => emblaApi.off('select', onSelect);
    }, [emblaApi]);

    // ── Audio setup ──
    useEffect(() => {
        fetchData();
        const audio = audioRef.current;
        const onTime = () => setCurrentTime(audio.currentTime);
        const onMeta = () => setDuration(audio.duration);
        const onEnd  = () => playNext();

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

    useEffect(() => { audioRef.current.volume = volume; }, [volume]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [beatsSnap, albumsSnap] = await Promise.all([
                getDocs(query(collection(db, 'beats'),  orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, 'albums'), orderBy('createdAt', 'desc'))),
            ]);
            const allBeats  = beatsSnap.docs.map(d  => ({ id: d.id,  ...d.data(), type: 'beat'  }));
            const allAlbums = albumsSnap.docs.map(d => ({ id: d.id,  ...d.data(), type: 'album' }));
            setBeats(allBeats);
            setAlbums(allAlbums);
            
            let combined = [...allBeats.filter(b => b.isStarred), ...allAlbums.filter(a => a.isStarred)];
            if (combined.length === 0) {
                // Fallback: if they haven't starred anything, show the 6 newest beats so the carousel isn't blank
                combined = allBeats.slice(0, 6);
            } else {
                combined = combined.slice(0, 6);
            }
            setFeatured(combined);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // ── Like a beat ──
    const handleLike = async (beat) => {
        if (liked.has(beat.id)) return; // already liked
        try {
            await updateDoc(doc(db, 'beats', beat.id), { likes: increment(1) });
            const newLiked = new Set(liked);
            newLiked.add(beat.id);
            setLiked(newLiked);
            saveLikedSet(newLiked);
            // Optimistically update local state
            setBeats(prev => prev.map(b => b.id === beat.id ? { ...b, likes: (b.likes || 0) + 1 } : b));
        } catch (e) { console.error('Like failed:', e); }
    };

    // ── Filtered beats (listener) ──
    const filteredBeats = useMemo(() => {
        return beats.filter(b => {
            if (searchText) {
                const q = searchText.toLowerCase();
                const hay = [b.title, b.genre, b.description, b.key, String(b.bpm || ''), ...(b.tags || [])].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (filterBpmMin && b.bpm < Number(filterBpmMin)) return false;
            if (filterBpmMax && b.bpm > Number(filterBpmMax)) return false;
            if (filterKey   && b.key !== filterKey)            return false;
            if (filterGenre && b.genre !== filterGenre)        return false;
            if (filterTag) {
                const t = filterTag.toLowerCase();
                if (!(b.tags || []).some(tag => tag.toLowerCase().includes(t))) return false;
            }
            return true;
        });
    }, [beats, searchText, filterBpmMin, filterBpmMax, filterKey, filterGenre, filterTag]);

    const activeFilters = [filterBpmMin, filterBpmMax, filterKey, filterGenre, filterTag].filter(Boolean).length;
    const clearFilters = () => { setFilterBpmMin(''); setFilterBpmMax(''); setFilterKey(''); setFilterGenre(''); setFilterTag(''); setSearchText(''); };

    // ── Playback ──
    const playTrack = (beat) => {
        const audio = audioRef.current;
        if (currentTrack?.id === beat.id) {
            if (isPlaying) { audio.pause(); setIsPlaying(false); }
            else           { audio.play();  setIsPlaying(true);  }
            return;
        }
        audio.src = beat.audioUrl;
        audio.play().catch(console.error);
        setCurrentTrack(beat);
        setIsPlaying(true);
    };

    const playNext = () => {
        if (!currentTrack) return;
        const idx  = filteredBeats.findIndex(b => b.id === currentTrack.id);
        const next = filteredBeats[(idx + 1) % filteredBeats.length];
        if (next) playTrack(next);
    };

    const playPrev = () => {
        if (!currentTrack) return;
        const idx  = filteredBeats.findIndex(b => b.id === currentTrack.id);
        const prev = filteredBeats[(idx - 1 + filteredBeats.length) % filteredBeats.length];
        if (prev) playTrack(prev);
    };

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
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

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen text-white font-sans selection:bg-gray-500 selection:text-white pb-36 pt-16 overflow-x-hidden w-full" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            backgroundAttachment: 'fixed'
        }}>
            <main className="max-w-[1400px] mx-auto px-6 sm:px-12 w-full box-border">

                {/* Back Button & Header */}
                <div className="flex flex-col gap-6 mb-12 max-w-full overflow-hidden">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#facc15]/70 hover:text-[#facc15] transition-colors group w-fit">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform flex-shrink-0" />
                        <span className="text-sm font-medium uppercase tracking-widest truncate">Back to Main Page</span>
                    </button>
                    <div className="flex flex-col items-center text-center max-w-full">
                        <h1 className="text-3xl sm:text-6xl font-black text-[#facc15] tracking-[4px] sm:tracking-[8px] uppercase drop-shadow-[0_0_15px_rgba(250,204,21,0.3)] mb-2 max-w-full break-normal text-center whitespace-normal">
                            Beats Unlimited
                        </h1>
                        <div className="h-1 w-24 bg-gradient-to-r from-transparent via-[#facc15] to-transparent opacity-50 flex-shrink-0" />
                    </div>
                </div>

                {/* ── Embla Featured Carousel ── */}
                {!loading && featured.length > 0 && (
                    <div className="mb-16">
                        <div className="flex items-center gap-2 mb-6">
                            <Star size={18} className="text-[#facc15] fill-[#facc15]" />
                            <h2 className="text-xs uppercase tracking-[3px] font-bold text-white/80">Featured</h2>
                        </div>

                        {/* Carousel viewport */}
                        <div className="relative group/carousel">
                            <div ref={emblaRef} className="overflow-hidden rounded-2xl">
                                <div className="flex">
                                    {featured.map((item, idx) => (
                                        <div key={`feat-${item.id}`} className="flex-[0_0_100%] min-w-0 relative">
                                            {/* Full-bleed image mobile aspect 4:3 ensures text fits */}
                                            <div className="relative aspect-[4/3] sm:aspect-[21/9] overflow-hidden">
                                                <img
                                                    src={item.coverUrl || 'https://via.placeholder.com/1600x700'}
                                                    alt={item.title || item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                                {/* Gradient overlay */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/70 to-transparent" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent opacity-70" />

                                                {/* Type badge */}
                                                <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
                                                    <span className="bg-[#0f172a]/80 backdrop-blur-md text-[#facc15] text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded border border-[#facc15]/20">
                                                        {item.type}
                                                    </span>
                                                </div>

                                                {/* Content */}
                                                <div className="absolute bottom-5 left-5 sm:bottom-10 sm:left-10 max-w-[85%] sm:max-w-[60%]">
                                                    <h3 className="text-xl sm:text-4xl font-black text-white leading-tight mb-1.5 drop-shadow-lg truncate">
                                                        {item.title || item.name}
                                                    </h3>
                                                    <p className="text-[#facc15]/80 text-[10px] sm:text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4 truncate">
                                                        {item.type === 'beat'
                                                            ? `${item.bpm ? item.bpm + ' BPM' : ''} ${item.key ? '| ' + item.key : ''} ${item.genre ? '| ' + item.genre : ''}`
                                                            : `${item.beatIds?.length || 0} Tracks`}
                                                    </p>
                                                    {item.type === 'beat' && (
                                                        <button
                                                            onClick={() => playTrack(item)}
                                                            className="flex w-fit items-center gap-2 bg-[#facc15] text-[#0f172a] font-black px-4 py-2 sm:px-5 sm:py-2.5 rounded-full hover:bg-yellow-300 active:scale-95 transition-all shadow-2xl text-[11px] sm:text-sm uppercase tracking-wider"
                                                        >
                                                            {currentTrack?.id === item.id && isPlaying
                                                                ? <><Pause size={14} className="sm:w-4 sm:h-4" /> Pause</>
                                                                : <><Play size={14} className="sm:w-4 sm:h-4" /> Play</>}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Arrows */}
                            <button
                                onClick={scrollPrev}
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#0f172a]/80 backdrop-blur text-white rounded-full flex items-center justify-center border border-white/10 hover:border-[#facc15]/40 hover:text-[#facc15] transition opacity-0 group-hover/carousel:opacity-100"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={scrollNext}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#0f172a]/80 backdrop-blur text-white rounded-full flex items-center justify-center border border-white/10 hover:border-[#facc15]/40 hover:text-[#facc15] transition opacity-0 group-hover/carousel:opacity-100"
                            >
                                <ChevronRight size={20} />
                            </button>

                            {/* Dots */}
                            <div className="flex justify-center gap-2 mt-4">
                                {featured.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => scrollTo(i)}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${i === carouselIndex ? 'w-6 bg-[#facc15]' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Search & Filter Bar ── */}
                <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[220px]">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                placeholder="Search beats by title, tag, genre, key, BPM..."
                                className="w-full pl-10 pr-4 py-3 bg-[#1e293b]/60 backdrop-blur border border-[#facc15]/10 hover:border-[#facc15]/30 focus:border-[#facc15]/60 rounded-xl outline-none text-white text-sm transition"
                            />
                        </div>

                        {/* Filter toggle */}
                        <button
                            onClick={() => setFilterOpen(o => !o)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${filterOpen || activeFilters > 0 ? 'bg-[#facc15]/10 border-[#facc15]/40 text-[#facc15]' : 'border-[#facc15]/10 text-gray-400 hover:text-white hover:border-[#facc15]/30'}`}
                        >
                            <Filter size={15} /> Filters
                            {activeFilters > 0 && (
                                <span className="bg-[#facc15] text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{activeFilters}</span>
                            )}
                            <ChevronDown size={13} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {(activeFilters > 0 || searchText) && (
                            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition">
                                <X size={13} /> Clear all
                            </button>
                        )}

                        {/* Beat count */}
                        <div className="ml-auto text-xs text-gray-500 flex items-center gap-1.5">
                            <Music2 size={13} />
                            <span>
                                {filteredBeats.length !== beats.length
                                    ? `${filteredBeats.length} of ${beats.length} beats`
                                    : `${beats.length} beat${beats.length !== 1 ? 's' : ''} available`}
                            </span>
                        </div>
                    </div>

                    {/* Expanded filter panel */}
                    {filterOpen && (
                        <div className="mt-3 bg-[#1e293b]/60 backdrop-blur border border-[#facc15]/10 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                            <div>
                                <label className="text-gray-500 mb-1.5 block uppercase tracking-wider text-[10px]">BPM Min</label>
                                <input type="number" value={filterBpmMin} onChange={e => setFilterBpmMin(e.target.value)} placeholder="e.g. 80" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white transition" />
                            </div>
                            <div>
                                <label className="text-gray-500 mb-1.5 block uppercase tracking-wider text-[10px]">BPM Max</label>
                                <input type="number" value={filterBpmMax} onChange={e => setFilterBpmMax(e.target.value)} placeholder="e.g. 160" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white transition" />
                            </div>
                            <div>
                                <label className="text-gray-500 mb-1.5 block uppercase tracking-wider text-[10px]">Key</label>
                                <select value={filterKey} onChange={e => setFilterKey(e.target.value)} className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white transition">
                                    <option value="">Any</option>
                                    {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-500 mb-1.5 block uppercase tracking-wider text-[10px]">Genre</label>
                                <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)} className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white transition">
                                    <option value="">Any</option>
                                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-500 mb-1.5 block uppercase tracking-wider text-[10px]">Tag</label>
                                <input type="text" value={filterTag} onChange={e => setFilterTag(e.target.value)} placeholder="e.g. trap" className="w-full p-2.5 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white transition" />
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Tracklist ── */}
                <div className="flex flex-col gap-3 sm:gap-2 w-full">
                    {loading ? (
                        <p className="text-center text-[#facc15]/60 py-10 text-sm italic">Loading your next hit...</p>
                    ) : filteredBeats.length === 0 ? (
                        <p className="text-center text-[#facc15]/60 py-10 text-sm">
                            {beats.length === 0 ? 'No beats found.' : 'No beats match your filters.'}
                        </p>
                    ) : (
                        filteredBeats.map((beat) => {
                            const isLiked    = liked.has(beat.id);
                            const isActive   = currentTrack?.id === beat.id;

                            return (
                                <div
                                    key={beat.id}
                                    className={`group flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 backdrop-blur-md border rounded-xl transition-all duration-300 gap-4 sm:gap-0 ${isActive ? 'bg-[#facc15]/5 border-[#facc15]/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]' : 'bg-[#1e293b]/40 border-[#facc15]/10 hover:border-[#facc15]/40 hover:shadow-[0_0_20px_rgba(250,204,21,0.08)]'}`}
                                >
                                    {/* Left: Cover + Info */}
                                    <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
                                        <div className="relative group/artwork flex-shrink-0">
                                            <div className="w-16 h-16 sm:w-14 sm:h-14 bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-[#facc15]/10">
                                                <img
                                                    src={beat.coverUrl || 'https://via.placeholder.com/150'}
                                                    alt={beat.title}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            </div>
                                            <button
                                                onClick={() => playTrack(beat)}
                                                className="absolute inset-0 flex items-center justify-center bg-[#facc15]/20 opacity-0 group-hover/artwork:opacity-100 transition-opacity rounded-lg"
                                            >
                                                {isActive && isPlaying
                                                    ? <Pause size={24} className="text-[#facc15] fill-[#facc15]" />
                                                    : <Play  size={24} className="text-[#facc15] fill-[#facc15]" />}
                                            </button>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-[#facc15] transition-colors truncate mb-0.5">
                                                {beat.title}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-[#facc15]/70 font-medium">
                                                {beat.bpm  && <span>{beat.bpm} BPM</span>}
                                                {beat.key  && <><span className="text-gray-600">|</span><span>{beat.key}</span></>}
                                                {beat.genre && <><span className="text-gray-600">|</span><span>{beat.genre}</span></>}
                                            </div>
                                            {/* Tags */}
                                            {(beat.tags || []).length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {beat.tags.slice(0, 4).map((tag, i) => (
                                                        <span key={i} className="text-[9px] bg-[#0f172a]/80 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0 px-2 sm:px-0 flex-wrap sm:flex-nowrap">
                                        {/* Like button */}
                                        <button
                                            onClick={() => handleLike(beat)}
                                            disabled={isLiked}
                                            title={isLiked ? 'Already liked' : 'Like this beat'}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-bold ${isLiked ? 'text-red-400 border-red-400/30 bg-red-400/5 cursor-default' : 'text-gray-400 border-gray-700 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5'}`}
                                        >
                                            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                                            <span>{beat.likes || 0}</span>
                                        </button>

                                        <button
                                            onClick={() => handleDownload(beat)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-[#facc15]/40 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f172a] px-4 py-2 rounded-lg transition-all duration-300 font-medium text-sm"
                                        >
                                            <Download size={16} />
                                            <span>free</span>
                                        </button>
                                        <button
                                            onClick={() => alert('Checkout coming soon')}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-[#facc15]/40 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f172a] px-5 py-2 rounded-lg transition-all duration-300 font-bold text-sm"
                                        >
                                            <ShoppingCart size={16} />
                                            <span>${beat.price || 50}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Licenses ── */}
                <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-8 mt-20 sm:mt-32 w-full box-border">
                    {[
                        { label: 'Basic',    price: 'Free', format: 'Mp3',        perks: ['Contains Audio Tags', '1000 sales', '50,000 streams', 'Non exclusive Rights'] },
                        { label: 'Premium',  price: '$50',  format: 'MP3 + WAV',  perks: ['Contains 1 Audio Tag', '50,000 sales', '250,000 streams', 'Non exclusive Rights'], promo: 'Buy 1 Get 2 Free' },
                        { label: 'Exclusive', price: '$100', format: 'MP3 + WAV', perks: ['Contains 1 Producer Tag', 'Unlimited Sales', 'Unlimited Streams', 'Exclusive Rights'] },
                    ].map(tier => (
                        <div key={tier.label} className="flex-1 bg-[#1e293b]/40 backdrop-blur-md border border-[#facc15]/10 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:border-[#facc15]/40 flex flex-col items-center w-full group/tier">
                            <div className="w-full bg-[#facc15] text-[#0f172a] py-5 text-center shadow-inner">
                                <div className="font-bold text-xs uppercase tracking-[3px] opacity-80 mb-1">{tier.label}</div>
                                <div className="text-3xl font-black italic">{tier.price}</div>
                            </div>
                            <div className="py-8 px-6 text-center w-full">
                                <div className="text-sm font-black text-white/90 mb-6 uppercase tracking-widest border-b border-[#facc15]/20 pb-2 inline-block">FOR {tier.format}</div>
                                <div className="space-y-3.5 pb-2">
                                    {tier.perks.map((p, i) => (
                                        <p key={i} className="text-xs text-white/70 flex items-center justify-center gap-2">
                                            <span className="text-[#facc15]">✧</span> {p}
                                        </p>
                                    ))}
                                </div>
                                {tier.promo && (
                                    <div className="mt-6 bg-[#facc15]/10 border border-[#facc15]/30 py-1.5 rounded-full">
                                        <p className="text-[#facc15] text-[11px] font-black uppercase tracking-tighter">{tier.promo}</p>
                                    </div>
                                )}
                            </div>
                            <button className="mt-auto w-full group-hover/tier:bg-[#facc15] group-hover/tier:text-[#0f172a] text-[#facc15] border-t border-[#facc15]/20 transition-all duration-300 py-4 font-black uppercase tracking-widest text-xs">
                                Choose {tier.label}
                            </button>
                        </div>
                    ))}
                </div>
            </main>

            {/* ── Sticky Player Bar ── */}
            {currentTrack && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-md border-t border-[#facc15]/20 px-3 sm:px-8 py-2 sm:py-3 z-50 shadow-2xl">
                    <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
                        {/* Artwork & Title */}
                        <div className="flex items-center gap-3 min-w-0 max-w-[50%] sm:max-w-none">
                            <div className="w-10 h-10 flex-shrink-0 bg-gray-800 rounded overflow-hidden shadow-lg border border-white/5">
                                {currentTrack.coverUrl && <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-grow">
                                <div className="text-[12px] sm:text-sm font-medium text-white truncate">{currentTrack.title}</div>
                                <div className="text-[9px] sm:text-xs text-gray-500 truncate">
                                    {[currentTrack.bpm && `${currentTrack.bpm} BPM`, currentTrack.key, currentTrack.genre].filter(Boolean).join(' · ') || 'dBoy'}
                                </div>
                            </div>
                        </div>

                        {/* Controls & Progress */}
                        <div className="flex items-center gap-2 sm:gap-4 flex-grow justify-end sm:justify-center">
                            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                <button onClick={playPrev} className="hidden sm:block text-gray-500 hover:text-white transition"><SkipBack size={18} /></button>
                                <button
                                    onClick={() => playTrack(currentTrack)}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#facc15] text-black flex items-center justify-center hover:bg-yellow-400 transition"
                                >
                                    {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                                </button>
                                <button onClick={playNext} className="text-gray-500 hover:text-white transition"><SkipForward size={18} /></button>
                            </div>

                            {/* Progress (Desktop) */}
                            <div className="hidden sm:flex flex-grow items-center gap-2 min-w-[120px]">
                                <span className="text-[10px] text-gray-500 flex-shrink-0">{formatTime(currentTime)}</span>
                                <div className="flex-grow h-1 bg-gray-800 rounded-full cursor-pointer relative" onClick={handleSeek}>
                                    <div className="h-1 bg-[#facc15] rounded-full" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-500 flex-shrink-0">{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Volume */}
                        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 w-28">
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
