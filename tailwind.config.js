/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'primary-gold': '#facc15',
                'bg-dark': '#0f172a',
                'bg-darker': '#1e293b',
            }
        },
    },
    plugins: [],
}
