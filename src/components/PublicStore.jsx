import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Download } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export default function PublicStore() {
    const [beats, setBeats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Audio Player State (simplified for UI)
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(new Audio());

    useEffect(() => {
        fetchBeats();
        return () => {
            audioRef.current.pause();
        };
    }, []);

    const fetchBeats = async () => {
        try {
            const q = query(collection(db, 'beats'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const beatsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBeats(beatsList);
        } catch (error) {
            console.error("Error fetching beats: ", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gray-500 selection:text-white pb-28 pt-16">
            <main className="max-w-[1000px] mx-auto px-4 sm:px-6">

                {/* Header Button */}
                <div className="flex justify-center mb-16">
                    <button className="bg-[#666666] text-black font-bold px-8 py-2 rounded-full text-lg tracking-wide hover:bg-[#777777] transition">
                        Beats Unlimited
                    </button>
                </div>

                {/* Tracklist */}
                <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                    {loading ? (
                        <p className="text-center text-gray-500 py-10 text-sm">Loading beats...</p>
                    ) : beats.length === 0 ? (
                        <p className="text-center text-gray-500 py-10 text-sm">No beats available yet.</p>
                    ) : (
                        // Ensure we map at least 5 rows for visual parity with the mockup if there are fewer beats
                        (beats.length > 0 ? beats : Array(5).fill({})).map((beat, i) => {
                            return (
                                <div key={beat.id || i} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-3 px-4 bg-[#2f2f2f] hover:bg-[#383838] transition">
                                    {/* Square Cover */}
                                    <div className="w-16 h-16 sm:w-[50px] sm:h-[50px] bg-[#111111] flex-shrink-0 cursor-pointer overflow-hidden relative border border-black/20">
                                        {beat.coverUrl && <img src={beat.coverUrl} alt="Cover" className="w-full h-full object-cover" />}
                                    </div>

                                    {/* Title & Artist */}
                                    <div className="flex-grow min-w-0 flex flex-col justify-center sm:pr-8">
                                        <h3 className="text-[17px] font-normal text-white truncate leading-tight">{beat.title || "Song name"}</h3>
                                        <p className="text-[11px] text-gray-400 truncate mt-0.5">Artist name</p>
                                    </div>

                                    {/* Tags Group 1 (Genre/Mood) */}
                                    <div className="hidden md:flex flex-col gap-1.5 w-24">
                                        <span className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">Genre</span>
                                        <span className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">tag 2</span>
                                    </div>

                                    {/* Tags Group 2 */}
                                    <div className="hidden md:flex flex-col gap-1.5 w-24">
                                        <span className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">Mood</span>
                                        <span className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">tag 3</span>
                                    </div>

                                    {/* Tags Group 3 */}
                                    <div className="hidden md:flex flex-col gap-1.5 w-24 mr-8">
                                        <span className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">tag 1</span>
                                        <span className="bg-[#111] text-white text-[9px] px-2 py-0.5 text-center truncate">tag 4</span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-3 ml-auto mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-start">
                                        <button className="bg-black text-white text-[12px] font-normal px-4 py-1.5 flex items-center gap-2 hover:bg-[#111] transition w-1/2 sm:w-auto justify-center">
                                            <Download size={14} className="text-white" /> free
                                        </button>
                                        <button onClick={() => alert('Checkout features coming soon')} className="bg-black text-white text-[12px] font-normal px-4 py-1.5 flex items-center gap-2 hover:bg-[#111] transition w-1/2 sm:w-auto justify-center">
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

                    {/* Basic */}
                    <div className="flex-1 bg-[#252525] transition flex flex-col items-center">
                        <div className="w-full bg-[#6a5338] text-white py-3 pb-4 text-center rounded-t-lg">
                            <div className="font-normal text-[15px] mb-1">Basic</div>
                            <div className="text-[32px] font-bold leading-none">Free</div>
                        </div>
                        <div className="py-6 px-4 text-center w-full">
                            <div className="text-[14px] font-medium mb-4 text-gray-200">Mp3</div>
                            <div className="text-[13px] text-[#cccccc] flex flex-col gap-3.5 pb-2">
                                <p>Contains Audio Tags</p>
                                <p>1000 sales</p>
                                <p>50,000 streams</p>
                                <p>Non exclusive Rights</p>
                            </div>
                        </div>
                        <div className="mt-auto w-full bg-[#3d3d3d] hover:bg-[#4a4a4a] transition cursor-pointer py-3.5 flex justify-center items-center gap-2 text-[12px] text-gray-200 border-t border-[#444] rounded-b-lg">
                            <span className="border border-gray-400 px-1.5 rounded-sm text-[10px] leading-none py-1">📄</span> License contract
                        </div>
                    </div>

                    {/* Premium */}
                    <div className="flex-1 bg-[#252525] transition flex flex-col items-center">
                        <div className="w-full bg-[#6a5338] text-white py-3 pb-4 text-center rounded-t-lg">
                            <div className="font-normal text-[15px] mb-1">Premium</div>
                            <div className="text-[32px] font-bold leading-none">$50</div>
                        </div>
                        <div className="py-6 px-4 text-center w-full">
                            <div className="text-[14px] font-medium mb-4 text-gray-200">MP3 + WAV</div>
                            <div className="text-[13px] text-[#cccccc] flex flex-col gap-3.5">
                                <p>Contains 1 Audio Tag</p>
                                <p>50,000 sales</p>
                                <p>250,000 streams</p>
                                <p>Non exclusive Rights</p>
                            </div>
                            <p className="text-[#3b82f6] text-[13px] font-medium mt-4">Buy 1 Get 2 Free</p>
                        </div>
                        <div className="mt-auto w-full bg-[#3d3d3d] hover:bg-[#4a4a4a] transition cursor-pointer py-3.5 flex justify-center items-center gap-2 text-[12px] text-gray-200 border-t border-[#444] rounded-b-lg">
                            <span className="border border-gray-400 px-1.5 rounded-sm text-[10px] leading-none py-1">📄</span> License contract
                        </div>
                    </div>

                    {/* Exclusive */}
                    <div className="flex-1 bg-[#252525] transition flex flex-col items-center">
                        <div className="w-full bg-[#6a5338] text-white py-3 pb-4 text-center rounded-t-lg">
                            <div className="font-normal text-[15px] mb-1">Exclusive</div>
                            <div className="text-[32px] font-bold leading-none">$100</div>
                        </div>
                        <div className="py-6 px-4 text-center w-full">
                            <div className="text-[14px] font-medium mb-4 text-gray-200">MP3 + WAV</div>
                            <div className="text-[13px] text-[#cccccc] flex flex-col gap-3.5 pb-2">
                                <p>Contains 1 Producer Tag</p>
                                <p>Unlimited Sales</p>
                                <p>Unlimited Streams</p>
                                <p>Exclusive Rights</p>
                            </div>
                        </div>
                        <div className="mt-auto w-full bg-[#3d3d3d] hover:bg-[#4a4a4a] transition cursor-pointer py-3.5 flex justify-center items-center gap-2 text-[12px] text-gray-200 border-t border-[#444] rounded-b-lg">
                            <span className="border border-gray-400 px-1.5 rounded-sm text-[10px] leading-none py-1">📄</span> License contract
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
