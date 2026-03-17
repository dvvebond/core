import { Highlight, themes } from "prism-react-renderer";
import { useState } from "react";

interface CodeDisplayProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeDisplay({
  code,
  language = "tsx",
  filename,
  showLineNumbers = true,
}: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-header">
        {filename && <span className="filename">{filename}</span>}
        <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="code-content">
        <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={className}
              style={{ ...style, margin: 0, padding: 0, background: "transparent" }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {showLineNumbers && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "2em",
                        marginRight: "1em",
                        textAlign: "right",
                        color: "#506882",
                        userSelect: "none",
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}

interface InlineCodeProps {
  children: string;
}

export function InlineCode({ children }: InlineCodeProps) {
  return (
    <code
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "0.875em",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {children}
    </code>
  );
}

interface CodeTabsProps {
  tabs: Array<{
    label: string;
    code: string;
    language?: string;
    filename?: string;
  }>;
}

export function CodeTabs({ tabs }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="code-block">
      <div className="code-header">
        <div className="btn-group">
          {tabs.map((tab, index) => (
            <button
              key={index}
              className={`btn btn-sm ${activeTab === index ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab(index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="code-content">
        <Highlight
          theme={themes.nightOwl}
          code={tabs[activeTab]?.code.trim() || ""}
          language={tabs[activeTab]?.language || "tsx"}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={className}
              style={{ ...style, margin: 0, padding: 0, background: "transparent" }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "2em",
                      marginRight: "1em",
                      textAlign: "right",
                      color: "#506882",
                      userSelect: "none",
                    }}
                  >
                    {i + 1}
                  </span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}
