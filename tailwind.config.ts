import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F1116",
          soft: "#161922",
          softer: "#1E222D",
          line: "#2A2F3D",
        },
        parchment: "#EDEAE2",
        mute: "#8B90A0",
        amber: {
          DEFAULT: "#E3A63E",
          bright: "#F0BE5F",
          dim: "#8A6A2E",
        },
        teal: {
          DEFAULT: "#4E9E97",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
