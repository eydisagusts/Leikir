'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/services/auth';
import Link from 'next/link';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        name: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const validateEmail = (email: string): boolean => {
        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return false;
        }

        // Check for valid TLD (at least 2 characters after the dot)
        const tldRegex = /\.[a-zA-Z]{2,}$/;
        return tldRegex.test(email);
    };

    const validateUsername = (username: string): boolean => {
        // Check for spaces
        if (username.includes(' ')) {
            setError('Notendanafn má ekki innihalda bil');
            return false;
        }

        // Check length
        if (username.length > 25) {
            setError('Notendanafn má ekki vera lengra en 25 stafir');
            return false;
        }

        // Check if it's lowercase
        if (username !== username.toLowerCase()) {
            setError('Notendanafn verður að vera með lágstöfum');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Validate username
        if (!validateUsername(formData.username)) {
            return;
        }

        // Validate email
        if (!validateEmail(formData.email)) {
            setError('Vinsamlegast sláðu inn gilt netfang (t.d. notandi@dæmi.is)');
            return;
        }

        // Check if passwords match
        if (formData.password !== formData.confirmPassword) {
            setError('Lykilorðin passa ekki saman');
            return;
        }

        // Check password requirements
        const hasUpperCase = /[A-Z]/.test(formData.password);
        const hasLowerCase = /[a-z]/.test(formData.password);
        const hasNumber = /\d/.test(formData.password);
        const isLongEnough = formData.password.length >= 8;

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !isLongEnough) {
            setError('Lykilorðið verður að innihalda að minnsta kosti 8 stafi, einn hástaf, einn lágstaf og einn tölustaf');
            return;
        }

        setIsLoading(true);

        try {
            await registerUser({
                username: formData.username.toLowerCase(),
                password: formData.password,
                email: formData.email,
                name: formData.name
            });
            
            setSuccess('Aðgangur hefur verið stofnaður! Þú getur nú skráð þig inn.');
            
            // Clear form
            setFormData({
                username: '',
                password: '',
                confirmPassword: '',
                email: '',
                name: ''
            });

            // Redirect to login page after 2 seconds
            setTimeout(() => {
                router.push('/innskraning');
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Villa kom upp við nýskráningu');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase();
        setFormData({ ...formData, username: value });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Nýskráning
                    </h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <div>
                                <label htmlFor="name" className="sr-only">
                                    Nafn
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                    placeholder="Nafn"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            
                            <label htmlFor="username" className="sr-only">
                                Notendanafn
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                maxLength={25}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Notendanafn (lágstafir, engin bil, hámark 25 stafir)"
                                value={formData.username}
                                onChange={handleUsernameChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Netfang
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Netfang"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Lykilorð
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Lykilorð"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="sr-only">
                                Staðfesta lykilorð
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Staðfesta lykilorð"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="text-green-500 text-sm text-center">
                            {success}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isLoading ? 'Hleð...' : 'Nýskrá'}
                        </button>
                    </div>
                    <div className="text-sm text-center">
                        <Link href="/innskraning" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Ertu nú þegar með aðgang? Skráðu þig inn hér
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}