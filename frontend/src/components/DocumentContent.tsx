import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type RenderableImage = {
  url: string;
  alt?: string;
  caption?: string;
};

type RenderableTextBlock = {
  type: 'text';
  markdown: string;
};

type RenderableImageRowBlock = {
  type: 'image_row';
  layout: 'single' | 'double';
  images: RenderableImage[];
};

export type RenderableContentBlock = RenderableTextBlock | RenderableImageRowBlock;

type DocumentContentProps = {
  blocks: RenderableContentBlock[];
  className?: string;
  emptyState?: React.ReactNode;
};

export default function DocumentContent({
  blocks,
  className,
  emptyState = null,
}: DocumentContentProps) {
  if (blocks.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return <DocumentMarkdown key={`${block.type}-${index}`} markdown={block.markdown} />;
        }

        return (
          <div
            key={`${block.type}-${index}`}
            style={{
              display: 'grid',
              gap: '16px',
              margin: '0 0 22px',
              gridTemplateColumns: block.layout === 'double' ? '1fr 1fr' : '1fr',
            }}
          >
            {block.images.map((image, imageIndex) => (
              <figure key={`${image.url}-${imageIndex}`} style={{ margin: 0 }}>
                <img
                  src={image.url}
                  alt={image.alt || `Row image ${imageIndex + 1}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    objectFit: 'cover',
                    borderRadius: '16px',
                  }}
                />
                {image.caption ? (
                  <figcaption
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      lineHeight: '1.6',
                      color: '#6b7280',
                    }}
                  >
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DocumentMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ node, ...props }) => {
          const id = slugify(props.children);
          return (
            <h1
              id={id}
              style={{
                fontSize: '24px',
                fontWeight: '800',
                marginTop: '1.5em',
                marginBottom: '0.8em',
                color: '#1a1a1a',
                letterSpacing: 0,
                lineHeight: '1.2',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              {...props}
            />
          );
        },
        h2: ({ node, ...props }) => {
          const id = slugify(props.children);
          return (
            <h2
              id={id}
              style={{
                fontSize: '20px',
                fontWeight: '800',
                marginTop: '2em',
                marginBottom: '0.6em',
                color: '#1a1a1a',
                letterSpacing: 0,
                lineHeight: '1.2',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              {...props}
            />
          );
        },
        h3: ({ node, ...props }) => {
          const id = slugify(props.children);
          return (
            <h3
              id={id}
              style={{
                fontSize: '20px',
                fontWeight: '700',
                marginTop: '1.5em',
                marginBottom: '0.5em',
                color: '#1a1a1a',
                letterSpacing: 0,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              {...props}
            />
          );
        },
        p: ({ node, ...props }) => (
          <p style={{ marginBottom: '1.4em', color: '#374151', fontSize: '16px' }} {...props} />
        ),
        a: ({ node, ...props }) => (
          <a
            style={{
              color: '#1a1a1a',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: '600',
            }}
            {...props}
          />
        ),
        code: ({ node, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          if (isInline) {
            return (
              <code
                style={{
                  background: '#f6f8fa',
                  padding: '0.2em 0.4em',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#cf222e',
                  fontFamily: 'SFMono-Regular, Consolas, monospace',
                }}
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ node, ...props }) => <CodeBlock>{props.children}</CodeBlock>,
        blockquote: ({ node, ...props }) => (
          <blockquote
            style={{
              margin: '2em 0',
              padding: '1.2em 1.8em',
              color: '#636e7b',
              borderLeft: '4px solid #d0d7de',
              background: '#fcfcfc',
              borderRadius: '0 12px 12px 0',
              fontStyle: 'italic',
              fontSize: '16px',
            }}
            {...props}
          />
        ),
        ul: ({ node, ...props }) => (
          <ul style={{ marginBottom: '1.5em', paddingLeft: '1.5em', listStyleType: 'disc' }} {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol
            style={{ marginBottom: '1.5em', paddingLeft: '1.5em', listStyleType: 'decimal' }}
            {...props}
          />
        ),
        li: ({ node, ...props }) => (
          <li style={{ marginBottom: '0.6em', color: '#374151', fontSize: '16px' }} {...props} />
        ),
        table: ({ node, ...props }) => (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              margin: '2em 0',
              fontSize: '15px',
              border: '1px solid #eee',
            }}
            {...props}
          />
        ),
        th: ({ node, ...props }) => (
          <th
            style={{
              padding: '10px 14px',
              background: '#f6f8fa',
              fontWeight: '700',
              border: '1px solid #eee',
              textAlign: 'left',
            }}
            {...props}
          />
        ),
        td: ({ node, ...props }) => (
          <td style={{ padding: '10px 14px', border: '1px solid #eee' }} {...props} />
        ),
        img: ({ node, ...props }) => (
          <img
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              margin: '1.8em 0',
              borderRadius: '16px',
            }}
            {...props}
          />
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    const text = codeRef.current?.innerText || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }} className="code-block-container group">
      <button
        onClick={handleCopy}
        className="copy-button"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: copied ? '#22c55e' : 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: '700',
          padding: '4px 10px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          zIndex: 10,
          fontFamily: 'Inter, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          opacity: copied ? 1 : 0,
          visibility: copied ? 'visible' : 'hidden',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <style jsx>{`
        .code-block-container:hover .copy-button {
          opacity: 1 !important;
          visibility: visible !important;
        }
      `}</style>
      <pre
        ref={codeRef}
        style={{
          background: '#0d1117',
          color: '#e6edf3',
          padding: '24px',
          borderRadius: '16px',
          overflowX: 'auto',
          margin: '2em 0',
          border: '1px solid #30363d',
          boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
          fontSize: '14px',
          lineHeight: '1.6',
          fontFamily: 'SFMono-Regular, Consolas, monospace',
        }}
      >
        {children}
      </pre>
    </div>
  );
}

function slugify(text: React.ReactNode) {
  const plainText = extractText(text);

  return plainText
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractText(node: React.ReactNode): string {
  if (!node) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => extractText(child)).join('');
  }

  if (React.isValidElement(node)) {
    return extractText(node.props.children);
  }

  return '';
}
