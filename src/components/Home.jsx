
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import './Home.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.5);

  const navigate = useNavigate();
  const audioRef = useRef(new Audio());
  const lastSrcRef = useRef('');

  const [showContact, setShowContact] = useState(false);
  const [promo, setPromo] = useState(null);
  const [projectsData, setProjectsData] = useState([]);

  // The playlist is entirely driven by the projects fetched from Firestore (Admin2).
  const playlist = projectsData;

  // 1. Initial data fetch
  useEffect(() => {
    setTimeout(() => setLoading(false), 2000);

    // Fetch Promo
    getDoc(doc(db, 'settings', 'promo'))
      .then(docSnap => {
        if (docSnap.exists() && docSnap.data().isEnabled) {
          setPromo(docSnap.data().text);
        }
      })
      .catch(e => console.error('Promo error:', e));

    // Fetch Music Projects
    getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc')))
      .then(snap => {
        const fetched = snap.docs.map(d => ({
          id: d.id,
          title: d.data().title,
          artist: d.data().artist || "Jazel 'dBoy' Isaac",
          src: d.data().audioUrl,
          coverUrl: d.data().coverUrl
        }));
        if (fetched.length > 0) setProjectsData(fetched);
      })
      .catch(e => console.error('Projects error:', e));
  }, []);

  // 2. Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
    };
  }, []);

  // 3. Audio ended handler
  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => {
      if (playlist.length === 0) return;
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [playlist.length]);

  // 4. Handle track source and playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (playlist.length > 0 && playlist[currentTrackIndex]) {
      const newSrc = playlist[currentTrackIndex].src;
      if (lastSrcRef.current !== newSrc) {
        audio.src = newSrc;
        lastSrcRef.current = newSrc;
      }
      
      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => console.error("Playback error:", e));
        }
      } else {
        audio.pause();
      }
    }
  }, [currentTrackIndex, playlist, isPlaying]);

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  const prevTrack = () => {
    if (playlist.length === 0) return;
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
  };

  const handleSeek = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clickX = clientX - rect.left;
    const newTime = Math.max(0, Math.min(1, clickX / rect.width)) * duration;
    if (!isNaN(newTime)) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolume = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clickX = clientX - rect.left;
    setVolume(Math.max(0, Math.min(1, clickX / rect.width)));
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTrack = playlist[currentTrackIndex];

  return (
    <div className="home-container" style={{
      fontFamily: "'Arial', sans-serif",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "20px",
      paddingBottom: "80px",
      overflowX: "hidden"
    }}>
      {/* Page Loader */}
      <div className={`page-loader ${!loading ? 'fade-out' : ''}`} style={{ display: loading ? 'flex' : 'none' }}>
        <div className="loader-logo"></div>
      </div>

      {/* About Modal */}
      <div className={`modal-overlay ${showAbout ? 'active' : ''}`} style={{ display: showAbout ? 'flex' : 'none' }} onClick={(e) => { if (e.target === e.currentTarget) setShowAbout(false) }}>
        <div className="about-modal">
          <button className="modal-close" onClick={() => setShowAbout(false)}>×</button>
          <h2>About dBoy</h2>
          <div className="about-content">
            <div className="about-section">
              <p>
                <strong>Jazel ‘dBoy’ Isaac</strong> is a Nairobi-based music producer, artist, and entrepreneur building more than just music—he’s building platforms for growth.
              </p>
            </div>
            <div className="about-section">
              <p>He started in the studio, developing his craft in writing, recording, and production, with a strong focus on quality and consistency. Today, he works closely with artists to shape records that stand out—offering a professional, structured environment for serious creators ready to level up.</p>
            </div>
            <div className="about-section">
              <p>Beyond music, Jazel is actively developing systems and ventures designed to empower artists and streamline how creative and business processes work. His approach blends creativity with strategy, making him not just a producer, but a long-term partner in growth.</p>
            </div>
            <div className="about-section">
              <p>Whether you’re an artist looking to create, a brand looking to collaborate, or someone interested in building what’s next—this is where it starts.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <div className={`modal-overlay ${showContact ? 'active' : ''}`} style={{ display: showContact ? 'flex' : 'none' }} onClick={(e) => { if (e.target === e.currentTarget) setShowContact(false) }}>
        <div className="about-modal" style={{ maxWidth: '400px' }}>
          <button className="modal-close" onClick={() => setShowContact(false)}>×</button>
          <h2 style={{ marginBottom: '5px' }}>Contact dBoy</h2>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#a0aec0', marginBottom: '25px' }}>
            For custom beats, collaborations, or general inquiries.
          </p>
          <div className="about-content" style={{ padding: '0 10px' }}>
            <form action="https://formsubmit.co/jayzelisaac@gmail.com" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="hidden" name="_subject" value="New Inquiry from dBoy Website" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="text" name="name" required placeholder="Your Name" style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} />
              <input type="email" name="email" required placeholder="Your Email" style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} />
              <textarea name="message" required placeholder="How can we build what's next?" rows="4" style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}></textarea>
              <button type="submit" style={{ background: '#facc15', color: '#0f172a', fontWeight: 'bold', padding: '14px', borderRadius: '8px', cursor: 'pointer', border: 'none', transition: 'all 0.3s', marginTop: '5px' }} onMouseOver={e => e.target.style.background = '#eab308'} onMouseOut={e => e.target.style.background = '#facc15'}>
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>

      <header className="shake">
        <h1 className="shake">Jazel 'dBoy' Isaac</h1>
        <h2 className="shake cursor-pointer hover:text-[#facc15] transition-colors" onClick={() => navigate('/login')}>Producer Extraordinaire</h2>
      </header>

      <nav>
        <button className="shake nav-btn" onClick={() => setShowAbout(true)}>About dBoy</button>
        <a className="shake" href="https://youtu.be/JICpg_I6Wjo" target="_blank" rel="noopener noreferrer">
          <button className="shake">Watch 'Finalizer' Short Film</button>
        </a>
        <a className="shake" href="https://www.youtube.com/@Jazel_dboy_isaac" target="_blank" rel="noopener noreferrer">
          <button className="shake">YouTube</button>
        </a>
        <a className="shake" href="https://open.spotify.com/playlist/2pY5jxhdX5mjgLezoAf0yi" target="_blank" rel="noopener noreferrer">
          <button className="shake">Spotify</button>
        </a>

        {/* Updated routing back to Soundclick temporarily */}
        <button className="shake nav-btn" onClick={() => navigate('/beats')}>My Beats</button>
        <button className="shake nav-btn" onClick={() => setShowContact(true)}>Contact Me</button>
      </nav>

      <div className="image-container shake">
        <img src="/dboy full profile 2.png" alt="Main Artist Image" id="artist-image" className="shake" />
      </div>

      <footer>
        <p>&copy; 2024 Jazel 'dBoy' Isaac. All rights reserved.</p>
      </footer>

      {/* Promo Tooltip Balloon */}
      {promo && !showPlayer && (
        <div className="fixed z-[55] animate-bounce cursor-pointer flex flex-col items-center drop-shadow-2xl"
          style={{ bottom: '85px', right: '15px' }}
          onClick={() => setShowPlayer(true)}>
          <div className="bg-[#facc15] text-[#0f172a] text-xs sm:text-sm font-black uppercase tracking-widest px-5 py-3 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.5)] border-2 border-[#facc15]/40 text-center max-w-[200px] sm:max-w-[250px] relative backdrop-blur-md">
            {promo}
            {/* Downward triangle pointer centered manually near the right edge for the button */}
            <div className="absolute top-full right-5 w-0 h-0 border-[10px] border-transparent border-t-[#facc15]" />
          </div>
        </div>
      )}

      {/* Music Player Toggle Button */}
      <button className={`player-toggle ${showPlayer ? 'active' : ''}`} onClick={() => setShowPlayer(!showPlayer)}>🎵</button>

      {/* Music Player */}
      <div className={`music-player ${showPlayer ? 'active' : ''}`}>
        <div className="player-container">
          <div className="track-display">
            <div className={`track-artwork ${isPlaying ? 'playing' : ''}`}>
              {currentTrack?.coverUrl ? (
                <img src={currentTrack.coverUrl} alt={currentTrack.title} className="track-artwork-img" />
              ) : (
                <span className="artwork-icon">♪</span>
              )}
            </div>
            <div className="track-details">
              <div className="track-name">{currentTrack?.title || "Select a track"}</div>
              <div className="track-artist">{currentTrack?.artist || "Jazel 'dBoy' Isaac"}</div>
            </div>
          </div>

          <div className="player-controls-center">
            <div className="control-buttons">
              <button className="player-btn" onClick={prevTrack}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              <button className="player-btn play-btn" onClick={togglePlay}>
                {isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button className="player-btn" onClick={nextTrack}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z" />
                </svg>
              </button>
            </div>

            <div className="progress-container">
              <span className="time-display">{formatTime(currentTime)}</span>
              <div 
                className="progress-bar" 
                style={{ touchAction: 'none' }}
                onClick={handleSeek}
                onTouchStart={handleSeek}
                onTouchMove={handleSeek}
              >
                <div className="progress-fill" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
              </div>
              <span className="time-display">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-extras">
            <div className="volume-container">
              <span className="volume-icon" onClick={() => setVolume(volume > 0 ? 0 : 0.5)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {volume === 0 ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />}
                </svg>
              </span>
              <div 
                className="volume-bar" 
                style={{ touchAction: 'none' }}
                onClick={handleVolume}
                onTouchStart={handleVolume}
                onTouchMove={handleVolume}
              >
                <div className="volume-fill" style={{ width: `${volume * 100}%` }}></div>
              </div>
            </div>
            <button className="playlist-btn" onClick={() => setShowPlaylist(!showPlaylist)}>Playlist</button>
          </div>
        </div>
      </div>

      {/* Playlist Modal */}
      <div className={`playlist-modal ${showPlaylist ? 'active' : ''}`}>
        <div className="playlist-header">
          <span>New Releases</span>
          <button className="playlist-close" onClick={() => setShowPlaylist(false)}>×</button>
        </div>
        <div className="playlist-items">
          {playlist.map((song, idx) => (
            <div
              key={idx}
              className={`playlist-item ${idx === currentTrackIndex ? 'active' : ''}`}
              onClick={() => {
                setCurrentTrackIndex(idx);
                if (!isPlaying) togglePlay();
              }}
            >
              <div className="playlist-item-title">{song.title}</div>
              <div className="playlist-item-artist">{song.artist}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
