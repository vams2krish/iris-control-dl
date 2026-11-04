import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Iris Control — Your eyes, in control", description: "Private, on-device gaze control. Set up your Android controller and explore a local browser demo." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
