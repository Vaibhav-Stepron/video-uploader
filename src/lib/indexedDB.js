const DB_NAME = "VideoUploaderDB";
const DB_VERSION = 1;
const STORE_NAME = "uploads";

let db = null;

export const initDB = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true,
                });
                store.createIndex("uploadedAt", "uploadedAt", { unique: false });
                store.createIndex("fileName", "fileName", { unique: false });
            }
        };
    });
};

export const addUpload = async (uploadData) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            ...uploadData,
            uploadedAt: new Date().toISOString(),
        };

        const request = store.add(data);

        request.onsuccess = () => {
            resolve({ ...data, id: request.result });
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const getAllUploads = async () => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Sort by uploadedAt descending (newest first)
            const uploads = request.result.sort(
                (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
            );
            resolve(uploads);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const deleteUpload = async (id) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve(true);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const clearAllUploads = async () => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            resolve(true);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const getUploadById = async (id) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};
