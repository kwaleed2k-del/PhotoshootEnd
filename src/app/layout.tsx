import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import '../../styles.css';

export const metadata: Metadata = {
	title: 'Lenci Studio',
	description: 'AI-powered studio with billing and subscription management'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<AuthProvider>
					<AppShell>{children}</AppShell>
				</AuthProvider>
			</body>
		</html>
	);
}


