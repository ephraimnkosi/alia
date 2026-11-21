import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

interface UserMemory {
    messages: ConversationMessage[];
    memories: string[];
    personality: string;
}

interface MemoryData {
    users: Record<string, UserMemory>;
}

export interface UserProfile {
    messages: ConversationMessage[];
    relevantMessages: ConversationMessage[];
    memories: string[];
    personality: string;
    conversationCount: number;
}

const EMPTY_USER: UserMemory = { messages: [], memories: [], personality: "" };
const RECENT_MESSAGE_COUNT = 24;
const MAX_SAVED_NOTES = 100;
const COMMON_WORDS = new Set([
    "about", "after", "again", "also", "and", "are", "because", "been", "before",
    "being", "but", "can", "could", "did", "does", "for", "from", "have", "here",
    "how", "into", "just", "like", "more", "most", "much", "need", "not", "our",
    "please", "really", "same", "some", "tell", "than", "that", "their", "them",
    "then", "there", "these", "they", "this", "those", "through", "time", "very",
    "want", "was", "were", "what", "when", "where", "which", "who", "why", "with",
    "would", "your",
]);

export class MemoryStore {
    private data: MemoryData | undefined;
    private queue: Promise<void> = Promise.resolve();

    constructor(private readonly filePath: string) {}

    async getProfile(userId: number, query = ""): Promise<UserProfile> {
        return this.enqueue(async () => {
            await this.load();
            const user = this.getUser(userId);
            const recentStart = Math.max(0, user.messages.length - RECENT_MESSAGE_COUNT);
            const recentMessages = user.messages.slice(recentStart);

            return {
                messages: recentMessages,
                relevantMessages: this.findRelevantMessages(user.messages, recentStart, query),
                memories: [...user.memories],
                personality: user.personality,
                conversationCount: user.messages.length,
            };
        });
    }

    async addMessage(userId: number, role: ConversationMessage["role"], content: string): Promise<void> {
        await this.enqueue(async () => {
            await this.load();
            this.getUser(userId).messages.push({ role, content, timestamp: new Date().toISOString() });
            await this.save();
        });
    }

    async remember(userId: number, note: string): Promise<void> {
        await this.enqueue(async () => {
            await this.load();
            const memories = this.getUser(userId).memories;
            if (!memories.includes(note)) {
                if (memories.length >= MAX_SAVED_NOTES) {
                    throw new Error(`A user can save at most ${MAX_SAVED_NOTES} notes.`);
                }
                memories.push(note);
                await this.save();
            }
        });
    }

    async setPersonality(userId: number, personality: string): Promise<void> {
        await this.enqueue(async () => {
            await this.load();
            this.getUser(userId).personality = personality;
            await this.save();
        });
    }

    async forget(userId: number): Promise<void> {
        await this.enqueue(async () => {
            await this.load();
            delete this.data?.users[String(userId)];
            await this.save();
        });
    }

    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async load(): Promise<void> {
        if (this.data) return;

        try {
            const content = await readFile(this.filePath, "utf8");
            const parsed: unknown = JSON.parse(content);
            if (!isMemoryData(parsed)) {
                throw new Error(`Memory file has an invalid format: ${this.filePath}`);
            }
            this.data = parsed;
        } catch (error) {
            if (isMissingFile(error)) {
                this.data = { users: {} };
                return;
            }
            throw error;
        }
    }

    private getUser(userId: number): UserMemory {
        const key = String(userId);
        const existing = this.data?.users[key];
        if (existing) return existing;

        const user = { ...EMPTY_USER, messages: [], memories: [] };
        if (!this.data) throw new Error("Memory store has not been loaded.");
        this.data.users[key] = user;
        return user;
    }

    private async save(): Promise<void> {
        if (!this.data) throw new Error("Memory store has not been loaded.");

        await mkdir(dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
        try {
            await writeFile(temporaryPath, JSON.stringify(this.data, null, 2), "utf8");
            await rename(temporaryPath, this.filePath);
        } catch (error) {
            await unlink(temporaryPath).catch((cleanupError: NodeJS.ErrnoException) => {
                if (cleanupError.code !== "ENOENT") throw cleanupError;
            });
            throw error;
        }
    }

    private findRelevantMessages(
        messages: ConversationMessage[],
        recentStart: number,
        query: string,
    ): ConversationMessage[] {
        const terms = new Set(
            (query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
                .filter((term) => !COMMON_WORDS.has(term)),
        );
        if (terms.size === 0) return [];

        return messages
            .slice(0, recentStart)
            .map((message, index) => {
                const messageTerms = new Set(
                    message.content.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [],
                );
                const score = [...terms].filter((term) => messageTerms.has(term)).length
                    / Math.sqrt(messageTerms.size || 1);
                return { message, index, score };
            })
            .filter((result) => result.score > 0)
            .sort((left, right) => right.score - left.score || right.index - left.index)
            .slice(0, 4)
            .sort((left, right) => left.index - right.index)
            .map(({ message }) => message);
    }
}

function isMemoryData(value: unknown): value is MemoryData {
    if (typeof value !== "object" || value === null || !("users" in value)) return false;
    const users = value.users;
    if (typeof users !== "object" || users === null || Array.isArray(users)) return false;
    return Object.values(users).every((user) => {
        if (typeof user !== "object" || user === null) return false;
        const candidate = user as Partial<UserMemory>;
        return Array.isArray(candidate.messages)
            && candidate.messages.every((message) =>
                typeof message === "object"
                && message !== null
                && (message.role === "user" || message.role === "assistant")
                && typeof message.content === "string"
                && typeof message.timestamp === "string",
            )
            && Array.isArray(candidate.memories)
            && candidate.memories.every((note) => typeof note === "string")
            && typeof candidate.personality === "string";
    });
}

function isMissingFile(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
