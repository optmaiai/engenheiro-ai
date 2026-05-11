import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        steel: "#1f3a5f",
        blueprint: "#0b1220",
        neon: "#38bdf8"
      }
    }
  },
  plugins: []
};

export default config;
