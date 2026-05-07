'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, Italic, Strikethrough, Heading1, Heading2, 
  List, ListOrdered, Code, Variable 
} from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const VARIABLES = [
  { label: 'First Name', value: '{{firstName}}' },
  { label: 'Last Name', value: '{{lastName}}' },
  { label: 'Company', value: '{{company}}' },
  { label: 'Title', value: '{{title}}' },
  { label: 'Email', value: '{{email}}' },
];

export function RichTextEditor({ 
  content, 
  onChange 
}: { 
  content: string; 
  onChange: (html: string, text: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your email template here...',
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[200px] p-4 text-sm [&_p]:mb-3 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:mb-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const insertVariable = (variable: string) => {
    editor.chain().focus().insertContent(variable).run();
  };

  return (
    <div className="border rounded-md overflow-hidden bg-background flex flex-col">
      <div className="flex items-center gap-1 border-b bg-muted/40 p-1.5 flex-wrap shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 ${editor.isActive('bold') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 ${editor.isActive('italic') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 w-8 ${editor.isActive('strike') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`h-8 w-8 ${editor.isActive('heading', { level: 1 }) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`h-8 w-8 ${editor.isActive('heading', { level: 2 }) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 ${editor.isActive('bulletList') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 ${editor.isActive('orderedList') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`h-8 w-8 ${editor.isActive('codeBlock') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" type="button" className="h-8 gap-1.5 px-3 border-dashed">
              <Variable className="h-3.5 w-3.5 text-primary" />
              <span>Insert Variable</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {VARIABLES.map((v) => (
              <DropdownMenuItem key={v.value} onClick={() => insertVariable(v.value)} className="cursor-pointer">
                <span className="font-medium mr-3">{v.label}</span>
                <span className="text-muted-foreground text-xs ml-auto font-mono bg-muted px-1 py-0.5 rounded">{v.value}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
