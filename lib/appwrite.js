import { Client, Storage, ID } from "appwrite";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "../config/env";

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

const storage = new Storage(client);
export { client, storage, ID };
