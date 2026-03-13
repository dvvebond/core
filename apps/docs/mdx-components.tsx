import { LibPDFNoPdfJsViewerDemo } from "@/components/libpdf-no-pdfjs-viewer-demo";
import { PDFViewerDemo } from "@/components/pdf-viewer-demo";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    LibPDFNoPdfJsViewerDemo,
    PDFViewerDemo,
    ...components,
  };
}
