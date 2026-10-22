import StudyWorkspace from "@/features/studies/StudyWorkspace";
import { browserStudyPlatform } from "./platform";
import "./browser.css";

export default function BrowserApp() {
  return <StudyWorkspace platform={browserStudyPlatform} />;
}
