import { Routes, Route, Navigate } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AzureIntegrationExample } from "./examples/AzureIntegrationExample";
import { HighlightingExample } from "./examples/HighlightingExample";
import { InteractiveExample } from "./examples/InteractiveExample";
import { PerformanceExample } from "./examples/PerformanceExample";
import { ReactPDFViewerExample } from "./examples/ReactPDFViewerExample";
import { SearchExample } from "./examples/SearchExample";
import { ViewerVariantsExample } from "./examples/ViewerVariantsExample";
import { ViewportExample } from "./examples/ViewportExample";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/react-pdf-viewer" replace />} />
        <Route path="/react-pdf-viewer" element={<ReactPDFViewerExample />} />
        <Route path="/azure-integration" element={<AzureIntegrationExample />} />
        <Route path="/search" element={<SearchExample />} />
        <Route path="/highlighting" element={<HighlightingExample />} />
        <Route path="/viewer-variants" element={<ViewerVariantsExample />} />
        <Route path="/interactive" element={<InteractiveExample />} />
        <Route path="/viewport" element={<ViewportExample />} />
        <Route path="/performance" element={<PerformanceExample />} />
      </Routes>
    </Layout>
  );
}
