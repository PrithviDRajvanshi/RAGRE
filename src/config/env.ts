import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing required environment variable DATABASE_URL. Set it in .env or your environment.",
  );
}

export const env = {
  DATABASE_URL: databaseUrl,
};
