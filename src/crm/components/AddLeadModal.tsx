import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, X, Calendar } from 'lucide-react';
import { Toast } from '../../../components/Toast';
import './MonthFilter.css';

interface AddLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: () => void; // Callback to refresh leads list
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);


    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const [isAssignedToOpen, setIsAssignedToOpen] = useState(false);
    const sourceRef = useRef<HTMLDivElement>(null);
    const assignedToRef = useRef<HTMLDivElement>(null);
    const sourceOptions = ['Chatbot', 'Website', 'Admin - Call', 'Admin - WhatsApp', 'Intake Form', 'Instagram', 'Google Search', 'Linkedin', 'Pooja Reference', 'Other (Mention)'];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sourceRef.current && !sourceRef.current.contains(event.target as Node)) {
                setIsSourceOpen(false);
            }
            if (assignedToRef.current && !assignedToRef.current.contains(event.target as Node)) {
                setIsAssignedToOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);


    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        city: '',
        age: '',
        source: 'Chatbot',
        otherSource: '',
        assignedTo: '', // Defaulting to unassigned
        remarks: '',
                    dateOfEnquiry: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    city: formData.city,
                    age: formData.age,
                    source: formData.source === 'Other (Mention)' && formData.otherSource.trim() !== '' 
                        ? formData.otherSource 
                        : formData.source,

                    general_remarks: formData.remarks,
                    date_of_enquiry: formData.dateOfEnquiry
                })
            });

            if (response.ok) {
                setToast({ message: 'Lead added successfully!', type: 'success' });
                onAdd(); // Refresh the list
                // reset form
                setFormData({
                    name: '', email: '', phone: '', city: '', age: '',
                    source: 'Chatbot', otherSource: '', assignedTo: '', remarks: '',
                                dateOfEnquiry: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
                });
                setTimeout(() => {
                    onClose(); // Close modal after showing toast
                }, 2000);
            } else {
                const err = await response.json();
                setToast({ message: 'Failed to add lead: ' + (err.error || 'Unknown error'), type: 'error' });
            }
        } catch (error) {
            console.error('Submission error:', error);
            setToast({ message: 'Network error while adding lead.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-8 w-full max-w-xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <UserPlus size={24} />
                        <h2 className="text-2xl font-bold">Add New Lead</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Name<span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2">Date of Enquiry</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="date"
                                        name="dateOfEnquiry"
                                        value={formData.dateOfEnquiry}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2">Email (Optional)</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">City</label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2">Age</label>
                                <input
                                    type="number"
                                    name="age"
                                    min="1"
                                    max="120"
                                    value={formData.age}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Source<span className="text-red-500">*</span></label>
                                <div className="custom-dropdown w-full" ref={sourceRef}>
                                    <button
                                        type="button"
                                        className="dropdown-trigger w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                        onClick={() => setIsSourceOpen(!isSourceOpen)}
                                    >
                                        <span>{formData.source}</span>
                                        <svg
                                            className={`dropdown-arrow ${isSourceOpen ? 'open' : ''}`}
                                            width="16"
                                            height="16"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                        >
                                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    {isSourceOpen && (
                                        <div className="dropdown-menu w-full max-h-48 overflow-y-auto">
                                            {sourceOptions.map(option => (
                                                <div
                                                    key={option}
                                                    className={`dropdown-item ${formData.source === option ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, source: option }));
                                                        setIsSourceOpen(false);
                                                    }}
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {formData.source === 'Other (Mention)' && (
                                    <input
                                        type="text"
                                        name="otherSource"
                                        placeholder="Please specify source"
                                        required
                                        value={formData.otherSource}
                                        onChange={handleChange}
                                        className="w-full mt-3 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                )}
                            </div>

                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-2">Remarks</label>
                            <textarea
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleChange}
                                placeholder="Add any initial notes here..."
                                rows={3}
                                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                            ></textarea>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end mt-8 border-t pt-6">
                        <button
                            type="button"
                            className="px-6 py-2 border rounded-lg hover:bg-gray-100 font-medium text-gray-700"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 font-medium disabled:bg-gray-400 min-w-[120px]"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Add Lead'}
                        </button>
                    </div>
                </form>
            </div>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default AddLeadModal;
