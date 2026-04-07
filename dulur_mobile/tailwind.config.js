/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter_400Regular', 'Inter_500Medium', 'Inter_700Bold', 'sans-serif'],
        serif: ['PlayfairDisplay_400Regular', 'PlayfairDisplay_600SemiBold', 'PlayfairDisplay_700Bold', 'serif'],
      },
      colors: {
        background: '#ffffff',
        foreground: '#1c1917',
        primary: {
          DEFAULT: '#1c1917',
          foreground: '#ffffff'
        },
        muted: '#f5f5f4',
        'muted-foreground': '#78716c',
        card: '#ffffff',
        destructive: '#ef4444',
      }
    },
  },
  plugins: [],
}

