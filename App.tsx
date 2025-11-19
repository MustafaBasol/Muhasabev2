import React from 'react';
import BrandLogo from './src/components/BrandLogo';

export default function App() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="flex items-center gap-4 px-4 py-2 border-b bg-white">
				<BrandLogo className="h-8" />
				<span className="text-sm text-gray-500">Comptario</span>
			</header>
			<main className="flex-1 p-4">
				{/* İçeriği uygulamanın ana giriş noktasında React Router veya başka bir yapıyla doldurun */}
				<p className="text-gray-600 text-sm">App root bileşeni hazır. Header’da marka logosu gösteriliyor.</p>
			</main>
		</div>
	);
}
