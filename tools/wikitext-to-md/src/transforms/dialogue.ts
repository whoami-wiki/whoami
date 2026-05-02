const DIALOGUE_RE = /\{\{Dialogue\|([^|}]*)\|([^}]*)\}\}/g;

export function transformDialogue(text: string): string {
  return text.replace(DIALOGUE_RE, (_match, speaker: string, body: string) => {
    const speakerAttr = speaker.trim() ? `{speaker="${speaker.trim().replace(/"/g, '\\"')}"}` : '{}';
    return `:::dialogue${speakerAttr}\n${body.trim()}\n:::`;
  });
}
