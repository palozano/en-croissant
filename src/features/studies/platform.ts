import type { EngineFactory } from "@/features/analysis/engine";
import type { Study } from "./model";

export interface StudyRepository {
    load(): Promise<Study[]>;
    save(study: Study, expectedUpdatedAt?: number): Promise<void>;
    delete(id: string): Promise<void>;
    reset?: (emptyStudy: Study) => Promise<void>;
}
export interface StudyPlatform {
    repository: StudyRepository;
    boardSize?: { load(): number | undefined; save(value: number): void };
    fitBoardToViewport?: boolean;
    createEngine: EngineFactory;
    engineName: string;
    engineCredit?: { label: string; url: string };
    exportFile(name: string, contents: string): void | Promise<void>;
    downloadPgn(url: string): Promise<string>;
    confirm(message: string): Promise<boolean>;
    requestPersistence(): Promise<boolean>;
    prepareOffline?: () => Promise<void>;
    openPresentation?: (url: URL, id: string) => Promise<boolean>;
    labels: {
        save: string;
        saved: string;
        privacy: string;
        storageHelp: string;
        deleteLocation: string;
    };
}
