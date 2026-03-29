import React, { useState } from 'react';
import { X, Save, Loader, Tag, Music2, FileText } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, writeBatch, arrayUnion } from 'firebase/firestore';

const GENRES = ['Hip-Hop', 'Trap', 'Afrobeat', 'R&B', 'Pop', 'Drill', 'Jazz', 'Electronic', 'Gospel', 'Lo-fi', 'Other'];

/**
 * BulkEditModal
 * Props:
 *   selectedIds  – array of beat IDs
 *   onClose      – fn()
 *   onSaved      – fn() – called after save so parent can refresh
 */
export default function BulkEditModal({ selectedIds, onClose, onSaved }) {
    const [tagsInput, setTagsInput] = useState('');
    const [tagsMode, setTagsMode]   = useState('append'); // 'append' | 'replace'
    const [genre, setGenre]         = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving]       = useState(false);

    const handleSave = async () => {
        if (selectedIds.length === 0) return;

        const newTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        const anyUpdate = genre || description || newTags.length > 0;

        if (!anyUpdate) {
            alert('Fill in at least one field to update.');
            return;
        }

        setSaving(true);
        try {
            if (tagsMode === 'replace') {
                // Batch: all updates can coexist
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    const updates = {};
                    if (genre) updates.genre = genre.trim();
                    if (description) updates.description = description.trim();
                    if (newTags.length > 0) updates.tags = newTags;
                    if (Object.keys(updates).length > 0) batch.update(doc(db, 'beats', id), updates);
                });
                await batch.commit();
            } else {
                // Append mode — arrayUnion for tags; batch the rest
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    const updates = {};
                    if (genre) updates.genre = genre.trim();
                    if (description) updates.description = description.trim();
                    if (newTags.length > 0) updates.tags = arrayUnion(...newTags);
                    if (Object.keys(updates).length > 0) batch.update(doc(db, 'beats', id), updates);
                });
                await batch.commit();
            }

            onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Bulk update failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#1e293b] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div>
                        <h2 className="text-lg font-bold text-white">Bulk Edit</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{selectedIds.length} beat{selectedIds.length !== 1 ? 's' : ''} selected</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition"><X size={20} /></button>
                </div>

                <div className="p-6 flex flex-col gap-5">
                    {/* Tags */}
                    <div>
                        <label className="flex items-center gap-1.5 text-gray-400 text-sm mb-2">
                            <Tag size={13} /> Tags (comma separated)
                        </label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={e => setTagsInput(e.target.value)}
                            placeholder="hiphop, trap, melodic"
                            className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                        />
                        <div className="flex gap-4 mt-2">
                            {[['append', 'Add to existing tags'], ['replace', 'Replace all tags']].map(([m, label]) => (
                                <label key={m} className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                    <input
                                        type="radio" name="tagsMode" value={m}
                                        checked={tagsMode === m}
                                        onChange={() => setTagsMode(m)}
                                        className="accent-[#facc15]"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Genre */}
                    <div>
                        <label className="flex items-center gap-1.5 text-gray-400 text-sm mb-2">
                            <Music2 size={13} /> Genre
                        </label>
                        <select
                            value={genre}
                            onChange={e => setGenre(e.target.value)}
                            className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition"
                        >
                            <option value="">— skip genre —</option>
                            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="flex items-center gap-1.5 text-gray-400 text-sm mb-2">
                            <FileText size={13} /> Description
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Describe this beat..."
                            rows={3}
                            className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg focus:border-[#facc15] outline-none text-white text-sm transition resize-none"
                        />
                    </div>

                    <p className="text-xs text-gray-500">Empty fields are skipped — only filled fields will be updated for all selected beats.</p>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 transition text-sm disabled:opacity-50">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-lg bg-[#facc15] text-black font-bold hover:bg-yellow-400 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Apply to All'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
