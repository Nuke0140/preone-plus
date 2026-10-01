import type { Metadata, Viewport } from "next";
import PreHydration from "@/components/PreHydration";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreOne Plus — School Operating System",
  description:
    "One beautiful operating system for every preschool. Admissions, students, attendance, fees and parent communication — all in one place.",
  keywords: ["PreOne Plus", "school", "ERP", "admissions", "attendance", "fees", "exams", "library", "hostel", "timetable"],
  authors: [{ name: "PreOne Plus" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6FC" },
    { media: "(prefers-color-scheme: dark)", color: "#090D24" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <PreHydration />
        {children}
      </body>
    </html>
  );
}
