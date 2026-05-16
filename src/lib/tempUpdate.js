import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const BEAT_UPDATES = [
  { "title": "or sumn 1", "key": "D#m", "bpm": 120 },
  { "title": "3_EASTPIANO 6_BEAT DEMO", "key": "C#m", "bpm": 114 },
  { "title": "CLUB AMAPIANO", "key": "Cm", "bpm": 104 },
  { "title": "EAST-PIANO 2", "key": "Bm", "bpm": 104 },
  { "title": "EAST-PIANO 3", "key": "Dm", "bpm": 104 },
  { "title": "EAST-PIANO 4", "key": "Em", "bpm": 104 },
  { "title": "EAST-PIANO 5", "key": "F#m", "bpm": 110 },
  { "title": "MZiki", "key": "Am", "bpm": 112 },
  { "title": "WE MUDU_BEAT", "key": "Cm", "bpm": 101 },
  { "title": "23(boombap-dancehall)_2", "key": "C#m", "bpm": 84 },
  { "title": "definately deadly_beat w:hook", "key": "F#m", "bpm": 90 },
  { "title": "DB5(wu tang inspired)", "key": "Am", "bpm": 94 },
  { "title": "11-4", "key": "C", "bpm": 94 },
  { "title": "Ayela", "key": "Dm", "bpm": 127 },
  { "title": "Focus Right", "key": "Am", "bpm": 79 },
  { "title": "Mkosi", "key": "G", "bpm": 87 },
  { "title": "simon says_2", "key": "F#m", "bpm": 140 },
  { "title": "Type Shiiii", "key": "Bm", "bpm": 116 },
  { "title": "CHRONIC_BEAT", "key": "F#m", "bpm": 86 },
  { "title": "GOOD MORNING_BEAT", "key": "A#m", "bpm": 91 },
  { "title": "It rains", "key": "D#m", "bpm": 130 },
  { "title": "Ringin", "key": "Cm", "bpm": 107 },
  { "title": "Ruff n Tuff", "key": "F#m", "bpm": 105 },
  { "title": "Kitawaramba_beat", "key": "F#m", "bpm": 97 },
  { "title": "sex money riddim_beat_demo", "key": "Cm", "bpm": 129 },
  { "title": "4_3(dancehall)", "key": "F#m", "bpm": 99 },
  { "title": "KAENDE BEAT", "key": "Cm", "bpm": 93 },
  { "title": "BEAT 3_DEMO 2", "key": "D#m", "bpm": 100 },
  { "title": "BOUNCE_BEAT", "key": "Em", "bpm": 101 },
  { "title": "Chini-Chini", "key": "Bm", "bpm": 104 },
  { "title": "MAJOR_BEAT", "key": "Am", "bpm": 90 },
  { "title": "Trip_demo", "key": "C#m", "bpm": 156 },
  { "title": "1(street chiqa)_beat_demo", "key": "Am", "bpm": 75 },
  { "title": "2k26", "key": "G#m", "bpm": 126 },
  { "title": "5_BEAT", "key": "A#m", "bpm": 110 },
  { "title": "HEAT_BEAT_DEMO", "key": "Em", "bpm": 70 },
  { "title": "LETS WORK_BEAT_DEMO", "key": "D#m", "bpm": 116 },
  { "title": "PEW PEW_BEAT_DEMO", "key": "Em", "bpm": 100 },
  { "title": "Aye", "key": "C#m", "bpm": 100 },
  { "title": "Mwanga(singeli)", "key": "Dm", "bpm": 79 },
  { "title": "One-two", "key": "Am", "bpm": 97 },
  { "title": "1_2(not nice)_demo", "key": "C#m", "bpm": 100 },
  { "title": "3_DEMO", "key": "D#m", "bpm": 84 },
  { "title": "BEAT 4", "key": "G", "bpm": 100 },
  { "title": "BEAT 5_", "key": "G#m", "bpm": 100 },
  { "title": "Chacha", "key": "Em", "bpm": 104 },
  { "title": "Cheza-Cheza", "key": "Am", "bpm": 100 },
  { "title": "Colorful", "key": "C#m", "bpm": 100 },
  { "title": "Hypeman", "key": "G#m", "bpm": 97 },
  { "title": "Hypnotrix", "key": "A#m", "bpm": 93 },
  { "title": "Mapozy", "key": "G#m", "bpm": 100 },
  { "title": "Mruna", "key": "G#", "bpm": 90 },
  { "title": "Mushkil", "key": "Am", "bpm": 108 },
  { "title": "Ni wada", "key": "C", "bpm": 100 },
  { "title": "Nyengine", "key": "Em", "bpm": 100 },
  { "title": "One Time", "key": "Am", "bpm": 90 },
  { "title": "SHERRY_BEAT_DEMO", "key": "Am", "bpm": 144 },
  { "title": "Sunset", "key": "G", "bpm": 100 },
  { "title": "Tetete", "key": "G#m", "bpm": 100 },
  { "title": "Three", "key": "D#m", "bpm": 84 },
  { "title": "African Gyal", "key": "G", "bpm": 100 },
  { "title": "All mine", "key": "Bm", "bpm": 99 },
  { "title": "All she needs", "key": "Am", "bpm": 100 },
  { "title": "Dawa Kamili", "key": "A#m", "bpm": 100 },
  { "title": "Everybody", "key": "C#m", "bpm": 106 },
  { "title": "Faya Ma", "key": "Am", "bpm": 100 },
  { "title": "Kiu", "key": "G", "bpm": 100 },
  { "title": "Kizungu-zungu", "key": "Fm", "bpm": 100 },
  { "title": "KKK_BEAT", "key": "E", "bpm": 100 },
  { "title": "Makini", "key": "G", "bpm": 86 },
  { "title": "Moyo", "key": "G#m", "bpm": 96 },
  { "title": "Mrembo", "key": "D", "bpm": 100 },
  { "title": "No Talk", "key": "Am", "bpm": 97 },
  { "title": "On Time", "key": "Cm", "bpm": 101 },
  { "title": "Sexy Kriminal", "key": "Cm", "bpm": 108 },
  { "title": "Shake Shake", "key": "Dm", "bpm": 100 },
  { "title": "She wanna be", "key": "A#", "bpm": 97 },
  { "title": "Sio poa", "key": "Gm", "bpm": 102 },
  { "title": "So Special", "key": "C#m", "bpm": 101 },
  { "title": "Till the end", "key": "G#m", "bpm": 100 },
  { "title": "Twende", "key": "F#m", "bpm": 100 },
  { "title": "Unavailable", "key": "Dm", "bpm": 106 },
  { "title": "Yo waist", "key": "D#m", "bpm": 100 },
  { "title": "You Got Me", "key": "G", "bpm": 100 }
];

export const runUpdate = async (beats) => {
    try {
        const batch = writeBatch(db);
        let count = 0;
        let notFound = [];
        for (const update of BEAT_UPDATES) {
            const utitle = update.title.toLowerCase().replace(/\.(mp3|wav)$/i, '').trim();
            const match = beats.find(b => b.title.toLowerCase().replace(/\.(mp3|wav)$/i, '').trim() === utitle);
            if (match) {
                batch.update(doc(db, 'beats', match.id), { key: update.key, bpm: update.bpm });
                count++;
            } else {
                notFound.push(update.title);
            }
        }
        if (count > 0) {
            await batch.commit();
            alert(`✅ Successfully updated ${count} beats!\n\nCould not find ${notFound.length} beats.`);
        } else {
            alert('No matching beats found to update. Titles might not match exactly.');
        }
        console.log("NOT FOUND:", notFound);
    } catch (e) {
        console.error('Failed to run batch update:', e);
        alert('Update failed: ' + e.message);
    }
};
