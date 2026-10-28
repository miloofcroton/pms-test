import { css } from '@linaria/core';

// Shared classes for every view: plain tables and a few status colors.

export const page = css`
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
`;

export const nav = css`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: baseline;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #ddd;
  background: #fafafa;

  & strong {
    margin-right: 1rem;
  }
`;

export const table = css`
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0 1.5rem;
  font-size: 0.9rem;

  & th,
  & td {
    text-align: left;
    vertical-align: top;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #eee;
  }

  & th {
    border-bottom: 2px solid #ddd;
    white-space: nowrap;
  }
`;

// Tables can scroll sideways on a narrow screen without the page doing so.
export const scroll = css`
  overflow-x: auto;
`;

export const muted = css`
  color: #666;
`;

export const code = css`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: #f3f3f3;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
`;

export const badge = css`
  display: inline-block;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background: #eee;
  white-space: nowrap;
`;

export const good = css`
  background: #e3f4e6;
  color: #1d5e2a;
`;

export const warn = css`
  background: #fff3d6;
  color: #7a5200;
`;

export const bad = css`
  background: #fde3e1;
  color: #8a1c13;
`;

export const facts = css`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1.25rem;
  margin: 0.5rem 0 1.5rem;

  & dt {
    color: #666;
  }

  & dd {
    margin: 0;
  }
`;

export const callout = css`
  border-left: 4px solid #e0a800;
  background: #fffaf0;
  padding: 0.6rem 0.9rem;
  margin: 0.5rem 0 1.5rem;
`;

export const buttons = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0 1rem;

  & button {
    padding: 0.45rem 0.9rem;
    font: inherit;
    cursor: pointer;
  }
`;
