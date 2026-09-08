import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { issueEnhancementPlugin } from './build/issueEnhancementPlugin.ts';
import { mealPlanRecipeItemPlugin } from './build/mealPlanRecipeItemPlugin.ts';
import { recipeWalletPlugin } from './build/recipeWalletPlugin.ts';

export default defineConfig({
  base: './',
  plugins: [mealPlanRecipeItemPlugin(), issueEnhancementPlugin(), recipeWalletPlugin(), react()],
  server: { host: '0.0.0.0', port: 5173 },
});
