// services/documentService.ts
// Service for querying legal documents

export async function queryLRADocument(query: string): Promise<string> {
  try {
    const response = await fetch('/documents/lra-code-of-conduct-dismissals-2025.txt');
    if (!response.ok) throw new Error('Document not found');
    const text = await response.text();
    const lowerQuery = query.toLowerCase();
    const lines = text.split('\n');
    const matches: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        matches.push(lines.slice(start, end).join('\n'));
        if (matches.length >= 3) break;
      }
    }
    
    return matches.length > 0 ? matches.join('\n\n---\n\n') : 'No relevant sections found in LRA document.';
  } catch (error) {
    return 'Unable to access the LRA document at this time.';
  }
}
