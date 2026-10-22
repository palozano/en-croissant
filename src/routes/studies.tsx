import { createFileRoute } from "@tanstack/react-router";
import DesktopStudyWorkspace from "@/platform/desktop/StudyWorkspace";

export const Route = createFileRoute("/studies")({ component: DesktopStudyWorkspace });
