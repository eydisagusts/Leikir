'use client';

import { useState } from 'react';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [emailError, setEmailError] = useState('');

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateEmail(formData.email)) {
            setEmailError('Vinsamlegast sláðu inn gilt netfang');
            return;
        }

        setIsSubmitting(true);
        setEmailError('');
        
        // Simulate form submission
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setSubmitStatus('success');
        setIsSubmitting(false);
        
        // Reset form after 3 seconds
        setTimeout(() => {
            setSubmitStatus('idle');
            setFormData({ name: '', email: '', subject: '', message: '' });
        }, 3000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear email error when user starts typing
        if (name === 'email') {
            setEmailError('');
        }
    };

    return (
        <div className="min-h-[calc(100vh-200px)] py-12 px-4 sm:px-6 lg:px-8 text-black">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Hafa Samband</h1>
                    <p className="text-xl text-gray-600">
                        Ertu með athugasemdir eða tillögur? Við viljum heyra frá þér! Vinsamlegast fylltu út formið hér að neðan og við munum hafa samband við þig eins fljótt og auðið er.
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-black">
                                    Nafn
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    id="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="mt-1 px-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    placeholder="Jón Jónsson"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-black">
                                    Netfang
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`mt-1 px-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                                        emailError ? 'border-red-500' : ''
                                    }`}
                                    placeholder="jon@example.com"
                                />
                                {emailError && (
                                    <p className="mt-1 text-sm text-red-600">{emailError}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-black">
                                Efni
                            </label>
                            <input
                                type="text"
                                name="subject"
                                id="subject"
                                required
                                value={formData.subject}
                                onChange={handleChange}
                                className="mt-1 px-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Efni skilaboða"
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-black">
                                Skilaboð
                            </label>
                            <textarea
                                name="message"
                                id="message"
                                required
                                rows={6}
                                value={formData.message}
                                onChange={handleChange}
                                className="mt-1 px-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Skrifaðu skilaboð hér..."
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white ${
                                    isSubmitting 
                                        ? 'bg-blue-400 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sendir...
                                    </>
                                ) : (
                                    'Senda skilaboð'
                                )}
                            </button>
                        </div>

                        {submitStatus === 'success' && (
                            <div className="rounded-md bg-green-50 p-4 mt-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-green-800">
                                            Skilaboðin hafa verið send! Við munum hafa samband fljótlega.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">Netfang</h3>
                                <p className="mt-1 text-gray-600">info@leikir.is</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">Svarfrestur</h3>
                                <p className="mt-1 text-gray-600">Við reynum að svara öllum fyrirspurnum innan við 24 klukkutíma.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
