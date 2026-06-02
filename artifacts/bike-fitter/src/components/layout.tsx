import { ReactNode } from "react";
import { Home, Bike, Activity, Clock, Layers } from "lucide-react";
import { useAppContext } from "@/lib/context";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const { activeTab, setActiveTab } = useAppContext();

  const tabs = [
    { id: "home" as const, label: "首頁", icon: Home },
    { id: "bikes" as const, label: "車型", icon: Bike },
    { id: "analyze" as const, label: "分析", icon: Activity },
    { id: "visualizer" as const, label: "模擬", icon: Layers },
    { id: "history" as const, label: "紀錄", icon: Clock },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-[calc(4rem+env(safe-area-inset-bottom,16px))]">
      <main className="flex-1 w-full max-w-md mx-auto relative">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-[env(safe-area-inset-bottom,16px)]">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
