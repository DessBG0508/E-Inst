import type { ScreeningState } from "@/lib/eli-screening";
import { DailyMoodWidget } from "./daily-mood-widget";
import { QuickExercisesCard } from "./quick-exercises-card";
import { ScreeningProgressCard } from "./screening-progress-card";

interface ChatSidePanelProps {
  screeningState: ScreeningState;
  storedFolio?: string | null;
  userKey?: string | null;
  onOpenBreathing: () => void;
  onOpenGrounding: () => void;
}

export function ChatSidePanel({
  screeningState,
  storedFolio,
  userKey,
  onOpenBreathing,
  onOpenGrounding,
}: ChatSidePanelProps) {
  return (
    <div className="space-y-4">
      <ScreeningProgressCard screeningState={screeningState} storedFolio={storedFolio} />
      <DailyMoodWidget userKey={userKey} />
      <QuickExercisesCard onOpenBreathing={onOpenBreathing} onOpenGrounding={onOpenGrounding} />
    </div>
  );
}
