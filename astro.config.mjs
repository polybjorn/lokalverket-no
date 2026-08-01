// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://lokalverket.no',
  // Astro 7 defaults this to 'jsx', which strips whitespace between adjacent
  // inline elements and silently changes rendered text. Keep the pre-7
  // behaviour; the same change closed the gaps around a separator in rovar-no
  // without failing the build.
  compressHTML: true,
});
