import pluginQuery from '@tanstack/eslint-plugin-query';
import tsParser from '@typescript-eslint/parser';

export default [
    ...pluginQuery.configs['flat/recommended'],
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            // Parser de TS para que ESLint entienda .ts/.tsx (espree no puede).
            // No activamos los rule-sets de typescript-eslint a propósito: aquí
            // solo queremos que corra el guard de imports de abajo, sin abrir un
            // lint completo del código existente.
            parser: tsParser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: {
            // El barrel raíz `@/features` ya no existe: su `export *` arrastraba
            // el grafo de todas las features (incl. recharts) al bundle principal
            // y creaba ciclos feature→barrel→feature. Importa siempre desde la
            // feature concreta (`@/features/<feature>`) o, dentro de una feature,
            // con rutas relativas.
            'no-restricted-imports': ['error', {
                paths: [{
                    name: '@/features',
                    message: 'No importes del barrel raíz @/features. Usa @/features/<feature> (o un import relativo dentro de la propia feature).',
                }],
            }],
        },
    },
];
