import { studySchema, type Study } from "./studies";

// Keep the legacy database name so existing browser studies remain accessible.
const DATABASE = "en-croissant-web";
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
    connection ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () =>
            request.result.createObjectStore("studies", { keyPath: "id" });
        request.onsuccess = () => {
            request.result.onversionchange = () => {
                request.result.close();
                connection = undefined;
            };
            resolve(request.result);
        };
        request.onerror = () => {
            connection = undefined;
            reject(request.error);
        };
        request.onblocked = () => {
            connection = undefined;
            reject(new Error("Close other tabs to open storage."));
        };
    });
    return connection;
}
export async function loadStudies(): Promise<Study[]> {
    const db = await database();
    return new Promise((resolve, reject) => {
        const request = db.transaction("studies").objectStore("studies").getAll();
        request.onsuccess = () => {
            try {
                resolve(
                    request.result
                        .map((value) => studySchema.parse(value))
                        .sort((a, b) => b.updatedAt - a.updatedAt),
                );
            } catch {
                reject(new Error("Could not read saved studies. No data has been overwritten."));
            }
        };
        request.onerror = () => reject(request.error);
    });
}
export async function saveStudy(study: Study, expectedUpdatedAt?: number): Promise<void> {
    const db = await database();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("studies", "readwrite");
        const store = transaction.objectStore("studies");
        const value = studySchema.parse(study);
        let conflict: Error | undefined;
        if (expectedUpdatedAt === undefined) store.put(value);
        else {
            const read = store.get(study.id);
            read.onsuccess = () => {
                if (read.result?.updatedAt !== expectedUpdatedAt) {
                    conflict = new Error(
                        "This study has changed in another tab. Export your version and reload before editing further.",
                    );
                    transaction.abort();
                } else store.put(value);
            };
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
            reject(conflict ?? transaction.error ?? new Error("Could not save the study."));
    });
}
export async function deleteStudy(id: string): Promise<void> {
    const db = await database();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("studies", "readwrite");
        transaction.objectStore("studies").delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}
// Clear the library and create its empty starting workspace in one transaction.
// A failed reset cannot leave half the studies deleted or lose the workspace.
export async function resetStudies(emptyStudy: Study): Promise<void> {
    const value = studySchema.parse(emptyStudy);
    const db = await database();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("studies", "readwrite");
        const store = transaction.objectStore("studies");
        store.clear();
        store.put(value);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
            reject(transaction.error ?? new Error("Could not delete the studies."));
    });
}
export function downloadFile(name: string, contents: string, type = "application/x-chess-pgn") {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name.replace(/[\\/:*?"<>|]/g, "_");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
