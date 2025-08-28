"use client";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 bg-amber-700">Users</h1>
      <Link href="/reports">
        <button className="border-2 bg-amber-300">Go to Reports</button>
      </Link>
    </div>
  );
}
