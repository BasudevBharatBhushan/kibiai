"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import kibiaiLogo from "@/assets/kibiai.png";
import Link from "next/link";

export default function GlobalLoginPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState("");
  const [baseDomain, setBaseDomain] = useState("");
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    // Only access window on the client side
    if (typeof window !== "undefined") {
      setIsLocalhost(
        window.location.hostname.includes("localhost") ||
        window.location.hostname.includes("127.0.0.1") ||
        window.location.hostname.startsWith("192.168.")
      );
      // Extract base domain from env
      setBaseDomain(process.env.NEXT_PUBLIC_BASE_DOMAIN || "");
    }
  }, []);

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = workspace.trim().toLowerCase();
    if (!slug) return;

    if (isLocalhost) {
      window.location.href = `/${slug}/login`;
    } else {
      window.location.href = `https://${slug}.${baseDomain}/login`;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <Image
            src={kibiaiLogo}
            alt="KiBiAI Logo"
            className="h-16 w-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Find Your Workspace</h1>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider text-center">
            Sign in to KiBiAI
          </p>
        </div>

        <form onSubmit={handleGo} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workspace URL</label>
            <div className="flex items-center rounded-md shadow-sm">
              {isLocalhost ? (
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  localhost:3000/
                </span>
              ) : (
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  https://
                </span>
              )}
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="company-name"
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
                autoFocus
              />
              {!isLocalhost && (
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  .{baseDomain}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Enter your company's workspace slug to continue to login.
            </p>
          </div>

          <button
            type="submit"
            disabled={!workspace.trim()}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Workspace
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <Link href="/admin" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
            Are you a Platform Admin? Sign in here.
          </Link>
        </div>
      </div>
    </div>
  );
}
