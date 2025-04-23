import { Client, Storage, ID } from "appwrite";
import { env } from "../config/env.js";

const client = new Client();
client.setEndpoint("https://cloud.appwrite.io/v1").setProject(env.APPWRITE_PROJECT_ID);

const storage = new Storage(client);
export { client, storage, ID };
