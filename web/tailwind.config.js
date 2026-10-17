import forms from '@tailwindcss/forms'

export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        primary: '#004ac6', 'primary-container': '#2563eb',
        surface: '#f7f9fb', 'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f4f6', 'surface-container-high': '#e6e8ea',
        'surface-container-highest': '#e0e3e5', 'on-surface': '#191c1e',
        'on-surface-variant': '#434655', outline: '#737686',
        'outline-variant': '#c3c6d7', error: '#ba1a1a',
        'error-container': '#ffdad6', secondary: '#495c95',
        'primary-fixed': '#dbe1ff', 'tertiary-container': '#bc4800',
        'on-tertiary-container': '#ffede6', 'on-primary-container': '#eeefff'
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif']
      },
      // New API / MD3 style radius: nothing on cards, panels, inputs or
      // buttons exceeds `--radius: 0.5rem`. Large Tailwind steps are clamped
      // here so no `rounded-xl`/`rounded-2xl` is reintroduced by accident.
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.5rem',
        '2xl': '0.5rem',
        '3xl': '0.5rem'
      }
    }
  },
  plugins: [forms]
}
