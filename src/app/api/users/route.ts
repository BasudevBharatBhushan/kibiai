// import { NextRequest, NextResponse } from "next/server";
// import { connectToDatabase } from "@/lib/mongodb";

// export async function GET() {
//   try {
//     const { db } = await connectToDatabase();
//     const users = await db.collection("users").find({}).toArray();
//     return NextResponse.json(users);
//   } catch (err) {
//     return NextResponse.json(
//       { error: "Failed to fetch users" },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(req: NextRequest) {
//   try {
//     const { name, email } = await req.json();
//     if (!name || !email)
//       return NextResponse.json({ error: "Missing fields" }, { status: 400 });

//     const { db } = await connectToDatabase();
//     const result = await db.collection("users").insertOne({ name, email });
//     return NextResponse.json({ ...result, name, email });
//   } catch (err) {
//     return NextResponse.json(
//       { error: "Failed to create user" },
//       { status: 500 }
//     );
//   }
// }
