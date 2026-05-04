import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const LoginView = () => {
  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Customer Connect</h1>
          <p className="text-gray-500">Manage your relationships with clarity and ease.</p>
        </div>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 border border-gray-200 py-4 px-6 rounded-2xl font-medium shadow-sm active:scale-95 transition-transform"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};
