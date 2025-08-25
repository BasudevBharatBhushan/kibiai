import { MongoClient, Db } from "mongodb";

let client: MongoClient;
let db: Db;

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB!;

if (!uri) throw new Error("Please add MONGODB_URI to env");
if (!dbName) throw new Error("Please add MONGODB_DB to env");

export async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
  }
  return { client, db };
}
