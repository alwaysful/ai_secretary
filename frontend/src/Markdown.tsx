import { isValidElement, memo, ReactNode } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyButton } from './CopyButton';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

const components: Components = {
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children;
    const cls = isValidElement<{ className?: string }>(child) ? (child.props.className ?? '') : '';
    const lang = /language-([\w+-]+)/.exec(cls)?.[1] ?? '';
    const code = textOf(children).replace(/\n$/, '');
    return (
      <div className="codeblock">
        <div className="codehead">
          <span>{lang || 'code'}</span>
          <CopyButton text={code} />
        </div>
        <pre>{children}</pre>
      </div>
    );
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
};

/** 모델 응답 렌더링. raw HTML은 렌더링하지 않는다 (react-markdown 기본값). */
export const Markdown = memo(function Markdown(props: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {props.text}
      </ReactMarkdown>
    </div>
  );
});
