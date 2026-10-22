// Both browser and native WebView can keep an optional UI preference locally.
// Study content is stored by the platform repository, never by this helper.
export function boardSizePreference(key: string) {
    return {
        load() {
            try {
                const value = Number(localStorage.getItem(key));
                return Number.isFinite(value) && value >= 50 && value <= 100 ? value : undefined;
            } catch {
                return undefined;
            }
        },
        save(value: number) {
            try {
                localStorage.setItem(key, String(value));
            } catch {
                /* Optional preference. */
            }
        },
    };
}
