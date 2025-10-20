import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface CreateUserFormProps {
  onUserCreated?: (user: { email: string; password: string }) => void;
}

export const CreateUserForm: React.FC<CreateUserFormProps> = ({ onUserCreated }) => {
  const [email, setEmail] = useState('demo@virtualstudio.ai');
  const [password, setPassword] = useState('DemoPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    // Simulate user creation
    setTimeout(() => {
      setCreated(true);
      setIsCreating(false);
      onUserCreated?.({ email, password });
    }, 1500);
  };

  if (created) {
    return (
      <div className="max-w-md mx-auto bg-zinc-900 rounded-2xl border border-white/10 p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">User Created Successfully!</h3>
        <div className="space-y-2 text-zinc-400">
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Password:</strong> {password}</p>
          <p><strong>Plan:</strong> Brand (Premium)</p>
          <p><strong>Generations:</strong> 2,500/month</p>
        </div>
        <div className="mt-6 p-4 bg-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-300">
            You can now use these credentials to sign in to the studio. 
            All features are available with the Brand plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-zinc-900 rounded-2xl border border-white/10 p-8">
      <div className="text-center mb-6">
        <User className="w-12 h-12 text-violet-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white">Create Your Account</h2>
        <p className="text-zinc-400 mt-2">Get started with Studio AI</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Create a password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-zinc-800 rounded-lg">
        <h4 className="text-sm font-semibold text-white mb-2">What you get:</h4>
        <ul className="text-sm text-zinc-300 space-y-1">
          <li>• 2,500 AI generations per month</li>
          <li>• All three studios (Apparel, Product, Design)</li>
          <li>• Advanced features & batch processing</li>
          <li>• Commercial usage rights</li>
        </ul>
      </div>
    </div>
  );
};
