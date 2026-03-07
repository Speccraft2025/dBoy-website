import fs from 'fs';

const content = fs.readFileSync('old-index.html', 'utf8');

// Extract CSS
const cssMatch = content.match(/<style>([\s\S]*?)<\/style>/);
if (cssMatch) {
    fs.writeFileSync('src/components/Home.css', cssMatch[1]);
}

// Extract Body 
let bodyMatch = content.match(/<body>([\s\S]*?)<script>/);
if (bodyMatch) {
    let html = bodyMatch[1];

    // Basic JSX conversions
    html = html.replace(/class=/g, 'className=');
    html = html.replace(/onclick="([^"]+)"/g, ''); // Remove inline handlers
    html = html.replace(/<img(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.slice(0, -1) + ' />';
    });
    html = html.replace(/<svg(.*?)>([\s\S]*?)<\/svg>/g, (match) => {
        return match.replace(/fill-rule/g, 'fillRule').replace(/clip-rule/g, 'clipRule');
    });

    html = html.replace(/<input(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.slice(0, -1) + ' />';
    });
    // Fix attributes
    html = html.replace(/<path(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.slice(0, -1) + ' />';
    });

    // Replace dboy full profile 2.png with actual import or absolute path from public
    html = html.replace(/src="dboy full profile 2.png"/g, 'src="/dboy full profile 2.png"');

    const component = `
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  
  const playlist = [
    { title: "Bless Me", artist: "Jazel 'dBoy' Isaac", src: "/Bless Me.mp3" },
    { title: "Misunderstanding", artist: "Jazel 'dBoy' Isaac", src: "/Misunderstanding.mp3" }
  ];

  useEffect(() => {
    setTimeout(() => setLoading(false), 2000);
    
    const audio = audioRef.current;
    
    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => nextTrack();
    
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);
    
    audio.volume = volume;
    if (playlist.length > 0) {
      audio.src = playlist[currentTrackIndex].src;
    }
    
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [currentTrackIndex]);
  
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error(e));
    }
    setIsPlaying(!isPlaying);
  };
  
  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    if (isPlaying) {
      setTimeout(() => audioRef.current.play(), 100);
    }
  };
  
  const prevTrack = () => {
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
      if (isPlaying) {
        setTimeout(() => audioRef.current.play(), 100);
      }
    }
  };
  
  const handleSeek = (e) => {
    const bar = e.currentTarget;
    const clickX = e.nativeEvent.offsetX;
    const width = bar.offsetWidth;
    const newTime = (clickX / width) * duration;
    audioRef.current.currentTime = newTime;
  };
  
  const handleVolume = (e) => {
    const bar = e.currentTarget;
    const clickX = e.nativeEvent.offsetX;
    const width = bar.offsetWidth;
    setVolume(clickX / width);
  };
  
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
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
      <div className={\`page-loader \${!loading ? 'fade-out' : ''}\`} style={{ display: loading ? 'flex' : 'none' }}>
        <div className="loader-logo"></div>
      </div>

      {/* About Modal */}
      <div className={\`modal-overlay \${showAbout ? 'active' : ''}\`} style={{ display: showAbout ? 'flex' : 'none' }} onClick={(e) => { if(e.target === e.currentTarget) setShowAbout(false) }}>
        <div className="about-modal">
          <button className="modal-close" onClick={() => setShowAbout(false)}>×</button>
          <h2>About dBoy</h2>
          <div className="about-content">
            <div className="about-section">
              <p>
                I'm <strong>Jazel "dBoy" Isaac</strong> — a Nairobi-based producer and artist whose eclectic sound fuses hip-hop, pop, electronic, and African rhythms into a rich, boundary-pushing experience.
              </p>
            </div>
            <div className="about-section">
              <h3>The Journey</h3>
              <p>From late-night sessions in Mombasa to building a creative home in Nairobi, my path has been one of experimentation, collaboration, and growth.</p>
            </div>
            <div className="about-section">
              <h3>Musical Vision</h3>
              <p>I craft eclectic soundscapes that explore resilience, faith, identity, and connection.</p>
            </div>
          </div>
        </div>
      </div>

      <header className="shake">
        <h1 className="shake">Jazel 'dBoy' Isaac</h1>
        <h2 className="shake">Producer/Artist Extraordinaire</h2>
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
        
        {/* Updated routing to Beat Store */}
        <button className="shake nav-btn" onClick={() => navigate('/beats')}>My Beats</button>
      </nav>

      <div className="image-container shake">
        <img src="/dboy full profile 2.png" alt="Main Artist Image" id="artist-image" className="shake" />
      </div>

      <footer>
        <p>&copy; 2024 Jazel 'dBoy' Isaac. All rights reserved.</p>
      </footer>

      {/* Music Player Toggle Button */}
      <button className={\`player-toggle \${showPlayer ? 'active' : ''}\`} onClick={() => setShowPlayer(!showPlayer)}>🎵</button>
      
      {/* Music Player */}
      <div className={\`music-player \${showPlayer ? 'active' : ''}\`}>
        <div className="player-container">
          <div className="track-display">
            <div className={\`track-artwork \${isPlaying ? 'playing' : ''}\`}>
              <span className="artwork-icon">♪</span>
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
              <div className="progress-bar" onClick={handleSeek}>
                <div className="progress-fill" style={{ width: \`\${(currentTime / (duration || 1)) * 100}%\` }}></div>
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
              <div className="volume-bar" onClick={handleVolume}>
                <div className="volume-fill" style={{ width: \`\${volume * 100}%\` }}></div>
              </div>
            </div>
            <button className="playlist-btn" onClick={() => setShowPlaylist(!showPlaylist)}>Playlist</button>
          </div>
        </div>
      </div>

      {/* Playlist Modal */}
      <div className={\`playlist-modal \${showPlaylist ? 'active' : ''}\`}>
        <div className="playlist-header">
          <span>New Releases</span>
          <button className="playlist-close" onClick={() => setShowPlaylist(false)}>×</button>
        </div>
        <div className="playlist-items">
          {playlist.map((song, idx) => (
            <div 
              key={idx} 
              className={\`playlist-item \${idx === currentTrackIndex ? 'active' : ''}\`} 
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
  `;

    fs.writeFileSync('src/components/Home.jsx', component);
    console.log('Conversion complete');
}

