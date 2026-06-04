import { AppProvider, useAppContext } from "@/lib/context";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { BikeProfiles } from "@/pages/BikeProfiles";
import { Analyze } from "@/pages/analyze";
import { Results } from "@/pages/results";
import { BikeVisualizer } from "@/pages/BikeVisualizer";
import { History } from "@/pages/history";
import { PhotoFit } from "@/pages/PhotoFit";

function AppContent() {
  const { activeTab } = useAppContext();

  return (
    <Layout>
      {activeTab === "home" && <Home />}
      {activeTab === "bikes" && <BikeProfiles />}
      {activeTab === "analyze" && <Analyze />}
      {activeTab === "results" && <Results />}
      {activeTab === "visualizer" && <BikeVisualizer />}
      {activeTab === "photo" && <PhotoFit />}
      {activeTab === "history" && <History />}
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
      <Toaster />
    </AppProvider>
  );
}

export default App;
