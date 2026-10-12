import { EventEditor } from '@/components/admin/event-editor';

// Geral, Programação and Produtos & Lotes are one form (REA-24). It lives in this layout, shared
// by the three routes, so it stays mounted (and keeps what was typed) while the sidebar switches
// between them. The pages themselves render nothing: the editor reads the section from the URL.
export default function EventEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EventEditor />
      {children}
    </>
  );
}
