'use client';

import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { useAuth } from '@/components/AuthProvider';

const signupSchema = z.object({
	email: z.string().email('Enter a valid email address'),
	password: z.string().min(6, 'Password must be at least 6 characters')
});

export default function SignupPage() {
	const { supabase, user, loading } = useAuth();
	const [formState, setFormState] = useState<z.infer<typeof signupSchema>>({ email: '', password: '' });
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!loading && user) {
			window.location.href = '/dashboard';
		}
	}, [loading, user]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const parsed = signupSchema.safeParse(formState);
		if (!parsed.success) {
			setError(parsed.error.errors[0]?.message ?? 'Invalid form input');
			return;
		}
		setSubmitting(true);
		setError(null);
		const { email, password } = parsed.data;
		const { error: signUpError } = await supabase.auth.signUp({ email, password });
		if (signUpError) {
			setError(signUpError.message);
			setSubmitting(false);
			return;
		}
		window.location.href = '/onboarding';
	};

	const updateField = (field: 'email' | 'password', value: string) => {
		setFormState((prev) => ({ ...prev, [field]: value }));
	};

	const disableForm = submitting || loading;

	return (
		<div className="mx-auto mt-16 max-w-md rounded border border-white/10 bg-white/5 p-6 shadow-lg">
			<h1 className="text-2xl font-semibold text-white">Create your account</h1>
			<p className="mt-2 text-sm text-zinc-400">Sign up to start generating credits and invoices.</p>
			<form onSubmit={handleSubmit} className="mt-6 space-y-4">
				<label className="block text-sm font-medium text-zinc-200">
					Email
					<input
						type="email"
						name="email"
						value={formState.email}
						onChange={(event) => updateField('email', event.target.value)}
						className="mt-1 w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-white focus:border-white focus:outline-none"
						placeholder="you@example.com"
						required
						aria-invalid={Boolean(error)}
					/>
				</label>
				<label className="block text-sm font-medium text-zinc-200">
					Password
					<input
						type="password"
						name="password"
						value={formState.password}
						onChange={(event) => updateField('password', event.target.value)}
						className="mt-1 w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-white focus:border-white focus:outline-none"
						placeholder="••••••••"
						required
						minLength={6}
					/>
				</label>
				{error ? <p className="text-sm text-red-400">{error}</p> : null}
				<button
					type="submit"
					disabled={disableForm}
					className="w-full rounded bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? 'Creating account…' : 'Sign up'}
				</button>
			</form>
			<div className="mt-4 flex justify-between text-sm text-zinc-400">
				<a href="#" onClick={(event) => event.preventDefault()} className="hover:text-white">
					Forgot password?
				</a>
				<a href="/login" className="text-white hover:underline">
					Already have an account? Sign in
				</a>
			</div>
		</div>
	);
}


